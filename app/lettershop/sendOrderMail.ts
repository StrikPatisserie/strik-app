import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireSupabasePublicConfig, requireSupabaseServiceRoleKey } from "@/app/lib/supabase/config";

const MAIL_URL = process.env.WORDPRESS_LETTERSHOP_MAIL_URL ||
  "https://strik-patisserie.nl/wp-json/strik/v1/lettershop-mail";
const BUCKET = "lettershop-logos";

function adminClient() {
  const { url } = requireSupabasePublicConfig();
  return createClient(url, requireSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function lettershopMailIsConfigured() {
  return Boolean(
    (process.env.WORDPRESS_MEDIA_USERNAME || process.env.WORDPRESS_USERNAME) &&
    (process.env.WORDPRESS_MEDIA_APPLICATION_PASSWORD || process.env.WORDPRESS_APPLICATION_PASSWORD)
  );
}

type Attachment = { name: string; base64: string };

async function attachmentsForBackup(
  supabase: ReturnType<typeof adminClient>,
  payload: Record<string, unknown>,
): Promise<Attachment[]> {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const attachments: Attachment[] = [];
  let totalBytes = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const path = (item as Record<string, unknown>).logo_storage_path;
    if (typeof path !== "string" || !path) continue;
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) throw new Error("Foto/logo voor back-upmail kon niet worden gelezen.");
    const bytes = Buffer.from(await data.arrayBuffer());
    totalBytes += bytes.length;
    if (totalBytes > 5_000_000) throw new Error("Foto's zijn samen te groot voor de back-upmail.");
    attachments.push({ name: path.split("/").pop() || "logo.jpg", base64: bytes.toString("base64") });
  }
  return attachments;
}

export async function sendLettershopOrderMails(orderId: string) {
  if (!lettershopMailIsConfigured()) throw new Error("WordPress-mail is niet ingesteld.");
  const username = process.env.WORDPRESS_MEDIA_USERNAME || process.env.WORDPRESS_USERNAME || "";
  const password = process.env.WORDPRESS_MEDIA_APPLICATION_PASSWORD || process.env.WORDPRESS_APPLICATION_PASSWORD || "";
  const supabase = adminClient();
  const { data: jobs, error: readError } = await supabase.from("letter_mail_outbox")
    .select("id,template,payload,status,attempts,created_at")
    .eq("order_id", orderId).in("template", ["INTERNAL_ORDER_BACKUP", "ONLINE_CONFIRMATION"])
    .in("status", ["PENDING", "FAILED"])
    .order("created_at");
  if (readError) throw readError;

  for (const job of jobs || []) {
    if (job.status === "SENT") continue;
    const { data: claimed, error: claimError } = await supabase.from("letter_mail_outbox")
      .update({ status: "SENDING", attempts: job.attempts + 1, last_attempt_at: new Date().toISOString(), last_error: null })
      .eq("id", job.id).eq("status", job.status).select("id").maybeSingle();
    if (claimError || !claimed) continue;
    try {
      const payload = job.payload as Record<string, unknown>;
      const attachments = job.template === "INTERNAL_ORDER_BACKUP"
        ? await attachmentsForBackup(supabase, payload) : [];
      const response = await fetch(MAIL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
        body: JSON.stringify({ id: job.id, template: job.template, payload, attachments }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`WordPress-mail gaf status ${response.status}.`);
      await supabase.from("letter_mail_outbox").update({ status: "SENT", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id);
    } catch (error) {
      await supabase.from("letter_mail_outbox").update({ status: "FAILED", last_error: error instanceof Error ? error.message.slice(0, 240) : "Verzenden mislukt" })
        .eq("id", job.id);
    }
  }
}
