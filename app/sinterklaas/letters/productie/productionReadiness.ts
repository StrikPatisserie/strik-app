import { productionChanges, reviseProductionRows } from "./productionChecklist";
import { combinedProductionRows, type ProductionSupplement } from "./productionSupplements";
import type { ProductionSeedRow } from "./productionSources";

/** Partial shared batches cannot identify which customer's letters are made. */
export function readyProductionRecipients(batches: { id: string; rows: ProductionSeedRow[] }[], lists: { batch_id: string; rows: ProductionSeedRow[]; supplements?: ProductionSupplement[]; locked_at?: string | null }[], expectedQuantities: Record<string, number> = {}) {
  const recipients = new Map<string, boolean>();
  const quantities = new Map<string, number>();
  for (const batch of batches) {
    const saved = lists.find(list => list.batch_id === batch.id);
    const mainRows = saved?.locked_at === null ? reviseProductionRows(saved.rows, batch.rows) : saved?.rows || [];
    const runs = [mainRows, ...(saved?.supplements || []).map(item => item.rows)];
    const combined = combinedProductionRows(mainRows, saved?.supplements);
    for (const row of combinedProductionRows(batch.rows)) {
      const frozen = combined.find(item => item.key === row.key);
      const matches = Boolean(frozen?.recipients && productionChanges([frozen], [row]).length === 0);
      for (const recipient of row.recipients || []) {
        if (recipient.quantity <= 0 || recipient.source === "voorraad") continue;
        const allocated = runs.flatMap(run => run.filter(item => item.key === row.key && item.recipients?.some(person => person.id === recipient.id && person.quantity > 0)));
        const ready = matches && allocated.length > 0 && allocated.every(item => item.produced >= item.orders + item.stock);
        quantities.set(recipient.id, (quantities.get(recipient.id) || 0) + recipient.quantity);
        recipients.set(recipient.id, (recipients.get(recipient.id) ?? true) && ready);
      }
    }
  }
  return new Set([...recipients].filter(([id, ready]) => ready && (expectedQuantities[id] === undefined || quantities.get(id) === expectedQuantities[id])).map(([id]) => id));
}
