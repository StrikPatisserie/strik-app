import type { SinterklaasB2BOrder } from "../../types";
import type { ProductionBatchSeed } from "./ProductionPlanningClient";
import type { B2BProductionAssignment, B2BProductionPlan } from "./b2bProductionPlanning";
import { combineProductionOrders, productionDeadlinePassed, reviseProductionRows } from "./productionChecklist";
import { combinedProductionRows, mergeProductionSupplementsByDate, type ProductionSupplement } from "./productionSupplements";
import { localProductionSupplements } from "./productionTransfers";
import type { ProductionSeedRow } from "./productionSources";

export type ScheduleChecklist = { batch_id: string; rows: ProductionSeedRow[]; supplements?: ProductionSupplement[]; revision: number; plan_revision: number; locked_at: string | null; updated_at: string };
export const scheduleColumns = "batch_id,rows,supplements,revision,plan_revision,locked_at,updated_at";
const quantityFor = (rows: ProductionSeedRow[], id: string) => rows.reduce((sum, row) => sum + (row.recipients || []).filter(person => person.id === id).reduce((n, person) => n + person.quantity, 0), 0);
const hasOrder = (row: ProductionSeedRow, id: string) => row.recipients?.some(person => person.id === id && person.quantity > 0);
export function b2bScheduleVersion(batches: ProductionBatchSeed[], lists: ScheduleChecklist[]) {
  return JSON.stringify(batches.map(batch => [batch.id, batch.status, batch.deadlineAt || "", lists.find(list => list.batch_id === batch.id)?.revision || 0]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))));
}

// The canonical owner can be an earlier round. Show actual allocations, including
// transfers and extras, rather than using that internal owner as the selected day.
export function projectB2BSchedules(plans: B2BProductionPlan[], batches: ProductionBatchSeed[], lists: ScheduleChecklist[]) {
  const scheduleVersion = b2bScheduleVersion(batches, lists);
  return plans.map(plan => {
    const id = `b2b:${plan.id}`;
    const allocations: {date: string; quantity: number; fixed: boolean; made: boolean; complete: boolean}[] = [];
    for (const batch of batches) {
      const list = lists.find(item => item.batch_id === batch.id);
      const frozen = Boolean(list?.locked_at || productionDeadlinePassed(batch));
      const runs = [{date: batch.startDate, rows: frozen ? list?.rows || [] : reviseProductionRows(list?.rows || [], batch.rows), fixed: frozen},
        ...localProductionSupplements(list?.supplements).map(part => ({date: part.date, rows: part.rows, fixed: Boolean(part.lockedAt)}))];
      for (const run of runs) {
        const rows = run.rows.filter(row => hasOrder(row, id));
        const quantity = quantityFor(rows, id);
        if (quantity) allocations.push({date: run.date, quantity, fixed: run.fixed, made: rows.some(row => row.produced > 0), complete: rows.every(row => row.produced >= row.orders + row.stock)});
      }
    }
    const productionDates = [...new Set(allocations.map(item => item.date))].sort();
    const pendingQuantity = Math.max(0, plan.quantity - allocations.reduce((sum,item) => sum + item.quantity, 0));
    const complete = allocations.length > 0 && !pendingQuantity && allocations.every(item => item.complete);
    const blocked = allocations.some(item => item.fixed || item.made);
    return {...plan, productionDates, scheduledDate: productionDates.length === 1 ? productionDates[0] : "", pendingQuantity, scheduleVersion,
      canReplan: !blocked && !plan.issues?.length,
      planningNote: complete ? "Gemaakt" : blocked ? "Geprint of productie gestart" : productionDates.length ? "Nog te maken" : "Nog niet ingepland"};
  });
}

function removeOrder(rows: ProductionSeedRow[], id: string) {
  if (!rows.some(row => hasOrder(row, id))) return rows;
  return rows.map(row => {
    const quantity = quantityFor([row], id);
    if (!quantity) return row;
    if (row.produced > 0) throw Error("Er zijn al aantallen gemaakt op deze regel. Controleer eerst de productie.");
    return {...row, orders: row.orders - quantity, orderSources: {...row.orderSources, b2b: Math.max(0,(row.orderSources?.b2b || 0) - quantity)}, recipients: row.recipients?.filter(person => person.id !== id)};
  }).filter(row => row.orders + row.stock > 0 || row.produced > 0);
}

