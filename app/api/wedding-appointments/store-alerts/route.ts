import { getCurrentProfile } from "@/app/lib/auth/session";
import { canReceiveZiekerstraatWeddingAlerts } from "@/app/lib/auth/access";
import { normalizeWeddingArchive } from "@/app/lib/weddingArchive.server";
import { weddingLocalDate } from "@/app/lib/weddingAppointments";
import { weddingDb, weddingJson, weddingSettings, weddingWordPress } from "@/app/lib/weddingServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const profile = await getCurrentProfile();
  if (!canReceiveZiekerstraatWeddingAlerts(profile)) return weddingJson({message:"Geen toegang."},403);
  const today = weddingLocalDate();
  try {
    const settings = await weddingSettings();
    let rows;
    if (settings.enabled) {
      const result = await weddingDb().from("wedding_appointments")
        .select("id,appointment_date,start_time,end_time,names,status")
        .eq("appointment_date",today).in("status",["confirmed","pending"]).order("start_time").limit(100)
        .abortSignal(AbortSignal.timeout(12000));
      if (result.error) throw result.error;
      rows = result.data || [];
    } else {
      rows = normalizeWeddingArchive(await weddingWordPress("export")).appointments
        .map(item => ({...item,id:`wordpress-${item.source_id}`}));
    }
    const appointments = rows.filter(item => item.appointment_date === today && ["confirmed","pending"].includes(item.status))
      .map(item => ({id:item.id,appointment_date:item.appointment_date,start_time:item.start_time.slice(0,5),end_time:item.end_time.slice(0,5),names:item.names,status:item.status}));
    // No contact details, customer notes or mail history leave this endpoint.
    return weddingJson({today,appointments,checkedAt:new Date().toISOString()});
  } catch { return weddingJson({message:"De bruidstaartagenda kon niet worden vernieuwd."},503); }
}
