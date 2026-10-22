import "server-only";
import { weddingDb, weddingWordPress } from "./weddingServer";
import { weddingConfirmationMail } from "./weddingMail";
import type { WeddingAppointment } from "./weddingAppointments";
import { weddingLocalDate } from "./weddingAppointments";
import { weddingSettings } from "./weddingServer";
export async function sendWeddingMails(appointmentId?: string) {
  if (!(await weddingSettings()).enabled) return 0;
  const db = weddingDb();
  const stale = new Date(Date.now() - 10 * 60000).toISOString();
  const recovery = await db.from("wedding_appointment_mail_outbox").update({ status: "FAILED", last_error: "Verzendpoging verlopen; wordt opnieuw geprobeerd." }).eq("status", "SENDING").lt("last_attempt_at", stale);
  if (recovery.error) throw recovery.error;
  let query = db.from("wedding_appointment_mail_outbox").select("id,appointment_id,template,status,attempts,revision").in("status", ["PENDING", "FAILED"]).lte("available_at", new Date().toISOString()).lt("attempts", 20).order("available_at").limit(12);
  if (appointmentId) query = query.eq("appointment_id", appointmentId);
  const { data: jobs, error } = await query;
  if (error) throw error;
  // The transport keeps a durable receipt for every job, so retrying an
  // interrupted response cannot deliver the same email twice.
  await Promise.all((jobs || []).map(async job => {
    const { data: claimed, error: claimError } = await db.from("wedding_appointment_mail_outbox").update({ status: "SENDING", attempts: job.attempts + 1, last_attempt_at: new Date().toISOString(), last_error: null }).eq("id", job.id).eq("status", job.status).eq("attempts", job.attempts).select("id").maybeSingle();
    if (claimError || !claimed) return;
    try {
      const { data, error: readError } = await db.from("wedding_appointments").select("id,reference,appointment_date,start_time,end_time,status,names,email,phone,wedding_date,guests,notes,source,revision").eq("id", job.appointment_id).single();
      if (readError) throw readError;
      const tomorrow = new Date(`${weddingLocalDate()}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      if (data.status !== "confirmed" || data.revision !== job.revision || (job.template === "CUSTOMER_REMINDER" && data.appointment_date !== tomorrow.toISOString().slice(0, 10)) || (job.template !== "INTERNAL_CONFIRMATION" && !data.email)) { await db.from("wedding_appointment_mail_outbox").update({ status: "SKIPPED", last_error: null }).eq("id", job.id); return; }
      const mail = weddingConfirmationMail(data as WeddingAppointment, job.template === "INTERNAL_CONFIRMATION", job.template === "CUSTOMER_REMINDER");
      const receipt = await weddingWordPress("mail", { id: job.id, template: job.template, email: data.email, ...mail });
      if (receipt?.sent !== true) throw new Error("Mail transport not confirmed.");
      const saved = await db.from("wedding_appointment_mail_outbox").update({ status: "SENT", sent_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
      if (saved.error) throw saved.error;
    } catch {
      await db.from("wedding_appointment_mail_outbox").update({ status: "FAILED", last_error: "De bevestiging kon nog niet worden bezorgd. Automatisch opnieuw proberen of controleer de mailkoppeling." }).eq("id", job.id);
    }
  }));
  return jobs?.length || 0;
}
