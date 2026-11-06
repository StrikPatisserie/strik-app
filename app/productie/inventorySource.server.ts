import "server-only";
import {createAdminClient} from "../lib/supabase/admin";
import {readOperational,saveOperational} from "./operationalStore.server";
import {dispatchDay,dispatchDaysFromBatches,mergeDispatchDays,DISPATCH_PREFIX,type DispatchDay} from "./inventory";
import type {LogisticsBatch} from "../bakkerij/logistiek/logisticsTypes";
import {ProductionStoreError} from "./documents.server";
type DispatchArchive={revision:number;days:DispatchDay[]};

export async function inventoryDispatchDays(){
 const [archive,recent]=await Promise.all([
  createAdminClient().from("app_settings").select("value").like("key",`${DISPATCH_PREFIX}%`),
  readOperational<{batches:LogisticsBatch[]}>("bakery_logistics_batches",{batches:[]}),
 ]);
 if(archive.error)throw new ProductionStoreError("De uitgiftehistorie is niet bereikbaar.");
 const days=(archive.data||[]).flatMap(row=>(row.value as unknown as DispatchArchive).days);
 if(days.some(day=>!day||!Array.isArray(day.lines))||!Array.isArray(recent.batches))throw new ProductionStoreError("De bonnenbron moet worden gecontroleerd.");
 return mergeDispatchDays(days,dispatchDaysFromBatches(recent.batches));
}
/** Replace a day snapshot, never increment it. Reimports/corrections cannot
 * double-count, and aggregates survive the logistics screen's 80-batch limit.
 * No customer names, addresses, mail content or prices enter this archive. */
export async function archiveInventoryDispatch(batch:LogisticsBatch){
 const day=dispatchDay(batch);if(!day)return;
 await archiveInventoryDays([day]);
}
export async function archiveInventoryDays(incoming:DispatchDay[]){
 const months=[...new Set(incoming.map(day=>day.date.slice(0,7)))];
 for(const month of months)await archiveMonth(month,incoming.filter(day=>day.date.startsWith(month)));
}
async function archiveMonth(month:string,incoming:DispatchDay[]){
 const key=DISPATCH_PREFIX+month;
 for(let attempt=0;attempt<3;attempt++){
  const old=await readOperational<DispatchArchive>(key,{revision:0,days:[]});
  const days=mergeDispatchDays(old.days,incoming);if(JSON.stringify(days)===JSON.stringify(old.days))return;
  try{await saveOperational(key,old.revision,{revision:old.revision+1,days},null);return;}
  catch(error){if(!(error instanceof ProductionStoreError)||error.status!==409||attempt===2)throw error;}
 }
}
