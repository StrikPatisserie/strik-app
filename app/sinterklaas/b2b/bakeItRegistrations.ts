import type { ProductionTotal, ProductionTotals } from "./productionTotals";

export type BakeItRegistration = {
  id: string; productKey: string; product: string; unit: ProductionTotal["unit"];
  quantity: number; date: string; allocations: { orderId: string; quantity: number }[];
  createdAt: string; createdBy: string; updatedAt: string; updatedBy: string; removed: boolean;
};
export type BakeItState = {
  version: 1; revision: number; registrations: BakeItRegistration[];
  history: { operationId: string; registrationId: string; quantity: number; date: string; removed: boolean; at: string; by: string }[];
};
export type BakeItCommand = {
  operationId: string; registrationId?: string; productKey: string;
  quantity: number; date: string; remove?: boolean; demandVersion: string;
};
export const emptyBakeItState = (): BakeItState => ({ version: 1, revision: 0, registrations: [], history: [] });
export class BakeItError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function bakeItDemandVersion(group: ProductionTotal) {
  return JSON.stringify(group.allocations.map(item => [item.orderId, item.quantity]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}
export function bakeItProgress(group: ProductionTotal, state: BakeItState, exceptId = "") {
  const demand = new Map(group.allocations.map(item => [item.orderId, item.quantity]));
  const covered = new Map<string, number>();
  const rowPlanned = new Map<string, number>();
  const registrations = state.registrations.filter(row => row.productKey === group.key && !row.removed && row.id !== exceptId);
  for (const row of registrations) for (const part of row.allocations) {
    const before = covered.get(part.orderId) || 0;
    const after = Math.min(demand.get(part.orderId) || 0, before + part.quantity);
    covered.set(part.orderId, after);
    rowPlanned.set(row.id, (rowPlanned.get(row.id) || 0) + after - before);
  }
  const planned = [...covered.values()].reduce((sum, value) => sum + value, 0);
  return { registrations, covered, rowPlanned, planned, remaining: Math.max(0, group.quantity - planned) };
}

/** Retain the original order allocation: completed/cancelled orders never fund new demand. */
export function applyBakeItCommand(state: BakeItState, command: BakeItCommand, totals: ProductionTotals, actor: string, now: string): BakeItState {
  if (!command || typeof command.operationId !== "string" || !/^[0-9a-f-]{36}$/i.test(command.operationId) || typeof command.productKey !== "string" || typeof command.demandVersion !== "string" || (command.registrationId !== undefined && typeof command.registrationId !== "string") || (command.remove !== undefined && typeof command.remove !== "boolean")) throw new BakeItError("Ongeldige registratie.");
  if (state.history.some(event => event.operationId === command.operationId)) return state;
  const previous = command.registrationId ? state.registrations.find(row => row.id === command.registrationId && !row.removed) : undefined;
  if (command.registrationId && !previous) throw new BakeItError("Deze registratie is intussen verwijderd. Ververs de opteller.", 409);
  const group = totals.products.find(item => item.key === command.productKey);
  if (!group || (previous && previous.productKey !== group.key)) throw new BakeItError("Deze productvraag is veranderd of al klaar. Ververs de opteller.", 409);
  if (command.demandVersion !== bakeItDemandVersion(group)) throw new BakeItError("De bestellingen zijn intussen gewijzigd. Ververs de opteller en controleer het aantal.", 409);
  if (command.remove && !previous) throw new BakeItError("Kies een bestaande registratie.");
  if (!command.remove && (!Number.isSafeInteger(command.quantity) || command.quantity < 1 || command.quantity > 1000000)) throw new BakeItError("Vul een heel aantal groter dan nul in.");
  if (!command.remove && (!/^20\d{2}-\d{2}-\d{2}$/.test(command.date || "") || !Number.isFinite(Date.parse(`${command.date}T12:00:00Z`)) || new Date(`${command.date}T12:00:00Z`).toISOString().slice(0, 10) !== command.date)) throw new BakeItError("Kies een geldige productiedatum in Bake-it.");
  const quantity = command.remove ? 0 : command.quantity;
  // Preserve even allocations to orders no longer visible. Only an explicit
  // increase may allocate additional pieces to currently uncovered orders.
  let remaining = quantity;
  const allocations: BakeItRegistration["allocations"] = [];
  for (const old of previous?.allocations || []) {
    const take = Math.min(old.quantity, remaining);
    if (take) allocations.push({ orderId: old.orderId, quantity: take });
    remaining -= take;
  }
  const progress = bakeItProgress(group, state, previous?.id);
  for (const demand of group.allocations) {
    const already = allocations.find(part => part.orderId === demand.orderId)?.quantity || 0;
    const take = Math.min(remaining, Math.max(0, demand.quantity - (progress.covered.get(demand.orderId) || 0) - already));
    if (take) {
      const part = allocations.find(item => item.orderId === demand.orderId);
      if (part) part.quantity += take; else allocations.push({ orderId: demand.orderId, quantity: take });
    }
    remaining -= take;
  }
  if (remaining) throw new BakeItError("Dit is meer dan er nog ingepland moet worden. Controleer de bestaande Bake-it-registraties.");
  const row: BakeItRegistration = {
    id: previous?.id || command.operationId, productKey: group.key, product: group.product, unit: group.unit,
    quantity, date: command.remove ? previous!.date : command.date, allocations,
    createdAt: previous?.createdAt || now, createdBy: previous?.createdBy || actor,
    updatedAt: now, updatedBy: actor, removed: !!command.remove,
  };
  return {
    version: 1, revision: state.revision + 1,
    registrations: previous ? state.registrations.map(item => item.id === previous.id ? row : item) : [...state.registrations, row],
    history: [...state.history, { operationId: command.operationId, registrationId: row.id, quantity, date: row.date, removed: row.removed, at: now, by: actor }],
  };
}

export function readBakeItState(raw: unknown): BakeItState {
  if (raw == null) return emptyBakeItState();
  const state = raw as BakeItState;
  if (state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0 || !Array.isArray(state.registrations) || !Array.isArray(state.history)
    || state.registrations.some(row => !row || typeof row.id !== "string" || typeof row.productKey !== "string" || !Number.isSafeInteger(row.quantity) || row.quantity < 0 || !Array.isArray(row.allocations) || row.allocations.some(part => !part || typeof part.orderId !== "string" || !Number.isSafeInteger(part.quantity) || part.quantity < 1))
    || state.history.some(event => !event || typeof event.operationId !== "string")) throw new BakeItError("De Bake-it-registraties konden niet veilig worden gelezen.", 503);
  return state;
}
