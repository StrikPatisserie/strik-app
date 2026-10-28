import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";

export type ProductionDocument<T> = { key: string; data: T; revision: number; updated_at: string; updated_by: string | null };
export class ProductionStoreError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
function db() { return createAdminClient() as unknown as SupabaseClient; }
export async function readDocument<T>(key: "recipes" | "planner"): Promise<ProductionDocument<T> | null> {
  const result = await db().from("production_documents").select("key,data,revision,updated_at,updated_by").eq("key", key).maybeSingle();
  if (result.error) throw new ProductionStoreError("De gedeelde productieopslag is tijdelijk niet bereikbaar. Er is niets gewijzigd.");
  return result.data as ProductionDocument<T> | null;
}
export async function saveDocument(key: "recipes" | "planner", revision: number, data: unknown, actor: string, reason: string) {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new ProductionStoreError("Ververs deze pagina om met de actuele gedeelde gegevens te werken.", 409);
  const result = await db().rpc("production_save_document", { p_key: key, p_revision: revision, p_data: data, p_actor: actor, p_reason: reason });
  if (result.error) throw new ProductionStoreError(result.error.code === "40001" ? "Iemand heeft deze gegevens intussen gewijzigd. Ververs de pagina; je wijziging is niet opgeslagen." : "Opslaan is niet gelukt. Je wijziging is niet opgeslagen.", result.error.code === "40001" ? 409 : 503);
  return Number(result.data);
}
export async function importWordPressDocument(input: { data: unknown; planner: unknown; snapshot: unknown; hash: string; report: unknown; actor: string }) {
  const result = await db().rpc("production_import_wordpress", { p_data: input.data, p_planner: input.planner, p_snapshot: input.snapshot, p_hash: input.hash, p_report: input.report, p_actor: input.actor });
  if (result.error) throw new ProductionStoreError(result.error.code === "40001" ? "De recepten zijn al overgezet; de bestaande gegevens blijven behouden." : "De overdracht is niet opgeslagen. De bestaande gegevens blijven behouden.", result.error.code === "40001" ? 409 : 503);
}
export async function saveRecipePlanDocument(revision:number,recipeRevision:number,data:unknown,actor:string) {
  const result=await db().rpc("production_save_recipe_plan",{p_revision:revision,p_recipe_revision:recipeRevision,p_data:data,p_actor:actor});
  if(result.error)throw new ProductionStoreError(result.error.code==="40001"?"De planning of recepten zijn intussen gewijzigd. Ververs het voorstel; er is niets opgeslagen.":"De productieopdracht is niet opgeslagen.",result.error.code==="40001"?409:503);
  return Number(result.data);
}
