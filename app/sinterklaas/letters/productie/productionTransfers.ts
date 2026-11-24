import type { ProductionHistory } from "./productionChecklist";
import type { ProductionSupplement } from "./productionSupplements";
import { addProductionOrderQuantity, type ProductionRecipient, type ProductionSeedRow } from "./productionSources";

export const localProductionSupplements = (supplements: ProductionSupplement[] = []) => supplements.filter(part => !part.targetBatchId);
const identity = (row: ProductionSeedRow, person: ProductionRecipient) => JSON.stringify([row.key, person.source, person.id, person.combinationProduct || ""]);

// A transfer records only the extra allocation. The original printed run stays
// intact, even when one customer's order is split over multiple production days.
export function routeProductionSupplements<T extends { id: string; rows: ProductionSeedRow[] }>(batches: T[], history: ProductionHistory[]): T[] {
  const result: T[] = batches.map(batch => ({ ...batch, rows: batch.rows.map(row => ({ ...row, orderSources: { ...row.orderSources }, recipients: row.recipients?.map(person => ({ ...person })) })) }));
  const byId = new Map(result.map(batch => [batch.id, batch]));
  for (const list of history) {
    const source = byId.get(list.batch_id);
    if (!source) continue;
    // Reserve earlier snapshots before moving any remaining demand. A reduction
    // must not take letters away from an already printed/produced allocation.
    const reserved = new Map<string, number>();
    for (const row of [...list.rows, ...localProductionSupplements(list.supplements).flatMap(part => part.rows)]) {
      for (const person of row.recipients || []) {
        const key = identity(row, person);
        reserved.set(key, (reserved.get(key) || 0) + person.quantity);
      }
    }
    for (const part of list.supplements || []) {
      if (!part.targetBatchId) continue;
      const target = byId.get(part.targetBatchId);
      if (!target || target === source) throw new Error("De gekoppelde hoofdproductiedag ontbreekt. Controleer de productieplanning.");
      for (const allocation of part.rows) {
        const row = source.rows.find(item => item.key === allocation.key);
        if (!row) continue;
        for (const planned of allocation.recipients || []) {
          if (planned.source === "voorraad") continue;
          const key = identity(allocation, planned);
          const people = (row.recipients || []).filter(person => identity(row, person) === key);
          const available = people.reduce((sum, person) => sum + person.quantity, 0);
          const quantity = Math.min(planned.quantity, Math.max(0, available - (reserved.get(key) || 0)));
          if (!quantity) continue;
          let remaining = quantity;
          for (const person of people) {
            const take = Math.min(remaining, person.quantity);
            person.quantity -= take;
            remaining -= take;
          }
          row.orders -= quantity;
          row.orderSources![planned.source] = Math.max(0, (row.orderSources?.[planned.source] || 0) - quantity);
          const index = target.rows.findIndex(item => item.key === row.key);
          const current = target.rows[index] || { key: row.key, label: row.label, orders: 0, stock: 0, produced: 0 };
          const moved = addProductionOrderQuantity(current, planned.source, quantity, people[0]);
          if (index < 0) target.rows.push(moved); else target.rows[index] = moved;
        }
        row.recipients = row.recipients?.filter(person => person.quantity > 0);
      }
    }
    source.rows = source.rows.filter(row => row.orders + row.stock > 0 || row.produced > 0);
  }
  return result;
}

// Freezing the destination must not re-infer the whole original order there.
export function transferredProductionOrigins(history: ProductionHistory[]) {
  const origins = new Map<string, string>();
  for (const list of history) for (const part of list.supplements || []) {
    if (part.targetBatchId) for (const row of part.rows) for (const person of row.recipients || []) origins.set(person.id, list.batch_id);
  }
  return origins;
}
