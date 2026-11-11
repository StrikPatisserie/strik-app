import type { SupabaseClient } from "@supabase/supabase-js";
import { hasCronAuthorization } from "@/app/lib/auth/cron";
import { canAccessSinterklaasPath } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { loadProductionWordPressOrders } from "@/app/sinterklaas/sinterklaasServerApi";
import { loadCentralProduction } from "@/app/sinterklaas/letters/productie/productionData.server";
import { combineProductionOrders, hydrateProductionRecipients, productionChanges, productionDeadlinePassed, productionPlanVersion, reviseProductionRows, setProductionQuantity } from "@/app/sinterklaas/letters/productie/productionChecklist";
import type { ProductionSeedRow } from "@/app/sinterklaas/letters/productie/productionSources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SavedChecklist = { batch_id: string; rows: ProductionSeedRow[]; revision: number; plan_revision: number; locked_at: string | null; updated_at: string };
const columns = "batch_id,rows,revision,plan_revision,locked_at,updated_at";
const jsonError = (message: string, status = 400) => Response.json({ message }, { status });

async function loadCurrent(season: string) {
  const [central, wordpress] = await Promise.all([loadCentralProduction(season), loadProductionWordPressOrders(season)]);
  return { ...combineProductionOrders(central.batches, wordpress.letters, wordpress.b2b, central.assignments || []), centralUnplannedCount: central.centralUnplannedCount };
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
    // A provisional list stores actual production while demand remains live.
    // Freeze with a revision check so a simultaneous quantity save survives.
    for (let attempt = 0; productionDeadlinePassed(batch) && !list?.locked_at; attempt++) {
      if (attempt === 3) throw new Error("De voortgang is intussen gewijzigd. Ververs de productielijst.");
      if (list) {
        const frozen = await db.from("letter_production_checklists")
          .update({ rows: reviseProductionRows(list.rows, batch.rows), locked_at: new Date().toISOString(), revision: list.revision + 1, updated_at: new Date().toISOString(), updated_by: actorId })
          .eq("batch_id", batch.id).eq("revision", list.revision);
        if (frozen.error) throw new Error("Vastzetten van de productielijst is mislukt.");
      } else {
        const insert = await db.from("letter_production_checklists").insert({ batch_id: batch.id, rows: batch.rows, updated_by: actorId });
        if (insert.error && insert.error.code !== "23505") throw new Error("Vastzetten van de productielijst is mislukt.");
      }
      const latest = await db.from("letter_production_checklists").select(columns).eq("batch_id", batch.id).single();
      if (latest.error) throw new Error("De productielijst kon niet worden geladen.");
      list = latest.data as SavedChecklist;
    }
    if (!list) return { ...batch, checklist: undefined };
    const rows = list.locked_at ? hydrateProductionRecipients(list.rows, batch.rows) : reviseProductionRows(list.rows, batch.rows);
    return { ...batch, rows, checklist: { revision: list.revision, planRevision: list.plan_revision, planVersion: productionPlanVersion(batch.rows), lockedAt: list.locked_at, updatedAt: list.updated_at, changes: list.locked_at ? productionChanges(rows, batch.rows) : [] } };
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
  if (typeof batchId !== "string" || !/^[0-9a-f-]{36}$/i.test(batchId) || (!Number.isSafeInteger(revision) || Number(revision) < 0) || !["quantity", "revise"].includes(String(action))) return jsonError("Ongeldige productielijst.");
  try {
    const db = createAdminClient() as unknown as SupabaseClient;
    const batchResult = await db.from("letter_production_batches").select("status,order_deadline_at,season").eq("id", batchId).maybeSingle();
    if (batchResult.error) return jsonError("De deadline kon niet worden gecontroleerd.", 503);
    if (!batchResult.data) return jsonError("Productieronde niet gevonden.", 404);
    const stored = await db.from("letter_production_checklists").select(columns).eq("batch_id", batchId).maybeSingle();
    if (stored.error) return jsonError("Voortgang laden is mislukt.", 503);
    const list = stored.data as SavedChecklist | null;
    if ((list?.revision || 0) !== revision) return jsonError("De lijst is intussen gewijzigd. De nieuwste versie wordt geladen. Controleer je wijziging opnieuw.", 409);
    let currentRows: ProductionSeedRow[] | undefined;
    if (!list?.locked_at || action === "revise") {
      const current = await loadCurrent(String(batchResult.data.season));
      const batch = current.batches.find(item => item.id === batchId);
      if (!batch) return jsonError("Productieronde niet gevonden.", 404);
      currentRows = batch.rows;
    }
    let rows = list?.locked_at ? list.rows : reviseProductionRows(list?.rows || [], currentRows!);
    if (action === "quantity") {
      if (typeof key !== "string" || typeof quantity !== "number") return jsonError("Controleer het geproduceerde aantal.");
      rows = setProductionQuantity(rows, key, quantity);
    } else {
      if (!list?.locked_at) return jsonError("Een open productielijst wordt automatisch bijgewerkt.", 409);
      if (data.planVersion !== productionPlanVersion(currentRows!)) return jsonError("De bestellingen zijn opnieuw gewijzigd. Bekijk eerst de nieuwste verschillen.", 409);
      rows = reviseProductionRows(list.rows, currentRows!);
    }
    const now = new Date().toISOString();
    const lockedAt = list?.locked_at || (productionDeadlinePassed({status: batchResult.data.status, deadlineAt: batchResult.data.order_deadline_at}) ? now : null);
    const values = { rows, revision: (list?.revision || 0) + 1, plan_revision: (list?.plan_revision || 1) + (action === "revise" ? 1 : 0), locked_at: lockedAt, updated_at: now, updated_by: profile?.id };
    const updated = list
      ? await db.from("letter_production_checklists").update(values).eq("batch_id", batchId).eq("revision", list.revision).select(columns).maybeSingle()
      : await db.from("letter_production_checklists").insert({ batch_id: batchId, ...values }).select(columns).maybeSingle();
    if (updated.error?.code === "23505") return jsonError("Iemand anders heeft de lijst gewijzigd. Controleer de nieuwste versie en probeer opnieuw.", 409);
    if (updated.error) return jsonError("Opslaan is mislukt. De wijziging is niet bevestigd.", 503);
    if (!updated.data) return jsonError("Iemand anders heeft de lijst gewijzigd. Controleer de nieuwste versie en probeer opnieuw.", 409);
    return Response.json({ list: updated.data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Productie opslaan is mislukt.");
  }
}
