import "server-only";
import { readEditBase, retryConcurrentSave } from "./concurrentEditing.server";
import { ConcurrentChangeError, mergeConcurrentChanges } from "./concurrentChanges";
import {canManageWeeklyOffers,weeklyOffersChanged} from "../lib/auth/weeklyOffers";
import type { RecepturenData } from "../bakkerij/recepturen/recepturenApi";
import { recipeDataForProduction, mergeProductionUpdates } from "../bakkerij/recepturen/recipeAccess";
import { hasFullAccess } from "../lib/auth/access";
import type { UserProfile } from "../lib/supabase/types";
import { ProductionStoreError, readDocument, saveDocument, type ProductionDocument } from "./documents.server";

export async function sharedRecipes(profile: UserProfile) {
  const stored = await readDocument<RecepturenData>("recipes");
  if (!stored) return null;
  return { ...(hasFullAccess(profile) ? stored.data : recipeDataForProduction(stored.data)), financialAccess:hasFullAccess(profile), storageRevision:stored.revision, storageProvider:"supabase" };
}
export function mergeRecipeSave(current: RecepturenData,incoming: RecepturenData,profile:UserProfile) {
  const merged = hasFullAccess(profile) ? {...current,...incoming} : mergeProductionUpdates(current,incoming);
  // Older clients prune their display of invoice/order history. Keep records
  // omitted by that display instead of deleting the imported source history.
  function preserve<T extends {id:string}>(old:T[],next:T[]) { const ids=new Set(next.map(i=>i.id)); return [...next,...old.filter(i=>!ids.has(i.id))]; }
  merged.invoiceImports=preserve(current.invoiceImports || [],merged.invoiceImports || []);
  merged.hefeOrderHistory=preserve(current.hefeOrderHistory || [],merged.hefeOrderHistory || []);
  merged.updatedAt=new Date().toISOString();
  delete merged.storageRevision;
  delete merged.financialAccess;
  return merged;
}
export async function saveSharedRecipes(current:ProductionDocument<RecepturenData>,incoming:RecepturenData,profile:UserProfile) {
  const base = await readEditBase(current, "recipes", incoming.storageRevision!);
  for (const key of ["recipes","ingredients","packagingItems"] as const) {
    const list=incoming[key];
    if (list && (new Set(list.map(i=>i.id)).size!==list.length || list.some(i=>typeof i.id!=="string" || !i.id))) throw new ProductionStoreError("Opslaan geblokkeerd: een onderdeel-ID ontbreekt of komt dubbel voor.",400);
    const before=base[key]?.length || 0, after=list?.length ?? before;
    if (hasFullAccess(profile) && before>=50 && before-after>=10 && after<before*.85) throw new ProductionStoreError("Opslaan geblokkeerd: er ontbreken veel bestaande recepten of grondstoffen. Ververs de pagina.",409);
  }
  if(!canManageWeeklyOffers(profile)&&weeklyOffersChanged(base,incoming))throw new ProductionStoreError("Alleen Feline kan weekaanbiedingen beheren.",403);
  const edited = mergeRecipeSave(base,incoming,profile);
  // Document timestamps belong to the successful shared save, not the form.
  edited.updatedAt = base.updatedAt;
  let latest = current;
  let firstAttempt = true;
  return retryConcurrentSave(async () => {
    if (!firstAttempt) {
      const stored = await readDocument<RecepturenData>("recipes");
      if (!stored) throw new ProductionStoreError("De receptuurcollectie kon niet worden geladen.");
      latest = stored;
    }
    firstAttempt = false;
    let data: RecepturenData;
    try { data = mergeConcurrentChanges(base, edited, latest.data); }
    catch (error) {
      if (error instanceof ConcurrentChangeError) throw new ProductionStoreError(error.message, 409);
      throw error;
    }
    data = {...data, updatedAt:new Date().toISOString()};
    const revision=await saveDocument("recipes",latest.revision,data,profile.id,"Recepturen bijgewerkt");
    return {...(hasFullAccess(profile)?data:recipeDataForProduction(data)),financialAccess:hasFullAccess(profile),storageRevision:revision,storageProvider:"supabase"};
  });
}
