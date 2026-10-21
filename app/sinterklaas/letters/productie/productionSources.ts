export type ProductionOrderSource = "winkel" | "online" | "b2b" | "onbekend";
export type ProductionSource = ProductionOrderSource | "voorraad";

export type ProductionSeedRow = {
  key: string;
  label: string;
  orders: number;
  stock: number;
  produced: number;
  orderSources?: Partial<Record<ProductionOrderSource, number>>;
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

export function addProductionOrderQuantity(row: ProductionSeedRow, source: ProductionOrderSource, quantity: number): ProductionSeedRow {
  return {
    ...row,
    orders: row.orders + quantity,
    orderSources: { ...row.orderSources, [source]: (row.orderSources?.[source] || 0) + quantity },
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
    for (const { id, quantity } of productionSourceBreakdown(row)) {
      if (id === "voorraad") continue;
      current.orderSources = { ...current.orderSources, [id]: (current.orderSources?.[id] || 0) + quantity };
    }
    totals.set(row.key, current);
  }
  return [...totals.values()];
}
