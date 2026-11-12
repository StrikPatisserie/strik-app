import "server-only";
import { applyVersionPatch } from "./concurrentChanges";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";

export type ProductionDocument<T> = { key: string; data: T; revision: number; updated_at: string; updated_by: string | null };
export class ProductionStoreError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
export class ProductionRevisionError extends ProductionStoreError {
  constructor() { super("Het onderdeel werd net tegelijk opgeslagen. Probeer opnieuw. Je invoer blijft bewaard.", 409); }
}
// Small process-local cache of immutable revisions. Other app instances use
// the same persisted version history when this cache has no matching entry.
const revisions = new Map<string, unknown>();
function rememberRevision(key: string, revision: number, data: unknown) {
  const id = `${key}:${revision}`;
  if (revisions.has(id)) return;
  revisions.set(id, structuredClone(data));
  if (revisions.size > 8) revisions.delete(revisions.keys().next().value!);
}
function db() { return createAdminClient() as unknown as SupabaseClient; }
export async function readDocument<T>(key: "recipes" | "planner"): Promise<ProductionDocument<T> | null> {
  const result = await db().from("production_documents").select("key,data,revision,updated_at,updated_by").eq("key", key).maybeSingle();
  if (result.error) throw new ProductionStoreError("De gedeelde productieopslag is tijdelijk niet bereikbaar. Er is niets gewijzigd.");
  if (result.data) rememberRevision(key, result.data.revision, result.data.data);
  return result.data as ProductionDocument<T> | null;
}
export async function saveDocument(key: "recipes" | "planner", revision: number, data: unknown, actor: string, reason: string) {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new ProductionStoreError("Ververs deze pagina om met de actuele gedeelde gegevens te werken.", 409);
  const result = await db().rpc("production_save_document", { p_key: key, p_revision: revision, p_data: data, p_actor: actor, p_reason: reason });
  if (result.error?.code === "40001") throw new ProductionRevisionError();
  if (result.error) throw new ProductionStoreError("Opslaan is niet gelukt. Je wijziging is niet opgeslagen.");
  return Number(result.data);
}
export async function importWordPressDocument(input: { data: unknown; planner: unknown; snapshot: unknown; hash: string; report: unknown; actor: string }) {
  const result = await db().rpc("production_import_wordpress", { p_data: input.data, p_planner: input.planner, p_snapshot: input.snapshot, p_hash: input.hash, p_report: input.report, p_actor: input.actor });
  if (result.error) throw new ProductionStoreError(result.error.code === "40001" ? "De recepten zijn al overgezet; de bestaande gegevens blijven behouden." : "De overdracht is niet opgeslagen. De bestaande gegevens blijven behouden.", result.error.code === "40001" ? 409 : 503);
}
export async function saveRecipePlanDocument(revision:number,recipeRevision:number,data:unknown,actor:string) {
  const result=await db().rpc("production_save_recipe_plan",{p_revision:revision,p_recipe_revision:recipeRevision,p_data:data,p_actor:actor});
  if(result.error?.code==="40001")throw new ProductionRevisionError();
  if(result.error)throw new ProductionStoreError("De productieopdracht is niet opgeslagen.");
  return Number(result.data);
}
export async function saveQuickRecipeDocument(revision:number,recipeRevision:number,planner:unknown,recipes:unknown,actor:string){
 const result=await db().rpc('production_save_quick_recipe',{p_revision:revision,p_recipe_revision:recipeRevision,p_planner:planner,p_recipes:recipes,p_actor:actor});
 if(result.error?.code==='40001')throw new ProductionRevisionError();
 if(result.error)throw new ProductionStoreError('Het werkrecept is niet opgeslagen.');
}

// Version rows are immutable. Reconstruct only when an editor's revision is old.
// Keyset pagination also covers histories larger than the API's page limit.
export async function readDocumentRevision<T>(key: "recipes" | "planner", revision: number): Promise<T | null> {
  const cached = revisions.get(`${key}:${revision}`);
  if (cached !== undefined) return structuredClone(cached) as T;
  let data: unknown;
  let cursor = 0;
  while (cursor < revision) {
    const result = await db().from("production_document_versions").select("revision,data")
      .eq("document_key", key).gt("revision", cursor).lte("revision", revision)
      .order("revision").limit(500);
    if (result.error) throw new ProductionStoreError("De wijzigingshistorie kon niet worden geladen. Probeer opnieuw.");
    if (!result.data?.length) return null;
    for (const row of result.data) {
      if (row.revision !== cursor + 1) return null;
      if (row.data.format === "snapshot-v1") data = structuredClone(row.data.value);
      else if (row.data.format === "patch-v1" && data !== undefined) data = applyVersionPatch(data, row.data.changes);
      else return null;
      cursor = row.revision;
    }
  }
  if (data !== undefined) rememberRevision(key, revision, data);
  return data === undefined ? null : data as T;
}
