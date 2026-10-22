export type ProductionOrderSource = "winkel" | "online" | "b2b" | "onbekend";
export type ProductionSource = ProductionOrderSource | "voorraad";

export type ProductionRecipient = {
  id: string; source: ProductionSource; quantity: number; customerName: string;
  code?: string; shop?: string; date?: string; notes?: string;
};

export type ProductionSeedRow = {
  key: string;
  label: string;
  orders: number;
  stock: number;
  produced: number;
  orderSources?: Partial<Record<ProductionOrderSource, number>>;
  recipients?: ProductionRecipient[];
};

export const PRODUCTION_SOURCES: ReadonlyArray<{ id: ProductionSource; label: string }> = [
  { id: "winkel", label: "Winkelbestelling" },
  { id: "online", label: "Online Lettershop" },
  { id: "b2b", label: "B2B-bestelling" },
  { id: "voorraad", label: "Winkelvoorraad" },
  { id: "onbekend", label: "Herkomst onbekend" },
];

export function productionOrderSource(channel: string | null | undefined): ProductionOrderSource {
  switch (channel?.toLowerCase()) {
    case "store":
    case "winkel": return "winkel";
    case "online": return "online";
    case "b2b": return "b2b";
    default: return "onbekend";
  }
}

export function addProductionOrderQuantity(row: ProductionSeedRow, source: ProductionOrderSource, quantity: number, recipient?: Omit<ProductionRecipient, "source" | "quantity">): ProductionSeedRow {
  return {
    ...row,
    orders: row.orders + quantity,
    orderSources: { ...row.orderSources, [source]: (row.orderSources?.[source] || 0) + quantity },
    ...(recipient ? {recipients: [...(row.recipients || []), {...recipient, source, quantity}]} : {}),
  };
}

export function productionSourceBreakdown(row: ProductionSeedRow) {
  const quantities: Record<ProductionSource, number> = {
    winkel: row.orderSources?.winkel || 0,
    online: row.orderSources?.online || 0,
    b2b: row.orderSources?.b2b || 0,
    voorraad: row.stock,
    onbekend: row.orderSources?.onbekend || 0,
  };
  const attributedOrders = quantities.winkel + quantities.online + quantities.b2b + quantities.onbekend;
  quantities.onbekend += Math.max(0, row.orders - attributedOrders);
  return PRODUCTION_SOURCES.filter(({ id }) => quantities[id] > 0)
    .map((source) => ({ ...source, quantity: quantities[source.id] }));
}

export function aggregateProductionRows(rows: readonly ProductionSeedRow[]): ProductionSeedRow[] {
  const totals = new Map<string, ProductionSeedRow>();
  for (const row of rows) {
    const current = totals.get(row.key) || { key: row.key, label: row.label, orders: 0, stock: 0, produced: 0, orderSources: {} };
    current.orders += row.orders;
    current.stock += row.stock;
    current.produced += row.produced;
    if (row.recipients) current.recipients = [...(current.recipients || []), ...row.recipients];
    for (const { id, quantity } of productionSourceBreakdown(row)) {
      if (id === "voorraad") continue;
      current.orderSources = { ...current.orderSources, [id]: (current.orderSources?.[id] || 0) + quantity };
    }
    totals.set(row.key, current);
  }
  return [...totals.values()];
}

export function productionRecipientVersion(row: ProductionSeedRow) {
  return JSON.stringify((row.recipients || []).map(item => [item.source,item.id,item.customerName,item.code||"",item.shop||"",item.date||"",item.notes||"",item.quantity]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

// Never guess a customer when an older list contains only totals.
export function productionRecipientsFor(row: ProductionSeedRow, source: ProductionSource) {
  const expected = productionSourceBreakdown(row).find(item=>item.id===source)?.quantity || 0;
  if (!expected) return [];
  const combined = new Map<string, ProductionRecipient>();
  for (const item of row.recipients || []) {
    if (item.source !== source || item.quantity <= 0) continue;
    const key = JSON.stringify([item.id, item.customerName, item.code, item.shop, item.date, item.notes]);
    const existing = combined.get(key);
    combined.set(key, {...item, quantity: item.quantity + (existing?.quantity || 0)});
  }
  const recipients = [...combined.values()];
  const total = recipients.reduce((sum,item)=>sum+item.quantity,0);
  const unknown = (quantity:number,notes:string) => ({id:`unresolved:${row.key}:${source}`,source,quantity,customerName:source==="voorraad"?"Winkelvoorraad · vestiging nog bepalen":"Klantverdeling controleren",notes,unresolved:true});
  if (total>expected) return [unknown(expected,`Klantregels tellen op tot ${total}; op de productielijst staan ${expected}. Controleer dit eerst in de app.`)];
  return [...recipients.map(item=>({...item,unresolved:false})),...(total<expected?[unknown(expected-total,"Voor dit aantal is nog geen volledige ontvanger vastgelegd. Eerst controleren, daarna verdelen.")]:[])];
}