export function prepareB2BSchedule(input: {
  order: SinterklaasB2BOrder; batches: ProductionBatchSeed[]; assignments: B2BProductionAssignment[];
  lists: ScheduleChecklist[]; date: string | null; now: string; id: string; actorId: string | null; actorName: string;
}) {
  const {order, batches, assignments, date, now} = input;
  const current = combineProductionOrders(batches, [], [order], assignments, input.lists);
  const plan = projectB2BSchedules(current.b2bPlanning, current.batches, input.lists)[0];
  if (!plan || !plan.canReplan) throw Error(plan?.issues?.length ? "Vul eerst de ontbrekende lettergegevens in." : "Deze letters zijn al geprint of er zijn aantallen gemaakt. De bestaande registratie blijft behouden.");
  const today = new Intl.DateTimeFormat("sv-SE", {timeZone: "Europe/Amsterdam"}).format(new Date(now));
  if (date !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date || date < today || date.slice(0,4) !== order.year)) throw Error("Kies een geldige productiedatum vanaf vandaag binnen dit seizoen.");
  if (date && order.deliveryDate && date > order.deliveryDate) throw Error("Kies een productiedag uiterlijk op de leverdatum.");
  const target = date ? batches.find(batch => batch.startDate === date || batch.date === date) : undefined;
  if (target && (productionDeadlinePassed(target, Date.parse(now)) || input.lists.some(list => list.batch_id === target.id && list.locked_at))) throw Error("Deze hoofdproductiedag staat vast. Kies een open of extra productiedag.");
  if (date && !target && input.lists.some(list => localProductionSupplements(list.supplements).some(part => part.date === date && part.lockedAt))) throw Error("Deze extra productiedag is al geprint. Kies een nieuwe datum.");
  const recipientId = `b2b:${order.id}`;
  const lists = input.lists.map(list => ({...list, rows: removeOrder(list.rows, recipientId), supplements: (list.supplements || []).map(part => {
    const rows = removeOrder(part.rows, recipientId);
    // Trace the removed open allocation without leaving it in live demand.
    return rows === part.rows ? part : {...part, rows};
  }).filter(part => part.rows.length)}));
  let batchId: string | null = target?.id || null;
  if (date && !target) {
    // Supplements use a frozen round as their stable owner; its printed rows
    // remain untouched. Reuse the owner of an existing extra day when possible.
    const existingOwner = lists.find(list => list.locked_at && localProductionSupplements(list.supplements).some(part => part.date === date));
    const owner = existingOwner || [...lists].filter(list => list.locked_at).sort((a,b) => (batches.find(batch => batch.id === b.batch_id)?.date || "").localeCompare(batches.find(batch => batch.id === a.batch_id)?.date || ""))[0];
    if (!owner) throw Error("Er is nog geen afgesloten productieronde. Kies een open hoofdproductiedag.");
    batchId = owner.batch_id;
    const assignment = {order_id: order.id, season: Number(order.year), batch_id: batchId, revision: plan.revision + 1};
    const demand = combineProductionOrders(batches.map(batch => ({...batch, rows: []})), [], [order], [assignment], []).batches.find(batch => batch.id === batchId)!.rows;
    const part: ProductionSupplement = {id: input.id, date, name: `Aanvulling ${owner.supplements.length + 1}`, rows: combinedProductionRows(demand), createdAt: now, createdBy: input.actorId, createdByName: input.actorName, planRevision: 1};
    owner.supplements = mergeProductionSupplementsByDate([...owner.supplements, part]);
  }
  // Every checked list gets a new revision atomically: a simultaneous print,
  // freeze or quantity edit must either precede this save or cause a conflict.
  return {batchId, lists, plan, checks: batches.map(batch => ({batch_id: batch.id, revision: input.lists.find(list => list.batch_id === batch.id)?.revision || 0}))};
}
