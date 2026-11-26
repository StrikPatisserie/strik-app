export const stores = [
  { id: 'ziekerstraat', label: 'Ziekerstraat' }, { id: 'heyendaal', label: 'Heyendaal' },
  { id: 'daalseweg', label: 'Daalseweg' }, { id: 'lent', label: 'Lent' },
] as const;
export type StoreId = typeof stores[number]['id'];
export type OrderInput = {
  edition: string; orderNumber: string; lineNumber: string; name: string; product: string;
  quantity: number; store: StoreId | ''; pickupDate: string; reference: string; notes: string;
  unitPriceEx: number | null;
  customerCode?: string; email?: string; orderDate?: string; pickupDateKind?: 'fixed' | 'from';
};
export type OrderEvent = { at: string; actor: string; action: string; detail?: string };
export type PickupOrder = OrderInput & {
  id: string; revision: number; importedAt: string; sourceName: string;
  collectedAt: string | null; collectedBy: string; cancelled: boolean;
  invoiceNumber: string; invoicedAt: string | null; events: OrderEvent[];
};
export function text(value: unknown, max = 200) { return String(value ?? '').trim().slice(0, max); }
export function dateOnly(value: unknown): string {
  const raw = text(value); if (!raw) return '';
  const m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const iso = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : raw;
  const d = new Date(`${iso}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== iso) throw Error(`Ongeldige datum: ${raw}. Gebruik dag-maand-jaar.`);
  return iso;
}
export function localDate(iso = new Date().toISOString()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
export function storeLabel(id: string) { return stores.find(s => s.id === id)?.label || 'Winkel nog kiezen'; }
export function normalizeStore(value: unknown): StoreId | '' {
  const v = text(value).toLowerCase().replace(/[^a-z]/g, '');
  if (/ziekerstraat|centrum/.test(v)) return 'ziekerstraat';
  if (/heyendaal|heijendaal|heijendael|brakkenstein/.test(v)) return 'heyendaal';
  if (/daalseweg|nijmegenoost/.test(v)) return 'daalseweg';
  if (v === 'lent' || /striklent|nijmegenlent|oranje.?marieplein/.test(v)) return 'lent';
  return '';
}
export function normalizeInput(raw: unknown): OrderInput {
  if (!raw || typeof raw !== 'object') throw Error('Bestelling ontbreekt.');
  const v = raw as Record<string, unknown>;
  const edition = text(v.edition), orderNumber = text(v.orderNumber), name = text(v.name), product = text(v.product, 500);
  const quantity = Number(v.quantity);
  if (!/^20\d{2}$/.test(edition)) throw Error('Kies een geldig seizoenjaar.');
  if (!orderNumber || !name || !product) throw Error('Bestelnummer, naam en product zijn verplicht.');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw Error('Het aantal moet tussen 1 en 10.000 liggen.');
  const store = text(v.store);
  if (store && !stores.some(s => s.id === store)) throw Error('Kies een geldige winkel.');
  const unitPriceEx = v.unitPriceEx === null || v.unitPriceEx === undefined || v.unitPriceEx === '' ? null : Number(v.unitPriceEx);
  if (unitPriceEx !== null && (!Number.isFinite(unitPriceEx) || unitPriceEx < 0 || unitPriceEx > 100000)) throw Error('Controleer de stuksprijs exclusief btw.');
  const reference = text(v.reference);
  if (!reference) throw Error('Vul de bestelreferentie uit de mail in, bijvoorbeeld 07-01-2026.');
  return { edition, orderNumber, lineNumber: text(v.lineNumber), name, product, quantity, store: store as StoreId | '', pickupDate: dateOnly(v.pickupDate), reference, notes: text(v.notes, 2000), unitPriceEx,
    customerCode:text(v.customerCode),email:text(v.email,254),orderDate:dateOnly(v.orderDate),pickupDateKind:v.pickupDateKind==='from'?'from':'fixed' };
}
// A source line ID is preferred. Without one, require a unique product per order.
export function identity(input: OrderInput) {
  return JSON.stringify([input.edition, input.orderNumber, input.lineNumber ? `line:${input.lineNumber}` : `product:${input.product.toLowerCase()}`]);
}
export function sourceFields(input: OrderInput) { return JSON.stringify(normalizeInput(input)); }
export function changePickup(order: PickupOrder, action: 'collect' | 'undo' | 'cancel' | 'restore', actor: string, at: string): PickupOrder {
  if (order.invoiceNumber) throw Error('Deze afhaling staat al op een factuur. Laat management eerst de factuurregistratie corrigeren.');
  if (action === 'collect' && (order.cancelled || !order.store)) throw Error('Kies eerst de winkel en herstel een eventuele annulering.');
  if (action === 'collect' && order.collectedAt) return order;
  if (action === 'undo' && !order.collectedAt) return order;
  if (action === 'cancel' && order.collectedAt) throw Error('Maak eerst de afhaalregistratie ongedaan.');
  return { ...order,
    collectedAt: action === 'collect' ? at : action === 'undo' ? null : order.collectedAt,
    collectedBy: action === 'collect' ? actor : action === 'undo' ? '' : order.collectedBy,
    cancelled: action === 'cancel' ? true : action === 'restore' ? false : order.cancelled,
    events: [...order.events, { at, actor, action }],
  };
}
export function totals(orders: PickupOrder[]) {
  const active = orders.filter(o => !o.cancelled);
  const picked = active.filter(o => o.collectedAt);
  const ordersById = new Map<string, PickupOrder[]>();
  for (const o of active) { const key = `${o.edition}:${o.orderNumber}`; ordersById.set(key, [...(ordersById.get(key) || []), o]); }
  return { orders: ordersById.size, collectedOrders: [...ordersById.values()].filter(group => group.every(o => o.collectedAt)).length,
    units: active.reduce((n,o)=>n+o.quantity,0), collectedUnits: picked.reduce((n,o)=>n+o.quantity,0),
    toInvoice: picked.filter(o=>!o.invoiceNumber).reduce((n,o)=>n+o.quantity,0),
    unknownPrices: picked.filter(o=>o.unitPriceEx === null).length,
    totalEx: Math.round(picked.reduce((n,o)=>n+(o.unitPriceEx ?? 0)*o.quantity,0)*100)/100 };
}
export function csvCell(value: unknown) {
  let s = String(value ?? ''); if (/^[\s]*[=+@\-\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
export function invoiceCsv(orders: PickupOrder[]) {
  const rows: unknown[][] = [['Bestelreferentie', 'Bestelnummer', 'Klantcode / regelnummer', 'Naam', 'Winkel', 'Product', 'Aantal opgehaald', 'Afgehaald op', 'Stuksprijs excl. btw', 'Totaal excl. btw', 'Factuurnummer']];
  for (const o of orders.filter(o=>o.collectedAt && !o.cancelled)) rows.push([o.reference,o.orderNumber,o.customerCode||o.lineNumber,o.name,storeLabel(o.store),o.product,o.quantity,localDate(o.collectedAt!),o.unitPriceEx?.toFixed(2).replace('.',',') ?? '',o.unitPriceEx === null ? '' : (o.quantity*o.unitPriceEx).toFixed(2).replace('.',','),o.invoiceNumber]);
  return '\uFEFF' + rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
}
