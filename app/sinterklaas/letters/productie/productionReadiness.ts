import { productionChanges } from "./productionChecklist";
import type { ProductionSeedRow } from "./productionSources";

/** A shared product row cannot be assigned to a particular customer until all
 * demand on that row is made. Never infer readiness from a partial quantity. */
export function readyProductionRecipients(batches: {id:string;rows:ProductionSeedRow[]}[], lists:{batch_id:string;rows:ProductionSeedRow[]}[], expectedQuantities:Record<string,number> = {}) {
  const recipients=new Map<string,boolean>();
  const quantities=new Map<string,number>();
  for(const batch of batches) {
    const saved=lists.find(list=>list.batch_id===batch.id);
    for(const row of batch.rows) {
      const frozen=saved?.rows.find(item=>item.key===row.key);
      const ready=Boolean(frozen && frozen.recipients && productionChanges([frozen],[row]).length===0 && frozen.produced>=row.orders+row.stock);
      for(const recipient of row.recipients||[]) {
        if(recipient.quantity<=0 || recipient.source==="voorraad")continue;
        quantities.set(recipient.id,(quantities.get(recipient.id)||0)+recipient.quantity);
        recipients.set(recipient.id,(recipients.get(recipient.id)??true)&&ready);
      }
    }
  }
  return new Set([...recipients].filter(([id,ready])=>ready && (expectedQuantities[id]===undefined || quantities.get(id)===expectedQuantities[id])).map(([id])=>id));
}
