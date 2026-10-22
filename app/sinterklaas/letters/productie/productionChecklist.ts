import { b2bProductionPlan, eligibleB2BLetterOrder, type B2BProductionAssignment } from "./b2bProductionPlanning";
import type { ChocolateLetterLine, ChocolateLetterOrder, SinterklaasB2BOrder } from "../../types";
import type { ProductionBatchSeed } from "./ProductionPlanningClient";
import { addProductionOrderQuantity, productionOrderSource, productionRecipientVersion, type ProductionOrderSource, type ProductionRecipient, type ProductionSeedRow } from "./productionSources";

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function findProductionDate(
  batches: ProductionBatchSeed[],
  requestedDate: string,
  explicitDate = ""
) {
  const explicitBatch = batches.find(
    (batch) => batch.date === explicitDate || batch.startDate === explicitDate
  );
  if (explicitBatch) return explicitBatch.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return "";

  return batches
    .filter(
      (batch) =>
        (batch.pickupFrom || addDays(batch.date, batch.minimumLeadDays)) <=
        requestedDate
    )
    .at(-1)?.date || "";
}

function legacyLineIdentity(line: ChocolateLetterLine) {
  const extras = [
    line.logo ? "logo" : "",
    ...(line.specialRequests || []),
    line.notes.trim(),
  ].filter(Boolean);
  const label = [
    line.letter.toUpperCase(),
    line.chocolate,
    line.size,
    line.style,
    ...extras,
  ].join(" · ");
  const key = [
    line.letter.toUpperCase(),
    line.chocolate,
    line.size,
    line.style,
    ...extras,
  ].join("|").toLocaleLowerCase("nl-NL");

  return { key, label };
}

export function productionDeadlinePassed(batch: Pick<ProductionBatchSeed, "deadlineAt" | "status">, now = Date.now()) {
  return ["COMPLETED", "CLOSED", "IN_PRODUCTION"].includes(batch.status)
    || Boolean(batch.deadlineAt && now >= Date.parse(batch.deadlineAt));
}

export function combineProductionOrders(batches: ProductionBatchSeed[], legacyOrders: ChocolateLetterOrder[], b2bOrders: SinterklaasB2BOrder[], assignments: B2BProductionAssignment[] = []) {
  const rowsByDate = new Map(batches.map(batch => [batch.date, new Map(batch.rows.map(row => [row.key, {...row, orderSources: {...row.orderSources}} as ProductionSeedRow]))]));
  const unplanned: string[] = [];
  const addOrderLine = (date: string, key: string, label: string, quantity: number, source: ProductionOrderSource, recipient: Omit<ProductionRecipient,"source"|"quantity">) => {
    const rows = rowsByDate.get(date);
    if (!rows) return;
    const current = rows.get(key) || { key, label, orders: 0, stock: 0, produced: 0 };
    rows.set(key, addProductionOrderQuantity(current, source, quantity, recipient));
  };

  legacyOrders
    .filter((order) => !order.productionDone && !order.pickedUp && order.status !== "opgehaald" && order.status !== "geannuleerd")
    .forEach((order) => {
      const date = findProductionDate(batches, order.pickupDate);
      if (!date) {
        unplanned.push(`${order.code} · ${order.customerName}`);
        return;
      }
      order.lines.forEach((line) => {
        const identity = legacyLineIdentity(line);
        addOrderLine(date, identity.key, identity.label, line.quantity, productionOrderSource(order.source), {id:`wordpress:${order.id}`,customerName:order.customerName,code:order.code,shop:order.shop || order.pickupLocation,date:order.pickupDate,notes:[order.giftWrap?"Inpakken in cadeaupapier":"",order.notes].filter(Boolean).join(" · ")});
      });
    });

  b2bOrders
    .filter(eligibleB2BLetterOrder)
    .forEach((order) => {
      const plan = b2bProductionPlan(order,batches,assignments);
      const date = batches.find(batch=>batch.id===plan.batchId)?.date || "";
      if (!date) {
        unplanned.push(`B2B · ${order.customerName}`);
        return;
      }
      order.letterLines.forEach((line) => {
        const extras = [order.logo ? "logo" : "", ...line.exceptions].filter(Boolean);
        const label = [line.letter, line.chocolate, line.size, line.style, ...extras].join(" · ");
        const key = [line.letter, line.chocolate, line.size, line.style, ...extras].join("|").toLocaleLowerCase("nl-NL");
        addOrderLine(date, key, label, line.quantity, "b2b", {id:`b2b:${order.id}`,customerName:order.customerName,code:order.folderQuote?.reference || order.id,date:order.deliveryDate,notes:[order.packaging,order.importantNotes].filter(Boolean).join(" · ")});
      });
    });

  const batchViews = batches.map((batch) => ({
    ...batch,
    storeOrders: batch.storeOrders || [],
    rows: [...(rowsByDate.get(batch.date)?.values() || [])],
  }));

  return { batches: batchViews, unplanned, b2bPlanning: b2bOrders.filter(eligibleB2BLetterOrder).map(order=>b2bProductionPlan(order,batches,assignments)) };
}

