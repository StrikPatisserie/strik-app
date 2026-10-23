import { createHmac } from "node:crypto";
import { after } from "next/server";
import { parseWeddingContact, weddingDateIsValid, WEDDING_TIMES } from "@/app/lib/weddingAppointments";
import { weddingDb } from "@/app/lib/weddingServer";
import { sendWeddingMails } from "@/app/lib/weddingMail.server";
import { weddingPublicJson, weddingPublicOptions, weddingPublicOriginAllowed } from "@/app/lib/weddingPublicSite";
export const OPTIONS = weddingPublicOptions;
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!weddingPublicOriginAllowed(request)) return weddingPublicJson(request, { message: "Open de planner opnieuw en probeer het nogmaals." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 12000) return weddingPublicJson(request, { message: "De aanvraag is te groot." }, 413);
  let input;
  try { const raw = await request.text(); if (Buffer.byteLength(raw, "utf8") > 12000) return weddingPublicJson(request, {message:"De aanvraag is te groot."},413); input = JSON.parse(raw); } catch { return weddingPublicJson(request, { message: "De aanvraag kon niet worden gelezen." }, 400); }
  let contact;
  try {
    contact = parseWeddingContact(input.contact);
    if (!weddingDateIsValid(input.date || "") || !WEDDING_TIMES.includes(input.time) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.requestId || "")) throw new Error("Kies een dag en tijdstip en probeer opnieuw.");
  } catch (error) { return weddingPublicJson(request, { message: error instanceof Error ? error.message : "Controleer de ingevulde gegevens." }, 400); }
  try {
    const salt = process.env.LETTERSHOP_RATE_SALT;
    if (!salt) throw new Error("config");
    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data, error } = await weddingDb().rpc("strik_book_wedding_appointment", { p_date: input.date, p_time: input.time, p_request_id: input.requestId, p_customer: contact, p_rate_key: createHmac("sha256", salt).update(ip).digest("hex") });
    if (error) return weddingPublicJson(request, { message: error.code === "P0001" ? error.message : "De afspraak kon nog niet worden vastgelegd. Probeer opnieuw." }, error.code === "P0001" ? 409 : 503);
    if (!data || data.status !== "confirmed") return weddingPublicJson(request, { message: "Deze afspraak is niet meer actief. Neem contact met ons op." }, 409);
    after(async () => { try { await sendWeddingMails(data.id); } catch { /* Durable jobs are retried by cron. */ } });
    const { id, reference, appointment_date, start_time, end_time, names, email } = data;
    return weddingPublicJson(request, { receipt: { id, reference, appointment_date, start_time, end_time, names, email, mailPending: true } });
  } catch { return weddingPublicJson(request, { message: "De verbinding is tijdelijk onderbroken. Probeer opnieuw; dezelfde aanvraag wordt maar één keer geboekt." }, 503); }
}
