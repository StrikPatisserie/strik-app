import type { SupabaseClient } from "@supabase/supabase-js";
import { hasCronAuthorization } from "@/app/lib/auth/cron";
import { canAccessSinterklaasPath } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { loadProductionWordPressOrders } from "@/app/sinterklaas/sinterklaasServerApi";
import { loadCentralProduction } from "@/app/sinterklaas/letters/productie/productionData.server";
import { combineProductionOrders, productionChanges, productionDeadlinePassed, productionPlanVersion, reviseProductionRows, setProductionQuantity } from "@/app/sinterklaas/letters/productie/productionChecklist";
import type { ProductionSeedRow } from "@/app/sinterklaas/letters/productie/productionSources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SavedChecklist = { batch_id: string; rows: ProductionSeedRow[]; revision: number; plan_revision: number; locked_at: string; updated_at: string };
const columns = "batch_id,rows,revision,plan_revision,locked_at,updated_at";
const jsonError = (message: string, status = 400) => Response.json({ message }, { status });

async function loadCurrent(season: string) {
  const [central, wordpress] = await Promise.all([loadCentralProduction(season), loadProductionWordPressOrders(season)]);
  return { ...combineProductionOrders(central.batches, wordpress.letters, wordpress.b2b), centralUnplannedCount: central.centralUnplannedCount };
}

async function readLists(season: string, actorId: string | null) {
  const current = await loadCurrent(season);
  const db = createAdminClient() as unknown as SupabaseClient;
  const ids = current.batches.map(batch => batch.id);
  if (!ids.length) return current;
  const result = await db.from("letter_production_checklists").select(columns).in("batch_id", ids);
  if (result.error) throw new Error("De productievoortgang kon niet worden geladen. Probeer opnieuw.");
  const saved = new Map((result.data as SavedChecklist[]).map(list => [list.batch_id, list]));
  const views = await Promise.all(current.batches.map(async batch => {
    let list = saved.get(batch.id);
    if (!list && productionDeadlinePassed(batch)) {
      // The primary key makes simultaneous first opens safe: the first complete
      // snapshot wins; every caller then reads that exact same working list.
      const insert = await db.from("letter_production_checklists").insert({ batch_id: batch.id, rows: batch.rows, updated_by: actorId });
      if (insert.error && insert.error.code !== "23505") throw new Error("Vastzetten van de productielijst is mislukt.");
      const locked = await db.from("letter_production_checklists").select(columns).eq("batch_id", batch.id).single();
      if (locked.error) throw new Error("De vastgezette productielijst kon niet worden geladen.");
      list = locked.data as SavedChecklist;
    }
    if (!list) return { ...batch, checklist: undefined };
    return { ...batch, rows: list.rows, checklist: { revision: list.revision, planRevision: list.plan_revision, planVersion: productionPlanVersion(batch.rows), lockedAt: list.locked_at, updatedAt: list.updated_at, changes: productionChanges(list.rows, batch.rows) } };
  }));
  return { ...current, batches: views };
}

export async function GET(request: Request) {
  const cron = hasCronAuthorization(request);
  const profile = cron ? null : await getCurrentProfile();
  if (!cron && !canAccessSinterklaasPath(profile, "/sinterklaas/letters/productie")) return jsonError("Geen toegang tot productie.", 403);
  const season = new URL(request.url).searchParams.get("season") || String(new Date().getFullYear());
  if (!/^20\d{2}$/.test(season)) return jsonError("Ongeldig seizoen.");
  try {
    const result = await readLists(season, profile?.id || null);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Productielijsten laden is mislukt.", 503);
  }
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!canAccessSinterklaasPath(profile, "/sinterklaas/letters/productie")) return jsonError("Geen toegang tot productie.", 403);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return jsonError("Ongeldige website.", 403);
  let data: Record<string, unknown>;
  try { data = await request.json(); } catch { return jsonError("Ongeldig verzoek."); }
  if (!data || typeof data !== "object") return jsonError("Ongeldig verzoek.");
  const { batchId, revision, action, key, quantity } = data;
  if (typeof batchId !== "string" || !/^[0-9a-f-]{36}$/i.test(batchId) || !Number.isInteger(revision) || !["quantity", "revise"].includes(String(action))) return jsonError("Ongeldige productielijst.");
  try {
    const db = createAdminClient() as unknown as SupabaseClient;
    const batchResult = await db.from("letter_production_batches").select("status,order_deadline_at,season").eq("id", batchId).maybeSingle();
    if (batchResult.error) return jsonError("De deadline kon niet worden gecontroleerd.", 503);
    if (!batchResult.data) return jsonError("Productieronde niet gevonden.", 404);
    if (!productionDeadlinePassed({status: batchResult.data.status, deadlineAt: batchResult.data.order_deadline_at})) return jsonError("Afvinken kan pas na de besteldeadline.", 409);
    const stored = await db.from("letter_production_checklists").select(columns).eq("batch_id", batchId).maybeSingle();
    if (stored.error) return jsonError("Voortgang laden is mislukt.", 503);
    const list = stored.data as SavedChecklist | null;
    if (!list || list.revision !== revision) return jsonError("De lijst is intussen gewijzigd. De nieuwste versie wordt geladen; controleer je wijziging opnieuw.", 409);
    let rows: ProductionSeedRow[];
    if (action === "quantity") {
      if (typeof key !== "string" || typeof quantity !== "number") return jsonError("Controleer het geproduceerde aantal.");
      rows = setProductionQuantity(list.rows, key, quantity);
    } else {
      const current = await loadCurrent(String(batchResult.data.season));
      const batch = current.batches.find(item => item.id === batchId);
      if (!batch) return jsonError("Productieronde niet gevonden.", 404);
      if (data.planVersion !== productionPlanVersion(batch.rows)) return jsonError("De bestellingen zijn opnieuw gewijzigd. Bekijk eerst de nieuwste verschillen.", 409);
      rows = reviseProductionRows(list.rows, batch.rows);
    }
    const updated = await db.from("letter_production_checklists")
      .update({ rows, revision: list.revision + 1, plan_revision: list.plan_revision + (action === "revise" ? 1 : 0), updated_at: new Date().toISOString(), updated_by: profile?.id })
      .eq("batch_id", batchId).eq("revision", list.revision).select(columns).maybeSingle();
    if (updated.error) return jsonError("Opslaan is mislukt. De wijziging is niet bevestigd.", 503);
    if (!updated.data) return jsonError("Iemand anders heeft de lijst gewijzigd. Controleer de nieuwste versie en probeer opnieuw.", 409);
    return Response.json({ list: updated.data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Productie opslaan is mislukt.");
  }
}