export type ProductionChange = { key: string; label: string; before: number; after: number; detail: string };
export type ProductionChecklist = { revision: number; planRevision: number; planVersion: string; lockedAt: string; updatedAt: string; changes: ProductionChange[] };

export function productionPlanVersion(rows: ProductionSeedRow[]) {
  return JSON.stringify(rows.filter(row => row.orders + row.stock > 0).map(row => [row.key, row.label, row.orders, row.stock, ...(["winkel", "online", "b2b", "onbekend"] as const).map(source => row.orderSources?.[source] || 0), productionRecipientVersion(row)]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

export function productionChanges(frozen: ProductionSeedRow[], current: ProductionSeedRow[]): ProductionChange[] {
  const oldRows = new Map(frozen.map(row => [row.key, row]));
  const newRows = new Map(current.map(row => [row.key, row]));
  const sources = ["winkel", "online", "b2b", "onbekend"] as const;
  return [...new Set([...oldRows.keys(), ...newRows.keys()])].flatMap(key => {
    const old = oldRows.get(key), next = newRows.get(key);
    const before = (old?.orders || 0) + (old?.stock || 0);
    const after = (next?.orders || 0) + (next?.stock || 0);
    const originChanged = sources.some(source => (old?.orderSources?.[source] || 0) !== (next?.orderSources?.[source] || 0));
    const recipientsChanged = Boolean(old?.recipients && next?.recipients && productionRecipientVersion(old)!==productionRecipientVersion(next));
    if (before === after && (old?.stock || 0) === (next?.stock || 0) && !originChanged && !recipientsChanged) return [];
    return [{key, label: next?.label || old?.label || key, before, after, detail: before === after ? recipientsChanged ? "Verdeling per klant gewijzigd" : "Herkomst of verdeling gewijzigd" : after === 0 ? "Vervallen" : before === 0 ? "Toegevoegd" : "Aantal gewijzigd"}];
  });
}

// Preserve actual production, including letters already made for a cancelled line.
export function reviseProductionRows(frozen: ProductionSeedRow[], current: ProductionSeedRow[]) {
  const oldRows = new Map(frozen.map(row => [row.key, row]));
  const result = current.map(row => ({...row, produced: Math.max(row.produced, oldRows.get(row.key)?.produced || 0)}));
  const keys = new Set(current.map(row => row.key));
  for (const old of frozen) if (!keys.has(old.key) && old.produced > 0) result.push({...old, orders: 0, stock: 0, orderSources: {}, recipients: []});
  return result;
}

export function setProductionQuantity(rows: ProductionSeedRow[], key: string, quantity: number) {
  const selected = rows.find(row => row.key === key);
  if (!selected) throw new Error("Deze letter staat niet op de vastgezette lijst.");
  const maximum = Math.max(selected.orders + selected.stock, selected.produced);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > maximum) throw new Error(`Kies een geheel aantal tussen 0 en ${maximum}.`);
  return rows.map(row => row.key === key ? {...row, produced: quantity} : row);
}

export function productionRemaining(rows: ProductionSeedRow[]) {
  return rows.reduce((total, row) => total + Math.max(0, row.orders + row.stock - row.produced), 0);
}

export function productionTotals(rows: ProductionSeedRow[]) {
  return rows.reduce((total, row) => ({ orders: total.orders + row.orders, stock: total.stock + row.stock, produced: total.produced + row.produced }), { orders: 0, stock: 0, produced: 0 });
}

// Old frozen totals may predate recipient snapshots. Enrich only when every
// quantity and source still agrees; never substitute a changed order silently.
export function hydrateProductionRecipients(frozen:ProductionSeedRow[],current:ProductionSeedRow[]) {
  return frozen.map(row=>{
    const live=current.find(item=>item.key===row.key);
    if(row.recipients || !live || row.orders!==live.orders || row.stock!==live.stock || ["winkel", "online", "b2b", "onbekend"].some(source => (row.orderSources?.[source as ProductionOrderSource] || 0) !== (live.orderSources?.[source as ProductionOrderSource] || 0)))return row;
    return {...row,recipients:live.recipients};
  });
}
