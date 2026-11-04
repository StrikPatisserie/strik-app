import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { loadProductionWordPressOrders } from "../../sinterklaasServerApi";
import { loadCentralProduction } from "./productionData.server";
import { combineProductionOrders } from "./productionChecklist";
import { readyProductionRecipients } from "./productionReadiness";
import type { ProductionSeedRow } from "./productionSources";

export async function loadReadyProductionRecipients(season:string) {
  if(!/^20\d{2}$/.test(season))return new Set<string>();
  const [central,wordpress]=await Promise.all([loadCentralProduction(season,true),loadProductionWordPressOrders(season)]);
  const {batches}=combineProductionOrders(central.batches,wordpress.letters,wordpress.b2b,central.assignments);
  if(!batches.length)return new Set<string>();
  const result=await (createAdminClient() as unknown as SupabaseClient).from("letter_production_checklists").select("batch_id,rows").in("batch_id",batches.map(batch=>batch.id));
  if(result.error)throw Error("Productievoortgang kon niet worden gecontroleerd.");
  return readyProductionRecipients(batches,result.data as {batch_id:string;rows:ProductionSeedRow[]}[],central.orderQuantities);
}

// Only enrich an already authorized, shop-scoped response. No source orders or
// private production snapshots are returned to the caller.
export async function withProductionReadiness(response:Response,season:string,source:"wordpress"|"b2b") {
  if(!response.ok)return response;
  try {
    const data=await response.clone().json();
    if(!Array.isArray(data.orders))return response;
    const ready=await loadReadyProductionRecipients(season);
    return Response.json({...data,orders:data.orders.map((order:{id:string})=>({...order,productionChecklistReady:ready.has(`${source}:${order.id}`)}))},{headers:{"Cache-Control":"no-store"}});
  } catch { return response; } // An unavailable checklist must never invent "Klaar".
}
