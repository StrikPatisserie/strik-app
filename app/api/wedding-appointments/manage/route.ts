import { after } from "next/server";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { canAccessWeddingCakes, hasFullAccess } from "@/app/lib/auth/access";
import { normalizeWeddingArchive } from "@/app/lib/weddingArchive.server";
import { parseWeddingContact, weddingDateIsValid, type WeddingAppointment } from "@/app/lib/weddingAppointments";
import { weddingDb, weddingJson, weddingSameOrigin, weddingSettings, weddingWordPress } from "@/app/lib/weddingServer";
import { sendWeddingMails } from "@/app/lib/weddingMail.server";
export const runtime = "nodejs";
export const maxDuration = 60;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fields = "id,reference,appointment_date,start_time,end_time,status,names,email,phone,wedding_date,guests,notes,source,source_booking_id,revision,created_at,updated_at";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile?.active || !canAccessWeddingCakes(profile)) return weddingJson({message:"Geen toegang."},403);
  const query = new URL(request.url).searchParams;
  const from = query.get("from") || "", to = query.get("to") || "";
  if (!weddingDateIsValid(from) || !weddingDateIsValid(to) || to < from || Date.parse(to)-Date.parse(from)>370*86400000) return weddingJson({message:"Kies een geldige periode van maximaal één jaar."},400);
  try {
    const settings = await weddingSettings().catch(() => null);
    if (!settings?.enabled) {
      const normalized = normalizeWeddingArchive(await weddingWordPress("export"));
      const appointments = normalized.appointments.filter(item => item.appointment_date>=from && item.appointment_date<=to).map(item => ({...item, id:`wordpress-${item.source_id}`,reference:`WP-${item.source_id}`,source:"wordpress",revision:1,raw_source:undefined}));
      return weddingJson({enabled:false,appointments,totalHistory:normalized.appointments.length,migrationCount:settings?.migration_count || 0,canManage:hasFullAccess(profile)});
    }
    const db = weddingDb();
    const {data,error} = await db.from("wedding_appointments").select(fields).gte("appointment_date",from).lte("appointment_date",to).order("appointment_date").order("start_time").limit(1000);
    if (error) throw error;
    const ids = (data || []).map(item=>item.id);
    const mail = ids.length ? await db.from("wedding_appointment_mail_outbox").select("appointment_id,revision,template,status,sent_at,available_at,last_error").in("appointment_id",ids) : {data:[],error:null};
    if (mail.error) throw mail.error;
    return weddingJson({enabled:true,appointments:(data||[]).map(item=>({...item,mail:(mail.data||[]).filter(job=>job.appointment_id===item.id && job.revision===item.revision)})),migrationCount:settings.migration_count,canManage:hasFullAccess(profile)});
  } catch { return weddingJson({message:"De afspraken konden niet worden geladen. Probeer opnieuw."},503); }
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile?.active || !canAccessWeddingCakes(profile)) return weddingJson({message:"Geen toegang."},403);
  if (!weddingSameOrigin(request)) return weddingJson({message:"Open de agenda opnieuw."},403);
  let input;
  try { const raw=await request.text(); if(Buffer.byteLength(raw)>16000) return weddingJson({message:"De invoer is te groot."},413); input=JSON.parse(raw); if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("input"); } catch {return weddingJson({message:"De invoer kon niet worden gelezen."},400);}
  if (input.action === "import") {
    if (!hasFullAccess(profile)) return weddingJson({message:"Alleen management kan de historie overnemen."},403);
    try {
      const normalized = normalizeWeddingArchive(await weddingWordPress("export"));
      const {data,error}=await weddingDb().rpc("strik_import_wedding_archive",{p_archive:normalized.archive,p_appointments:normalized.appointments,p_blocks:normalized.blocks,p_actor:profile.id,p_enable:false});
      if(error) throw error;
      return weddingJson({imported:data});
    } catch {return weddingJson({message:"De historie kon niet volledig worden overgenomen. De bestaande agenda blijft intact."},503);}
  }
  try {
    const id = input.id || null;
    if (id && (!UUID.test(id) || !Number.isInteger(input.revision) || input.revision<1)) throw new Error("Ververs de afspraak voordat je deze wijzigt.");
    if (!id && !UUID.test(input.requestId || "")) throw new Error("Open de nieuwe afspraak opnieuw.");
    let date=input.date, start=input.start, end=input.end, contact;
    const status=input.action==="cancel"?"cancelled":"confirmed";
    if(input.action==="cancel") {
      if(!id) throw new Error("Kies een bestaande afspraak.");
      const {data,error}=await weddingDb().from("wedding_appointments").select(fields).eq("id",id).single();
      if(error || !data) throw new Error("De afspraak is niet gevonden.");
      date=data.appointment_date; start=data.start_time.slice(0,5); end=data.end_time.slice(0,5);
      contact={names:data.names,email:data.email,phone:data.phone,weddingDate:data.wedding_date||"",guests:data.guests?String(data.guests):"",notes:data.notes};
    } else contact=parseWeddingContact(input.contact,true);
    if(!weddingDateIsValid(date||"") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start||"") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end||"") || end<=start) throw new Error("Controleer de datum, begin- en eindtijd.");
    if(input.notify && !contact.email) throw new Error("Vul een e-mailadres in om de klant te mailen.");
    const {data,error}=await weddingDb().rpc("strik_manage_wedding_appointment",{p_id:id,p_request_id:id?null:input.requestId,p_date:date,p_start:start,p_end:end,p_customer:contact,p_status:status,p_notify:input.notify===true,p_actor:profile.id,p_expected_revision:id?input.revision:null});
    if(error) return weddingJson({message:error.code==="P0001"?error.message:"De afspraak kon niet worden opgeslagen."},error.code==="P0001"?409:503);
    after(async()=>{try{await sendWeddingMails(data.id);}catch{/* Durable retry. */}});
    const appointment = data as WeddingAppointment;
    const {raw_source, ...safe} = appointment; void raw_source;
    return weddingJson({appointment:safe});
  } catch(reason) {return weddingJson({message:reason instanceof Error?reason.message:"Controleer de ingevulde gegevens."},400);}
}
