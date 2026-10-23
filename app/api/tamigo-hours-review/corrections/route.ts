import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { fetchTamigoHoursReviewSource, tamigoHoursWritesEnabled } from "@/app/tamigoApi";
import { corrections } from "@/app/management/urencontrole/correctionServer";
import { correctionStore } from "@/app/management/urencontrole/correctionStorage";
import { breakOptions, CorrectionError, validUuid } from "@/app/management/urencontrole/correctionRules";
import { isRecord } from "@/app/management/urencontrole/reviewSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store", Pragma: "no-cache" };
function json(value: unknown, status = 200) { return Response.json(value, { status, headers }); }
export async function GET(request: Request) {
  if (!hasFullAccess(await getCurrentProfile())) return json({ message: "Alleen bevoegde beheerders kunnen correcties inzien." }, 403);
  const shift = new URL(request.url).searchParams.get("shift");
  if (!validUuid(shift)) return json({ message: "Ongeldige dienst." }, 400);
  const [codes, ready, history] = await Promise.allSettled([
    fetchTamigoHoursReviewSource({ kind: "breakcodes" }).then(breakOptions),
    correctionStore.ready(), correctionStore.history(shift.toLowerCase()),
  ]);
  return json({ enabled: tamigoHoursWritesEnabled(), storageReady: ready.status === "fulfilled" && ready.value,
    options: codes.status === "fulfilled" ? codes.value : null,
    history: history.status === "fulfilled" ? history.value : [], historyAvailable: history.status === "fulfilled",
    message: codes.status === "rejected" ? "Pauzecodes zijn niet beschikbaar. Er kan niets worden opgeslagen." : "Dagstatus en bronversie worden vóór opslaan opnieuw gecontroleerd.",
  });
}
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!hasFullAccess(profile)) return json({ message: "Alleen bevoegde beheerders kunnen uren corrigeren." }, 403);
  if (request.headers.get("origin") !== new URL(request.url).origin || (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return json({ message: "Open de urencontrole opnieuw in de Strik-app." }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return json({ message: "Ongeldig verzoek." }, 415);
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 16000) return json({ message: "Het verzoek is te groot." }, 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { return json({ message: "Ongeldig verzoek." }, 400); }
    if (!isRecord(body)) return json({ message: "Ongeldig verzoek." }, 400);
    if (body.action === "prepare") return json(await corrections.prepare(profile!.id, body.reference, body.draft, body.config));
    if (body.action === "commit" && validUuid(body.id)) return json(await corrections.commit(profile!.id, body.id.toLowerCase(), body.confirmed === true));
    if (body.action === "reconcile" && validUuid(body.id)) return json(await corrections.reconcile(profile!.id, body.id.toLowerCase()));
    return json({ message: "Onbekende correctieactie." }, 400);
  } catch (error) {
    if (error instanceof CorrectionError) return json({ message: error.message }, error.status);
    // Do not expose upstream responses, personnel records, credentials or SQL errors.
    return json({ message: "De correctie kon niet worden afgerond. Controleer de historie en Tamigo voordat je opnieuw probeert." }, 503);
  }
}
