import { getCurrentProfile } from "../../lib/auth/session";
import { canAccessLogistiek } from "../../lib/auth/access";
import { loadProductionB2BOrders } from "../../sinterklaas/sinterklaasServerApi";
import { buildProductionTotals } from "../../sinterklaas/b2b/productionTotals";
import { applyBakeItCommand, BakeItError } from "../../sinterklaas/b2b/bakeItRegistrations";
import { readBakeItDocument, saveBakeItDocument } from "../../sinterklaas/b2b/bakeItStore.server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const error = (message: string, status = 400) => Response.json({ message }, { status, headers });
function context(request: Request): { season: "sint" | "kerst"; year: string } {
  const url = new URL(request.url), season = url.searchParams.get("season"), year = url.searchParams.get("year") || "";
  if ((season !== "sint" && season !== "kerst") || !/^20\d{2}$/.test(year)) throw new BakeItError("Kies een geldig seizoen en jaar.");
  return { season, year };
}
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile?.active || !canAccessLogistiek(profile)) return error("Geen toegang tot de productie opteller.", 403);
  try {
    const { season, year } = context(request);
    return Response.json({ state: await readBakeItDocument(season, year) }, { headers });
  } catch (e) { return error(e instanceof BakeItError ? e.message : "De Bake-it-registraties konden niet worden geladen.", e instanceof BakeItError ? e.status : 503); }
}
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile?.active || !canAccessLogistiek(profile)) return error("Geen toegang tot de productie opteller.", 403);
  if (request.headers.get("origin") !== new URL(request.url).origin) return error("Ongeldige herkomst.", 403);
  try {
    const { season, year } = context(request);
    const raw = await request.text();
    if (raw.length > 20000) return error("De registratie is te groot.", 413);
    let input;
    try { input = JSON.parse(raw); } catch { return error("Ongeldige registratie."); }
    if (!input || !Number.isSafeInteger(input.revision) || input.revision < 0 || !input.command) return error("Ververs de opteller en probeer opnieuw.");
    const previous = await readBakeItDocument(season, year);
    // A retried save after a lost response is acknowledged once, not counted twice.
    if (previous.history.some(event => event.operationId === input.command.operationId)) return Response.json({ state: previous }, { headers });
    if (input.revision !== previous.revision) return error("De Bake-it-registraties zijn intussen gewijzigd. Ververs en probeer opnieuw.", 409);
    const orders = await loadProductionB2BOrders(year);
    const totals = buildProductionTotals(orders, season, year);
    const next = applyBakeItCommand(previous, input.command, totals, profile.full_name || "Medewerker", new Date().toISOString());
    await saveBakeItDocument(season, year, previous, next, profile.id);
    return Response.json({ state: next }, { headers });
  } catch (e) { return error(e instanceof BakeItError ? e.message : "De registratie kon niet worden bevestigd. Ververs de opteller om de actuele stand te zien.", e instanceof BakeItError ? e.status : 503); }
}
