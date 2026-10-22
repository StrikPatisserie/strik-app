import { availableWeddingSlots, weddingDateIsValid } from "@/app/lib/weddingAppointments";
import { weddingDb, weddingJson, weddingSettings } from "@/app/lib/weddingServer";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const from = query.get("from") || "", to = query.get("to") || "";
  if (!weddingDateIsValid(from) || !weddingDateIsValid(to) || to < from || Date.parse(to) - Date.parse(from) > 42 * 86400000) return weddingJson({ message: "Kies een geldige kalenderperiode." }, 400);
  try {
    const settings = await weddingSettings();
    if (!settings.enabled) return weddingJson({ enabled: false, days: [] });
    const db = weddingDb();
    const [appointments, blocks] = await Promise.all([
      db.from("wedding_appointments").select("appointment_date,start_time,end_time,status").gte("appointment_date", from).lte("appointment_date", to).in("status", ["confirmed", "pending"]),
      db.from("wedding_appointment_blocks").select("block_date").eq("active", true).gte("block_date", from).lte("block_date", to),
    ]);
    if (appointments.error || blocks.error) throw new Error("read");
    return weddingJson({ enabled: true, days: availableWeddingSlots(settings, from, to, appointments.data || [], (blocks.data || []).map(row => row.block_date)) });
  } catch { return weddingJson({ message: "De vrije tijden konden niet worden geladen. Probeer opnieuw of mail ons." }, 503); }
}
