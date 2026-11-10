import { createClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { requireSupabasePublicConfig, requireSupabaseServiceRoleKey } from "@/app/lib/supabase/config";
import { lettershopMailIsConfigured, sendLettershopOrderMails } from "@/app/lettershop/sendOrderMail";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile?.active || !hasFullAccess(profile)) return Response.json({ message: "Geen toegang." }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ message: "Ongeldige website." }, { status: 403, headers });
  if (!lettershopMailIsConfigured()) return Response.json({ message: "Klantbevestigingen zijn nog niet ingesteld." }, { status: 503, headers });
  try {
    const raw = await request.text();
    if (raw.length > 16000) return Response.json({ message: "De wijziging is te groot." }, { status: 413, headers });
    const input = JSON.parse(raw);
    if (!input || !uuid.test(input.orderId) || !uuid.test(input.requestId) || !Number.isInteger(input.revision) || input.revision < 1
      || typeof input.confirmation !== "string" || !/^CL\d{2}-\d{4,}$/.test(input.confirmation) || input.confirmed !== true
      || !Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100
      || input.lines.some((line: { itemId?: unknown; quantity?: unknown } | null) => !line || typeof line.itemId !== "string" || !uuid.test(line.itemId)
        || typeof line.quantity !== "number" || !Number.isInteger(line.quantity) || line.quantity < 0 || line.quantity > 100000)) {
      return Response.json({ message: "Controleer en bevestig de aantallen opnieuw." }, { status: 400, headers });
    }
    const { url } = requireSupabasePublicConfig();
    const db = createClient(url, requireSupabaseServiceRoleKey(), { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: jobId, error } = await db.rpc("lettershop_change_quantities", {
      p_request_key: input.requestId, p_order_id: input.orderId, p_expected_revision: input.revision,
      p_expected_order_number: input.confirmation, p_lines: input.lines, p_actor_id: profile.id,
    });
    if (error || !jobId) return Response.json({ message: error?.message || "Wijzigen is niet gelukt." }, { status: 409, headers });
    try { await sendLettershopOrderMails(input.orderId); } catch { /* The committed mail job remains available for retry. */ }
    const { data: job } = await db.from("letter_mail_outbox").select("status").eq("id", jobId).maybeSingle();
    return Response.json({ changed: true, mailStatus: job?.status === "SENT" ? "SENT" : "QUEUED" }, { headers });
  } catch {
    return Response.json({ message: "Wijzigen is tijdelijk niet beschikbaar. Je invoer blijft in beeld." }, { status: 400, headers });
  }
}
