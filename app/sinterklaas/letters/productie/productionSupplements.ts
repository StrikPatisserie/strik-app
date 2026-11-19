import { productionPlanVersion, reviseProductionRows } from "./productionChecklist";
import { aggregateProductionRows, productionRecipientVersion, type ProductionRecipient, type ProductionSeedRow } from "./productionSources";

type ProductionSupplementRecord = {
  id: string;
  name: string;
  date: string;
  rows: ProductionSeedRow[];
  createdAt: string;
  createdBy: string | null;
  createdByName: string;
  planRevision: number;
};

export type ProductionSupplement = ProductionSupplementRecord & {
  // Original lists remain traceable after merging. These snapshots never add to demand.
  mergedLists?: ProductionSupplementRecord[];
};

export type ProductionCustomerChange = {
  id: string;
  customerName: string;
  code?: string;
  source: string;
  deliveryDate?: string;
  extra: number;
  items: { key: string; label: string; before: number; after: number; recipient?: ProductionRecipient }[];
};

function recipientKey(recipient: ProductionRecipient) {
  return JSON.stringify([recipient.source, recipient.id, recipient.combinationProduct || ""]);
}

// A customer's allocation may be split over the original run and several extras.
// Compare their combined demand, independently of that split.
export function combinedProductionRows(rows: ProductionSeedRow[], supplements: ProductionSupplement[] = []) {
  return aggregateProductionRows([...rows, ...supplements.flatMap(item => item.rows)]).map(row => {
    if (!row.recipients) return row;
    const recipients = new Map<string, ProductionRecipient>();
    for (const recipient of row.recipients) {
      const key = recipientKey(recipient);
      const previous = recipients.get(key);
      recipients.set(key, { ...recipient, quantity: recipient.quantity + (previous?.quantity || 0) });
    }
    return { ...row, recipients: [...recipients.values()] };
  });
}

// One extra run per date within the original production round. Keep the first
// identifier so its checklist/print links remain stable, and sum actual production.
export function mergeProductionSupplementsByDate(supplements: ProductionSupplement[]) {
  const byDate = new Map<string, ProductionSupplement>();
  const originalLists = (item: ProductionSupplement): ProductionSupplementRecord[] => {
    if (item.mergedLists) return item.mergedLists;
    return [{ id: item.id, name: item.name, date: item.date, rows: item.rows, createdAt: item.createdAt, createdBy: item.createdBy, createdByName: item.createdByName, planRevision: item.planRevision }];
  };
  for (const item of supplements) {
    const existing = byDate.get(item.date);
    byDate.set(item.date, existing ? {
      ...existing,
      rows: combinedProductionRows([...existing.rows, ...item.rows]),
      planRevision: Math.max(existing.planRevision, item.planRevision) + 1,
      mergedLists: [...originalLists(existing), ...originalLists(item)],
    } : item);
  }
  return [...byDate.values()];
}

export function productionCustomerChanges(saved: ProductionSeedRow[], current: ProductionSeedRow[]) {
  const groups = new Map<string, ProductionCustomerChange>();
  const oldRows = new Map(saved.map(row => [row.key, row]));
  const newRows = new Map(current.map(row => [row.key, row]));
  for (const key of new Set([...oldRows.keys(), ...newRows.keys()])) {
    const old = oldRows.get(key), next = newRows.get(key);
    if (old && old.orders > 0 && !old.recipients) continue;
    const oldRecipients = new Map((old?.recipients || []).map(item => [recipientKey(item), item]));
    const newRecipients = new Map((next?.recipients || []).map(item => [recipientKey(item), item]));
    for (const identity of new Set([...oldRecipients.keys(), ...newRecipients.keys()])) {
      const before = oldRecipients.get(identity), after = newRecipients.get(identity);
      const template = next || old!;
      const beforeVersion = productionRecipientVersion({ ...template, recipients: before ? [before] : [] });
      const afterVersion = productionRecipientVersion({ ...template, recipients: after ? [after] : [] });
      if (beforeVersion === afterVersion) continue;
      const recipient = after || before!;
      const id = `${recipient.source}:${recipient.id}`;
      const group = groups.get(id) || { id, customerName: recipient.customerName, code: recipient.code, source: recipient.source, deliveryDate: recipient.date, extra: 0, items: [] };
      group.items.push({ key, label: next?.label || old!.label, before: before?.quantity || 0, after: after?.quantity || 0, recipient: after });
      group.extra += Math.max(0, (after?.quantity || 0) - (before?.quantity || 0));
      groups.set(id, group);
    }
  }
  return [...groups.values()].sort((a, b) => a.customerName.localeCompare(b.customerName, "nl"));
}

// A frozen list is a production record, not a live shopping basket. Only extra
// demand can be scheduled separately; fulfilment and reductions never revise it.
export function pendingProductionOrders(saved: ProductionSeedRow[], current: ProductionSeedRow[]): ProductionCustomerChange[] {
  return productionCustomerChanges(saved, current).flatMap(group => {
    const items = group.items.filter(item => item.after > item.before);
    return items.length ? [{ ...group, items, extra: items.reduce((sum, item) => sum + item.after - item.before, 0) }] : [];
  });
}

export function productionChecklistView(list: { rows: ProductionSeedRow[]; supplements?: ProductionSupplement[]; revision: number; plan_revision: number; locked_at: string | null; updated_at: string }, current: ProductionSeedRow[]) {
  const supplements = mergeProductionSupplementsByDate(list.supplements || []);
  const combined = combinedProductionRows(list.rows, supplements);
  return {
    revision: list.revision, planRevision: list.plan_revision,
    planVersion: productionPlanVersion(current), lockedAt: list.locked_at,
    updatedAt: list.updated_at, supplements,
    changes: [],
    orderChanges: [],
    pendingOrderChanges: list.locked_at ? pendingProductionOrders(combined, combinedProductionRows(current)) : [],
  };
}

