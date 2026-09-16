import { createClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { requireSupabasePublicConfig, requireSupabaseServiceRoleKey } from "@/app/lib/supabase/config";
import { lettershopMailIsConfigured, sendLettershopCancellationMail } from "@/app/lettershop/sendOrderMail";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile?.active || !hasFullAccess(profile)) {
    return Response.json({ message: "Geen toegang." }, { status: 403 });
  }
  if (!lettershopMailIsConfigured()) {
    return Response.json({ message: "Annuleringsmail is nog niet ingesteld. Bestelling is niet verwijderd." }, { status: 503 });
  }
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return Response.json({ message: "Ongeldige website." }, { status: 403 });
      }
    } catch { return Response.json({ message: "Ongeldige website." }, { status: 403 }); }
  }
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ message: "Ongeldig verzoek." }, { status: 400 }); }
  const data = input && typeof input === "object" ? input as Record<string, unknown> : {};
  if (typeof data.orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(data.orderId)
    || typeof data.confirmation !== "string" || !/^CL\d{2}-\d{4,}$/.test(data.confirmation)) {
    return Response.json({ message: "Controleer het ordernummer." }, { status: 400 });
  }
  try {
    const { url } = requireSupabasePublicConfig();
    const db = createClient(url, requireSupabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: jobId, error } = await db.rpc("lettershop_delete_unproduced_order", {
      p_order_id: data.orderId,
      p_expected_order_number: data.confirmation,
    });
    if (error || !jobId) return Response.json({ message: error?.message || "Verwijderen is niet gelukt." }, { status: 409 });
    let mailStatus: "SENT" | "FAILED" | "SKIPPED" = "FAILED";
    try { mailStatus = await sendLettershopCancellationMail(jobId); } catch { /* Retry queue keeps the mail. */ }
    return Response.json({ deleted: true, mailStatus });
  } catch {
    return Response.json({ message: "Verwijderen is tijdelijk niet beschikbaar." }, { status: 503 });
  }
}
