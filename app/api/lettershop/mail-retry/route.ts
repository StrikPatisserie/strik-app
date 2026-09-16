import { createClient } from "@supabase/supabase-js";
import { requireSupabasePublicConfig, requireSupabaseServiceRoleKey } from "@/app/lib/supabase/config";
import { sendLettershopOrderMails } from "@/app/lettershop/sendOrderMail";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ message: "Geen toegang." }, { status: 403 });
  }
  try {
    const { url } = requireSupabasePublicConfig();
    const supabase = createClient(url, requireSupabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
    await supabase.from("letter_mail_outbox").update({ status: "FAILED", last_error: "Vorige verzendpoging is verlopen." })
      .eq("status", "SENDING").lt("last_attempt_at", staleBefore);
    const { data: jobs, error } = await supabase.from("letter_mail_outbox")
      .select("order_id").in("status", ["PENDING", "FAILED"])
      .in("template", ["ONLINE_CONFIRMATION", "INTERNAL_ORDER_BACKUP"])
      .lt("attempts", 10).order("created_at").limit(100);
    if (error) throw error;
    const orderIds = [...new Set((jobs || []).map((job) => job.order_id))];
    for (const orderId of orderIds) await sendLettershopOrderMails(orderId);
    return Response.json({ checkedOrders: orderIds.length });
  } catch {
    return Response.json({ message: "E-mails opnieuw proberen is mislukt." }, { status: 502 });
  }
}