export function createProductionSupplement(rows: ProductionSeedRow[], supplements: ProductionSupplement[], current: ProductionSeedRow[], selectedCustomers: string[], details: Omit<ProductionSupplement, "rows" | "name" | "planRevision">) {
  const changes = pendingProductionOrders(combinedProductionRows(rows, supplements), combinedProductionRows(current));
  const selected = new Set(selectedCustomers);
  if (!selected.size || selected.size !== selectedCustomers.length || [...selected].some(id => !changes.some(item => item.id === id && item.extra > 0))) {
    throw new Error("Kies klanten met extra letters. Controleer de nieuwste wijzigingen.");
  }
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date(details.createdAt));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(details.date) || !Number.isFinite(Date.parse(details.date)) || new Date(`${details.date}T12:00:00Z`).toISOString().slice(0, 10) !== details.date || details.date < today) {
    throw new Error("Kies een geldige productiedag vanaf vandaag.");
  }
  const extraRows: ProductionSeedRow[] = [];
  for (const group of changes.filter(item => selected.has(item.id))) {
    if (group.deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(group.deliveryDate) && details.date > group.deliveryDate) throw new Error(`Kies voor ${group.customerName} een productiedag uiterlijk op de leverdatum.`);
    for (const item of group.items) {
      const quantity = item.after - item.before;
      if (quantity <= 0 || !item.recipient || item.recipient.source === "voorraad") continue;
      extraRows.push({ key: item.key, label: item.label, orders: quantity, stock: 0, produced: 0, orderSources: { [item.recipient.source]: quantity }, recipients: [{ ...item.recipient, quantity }] });
    }
  }
  if (!extraRows.length) throw new Error("Er zijn geen extra letters om in te plannen.");
  return { ...details, name: `Aanvulling ${supplements.length + 1}`, rows: combinedProductionRows(extraRows), planRevision: 1 };
}

function demandRow(template: ProductionSeedRow, recipients: ProductionRecipient[], orders: number, stock: number) {
  const orderSources: ProductionSeedRow["orderSources"] = {};
  for (const item of recipients) if (item.source !== "voorraad") orderSources[item.source] = (orderSources[item.source] || 0) + item.quantity;
  const attributed = recipients.filter(item => item.source !== "voorraad").reduce((sum, item) => sum + item.quantity, 0);
  if (orders > attributed) orderSources.onbekend = (orderSources.onbekend || 0) + orders - attributed;
  return { ...template, orders, stock, orderSources, ...(template.recipients || recipients.length ? { recipients } : {}) };
}

// Reconcile demand within the existing allocations first. Actual made quantities
// stay on their own run, including any surplus after a cancellation.
export function reviseProductionAllocations(rows: ProductionSeedRow[], supplements: ProductionSupplement[], current: ProductionSeedRow[]) {
  if (!supplements.length) return { rows: reviseProductionRows(rows, current), supplements };
  const runs = [rows, ...supplements.map(item => item.rows)];
  const revised: ProductionSeedRow[][] = runs.map(() => []);
  const currentRows = new Map(combinedProductionRows(current).map(row => [row.key, row]));
  const keys = new Set([...runs.flatMap(run => run.map(row => row.key)), ...currentRows.keys()]);
  for (const key of keys) {
    const live = currentRows.get(key);
    const old = runs.map(run => run.find(row => row.key === key));
    const allocations: ProductionRecipient[][] = runs.map(() => []);
    for (const recipient of live?.recipients || []) {
      let remaining = recipient.quantity;
      old.forEach((row, index) => {
        const capacity = (row?.recipients || []).filter(item => recipientKey(item) === recipientKey(recipient)).reduce((sum, item) => sum + item.quantity, 0);
        const quantity = Math.min(remaining, capacity);
        if (quantity > 0) allocations[index].push({ ...recipient, quantity });
        remaining -= quantity;
      });
      if (remaining > 0) allocations[0].push({ ...recipient, quantity: remaining });
    }
    // Store stock is separate demand, never an unattributed customer order.
    const customerQuantity = (recipients: ProductionRecipient[]) => recipients.filter(item => item.source !== "voorraad").reduce((sum, item) => sum + item.quantity, 0);
    let unknown = Math.max(0, (live?.orders || 0) - customerQuantity(live?.recipients || []));
    old.forEach((row, index) => {
      const known = customerQuantity(allocations[index]);
      const capacity = Math.max(0, (row?.orders || 0) - customerQuantity(row?.recipients || []));
      const unknownHere = index === 0 ? 0 : Math.min(unknown, capacity);
      unknown -= unknownHere;
      const orders = known + unknownHere;
      const stock = index === 0 ? live?.stock || 0 : 0;
      if (orders + stock > 0 || (row?.produced || 0) > 0 || index === 0 && live) {
        const template = { ...(live || row!), produced: row?.produced || 0 };
        revised[index].push(demandRow(template, allocations[index], orders, stock));
      }
    });
    if (unknown > 0) {
      const main = revised[0].find(row => row.key === key);
      if (main) { main.orders += unknown; main.orderSources = { ...main.orderSources, onbekend: (main.orderSources?.onbekend || 0) + unknown }; }
      else revised[0].push(demandRow({ ...live!, produced: old[0]?.produced || 0 }, [], unknown, live?.stock || 0));
    }
  }
  return { rows: revised[0], supplements: supplements.map((item, index) => ({ ...item, rows: revised[index + 1], planRevision: item.planRevision + 1 })) };
}
