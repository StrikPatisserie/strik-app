import { hasCronAuthorization } from "@/app/lib/auth/cron";
import { sendWeddingMails } from "@/app/lib/weddingMail.server";
import { weddingJson } from "@/app/lib/weddingServer";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!hasCronAuthorization(request)) return weddingJson({ message: "Geen toegang." }, 403);
  try { return weddingJson({ checked: await sendWeddingMails() }); }
  catch { return weddingJson({ message: "Opnieuw verzenden is tijdelijk niet gelukt." }, 503); }
}
