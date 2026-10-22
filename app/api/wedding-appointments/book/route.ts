import { createHmac } from "node:crypto";
import { after } from "next/server";
import { parseWeddingContact, weddingDateIsValid, WEDDING_TIMES } from "@/app/lib/weddingAppointments";
import { weddingDb, weddingJson, weddingSameOrigin } from "@/app/lib/weddingServer";
import { sendWeddingMails } from "@/app/lib/weddingMail.server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!weddingSameOrigin(request)) return weddingJson({ message: "Open de planner opnieuw en probeer het nogmaals." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 12000) return weddingJson({ message: "De aanvraag is te groot." }, 413);
  let input;
  try { const raw = await request.text(); if (Buffer.byteLength(raw, "utf8") > 12000) return weddingJson({message:"De aanvraag is te groot."},413); input = JSON.parse(raw); } catch { return weddingJson({ message: "De aanvraag kon niet worden gelezen." }, 400); }
  let contact;
  try {
    contact = parseWeddingContact(input.contact);
    if (!weddingDateIsValid(input.date || "") || !WEDDING_TIMES.includes(input.time) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.requestId || "")) throw new Error("Kies een dag en tijdstip en probeer opnieuw.");
  } catch (error) { return weddingJson({ message: error instanceof Error ? error.message : "Controleer de ingevulde gegevens." }, 400); }
  try {
    const salt = process.env.LETTERSHOP_RATE_SALT;
    if (!salt) throw new Error("config");
    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data, error } = await weddingDb().rpc("strik_book_wedding_appointment", { p_date: input.date, p_time: input.time, p_request_id: input.requestId, p_customer: contact, p_rate_key: createHmac("sha256", salt).update(ip).digest("hex") });
    if (error) return weddingJson({ message: error.code === "P0001" ? error.message : "De afspraak kon nog niet worden vastgelegd. Probeer opnieuw." }, error.code === "P0001" ? 409 : 503);
    if (!data || data.status !== "confirmed") return weddingJson({ message: "Deze afspraak is niet meer actief. Neem contact met ons op." }, 409);
    after(async () => { try { await sendWeddingMails(data.id); } catch { /* Durable jobs are retried by cron. */ } });
    const { id, reference, appointment_date, start_time, end_time, names, email } = data;
    return weddingJson({ receipt: { id, reference, appointment_date, start_time, end_time, names, email, mailPending: true } });
  } catch { return weddingJson({ message: "De verbinding is tijdelijk onderbroken. Probeer opnieuw; dezelfde aanvraag wordt maar één keer geboekt." }, 503); }
}
