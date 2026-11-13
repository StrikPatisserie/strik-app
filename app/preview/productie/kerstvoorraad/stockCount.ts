import type { StockOverview } from "./productionOverview";

export type InventoryReading = StockOverview & { revision: number };

export type StockCountInput = {
  id: string;
  itemId: string;
  previousCountId: string | null;
  date: string;
  quantity: number;
  who: string;
};

/** Reuse the normal inventory command. Retry unrelated concurrent counts,
 * preserve edits to this product, and recover a lost successful response. */
export async function registerStockCount(input: StockCountInput, request: typeof fetch = fetch): Promise<InventoryReading> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await request("/api/productie/voorraad", { cache: "no-store" });
    const current = await response.json();
    if (!response.ok) throw Error(current.message || "De voorraad is nu niet bereikbaar.");
    const row = (current as StockOverview).rows.find(row => row.itemId === input.itemId && row.kind === "product" && row.unit === "stuks");
    if (!row) throw Error("Het productieartikel is gewijzigd. Open het product opnieuw.");
    if (row.count?.id === `${input.id}:${input.itemId}`) return current;
    if ((row.count?.id || null) !== input.previousCountId) throw Error("Dit product is intussen opnieuw geteld. Je invoer blijft staan. Open de telling opnieuw om de actuele voorraad te controleren.");
    const saved = await request("/api/productie/voorraad", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: input.id, revision: current.revision, command: {
        kind: "count", date: input.date, who: input.who, entries: [{ itemId: input.itemId, quantity: input.quantity }],
      } }),
    });
    const result = await saved.json();
    if (saved.ok) return result;
    if (saved.status !== 409 || attempt === 2) throw Error(result.message || "Telling opslaan mislukt. Je invoer blijft staan.");
  }
  throw Error("De voorraad is intussen gewijzigd. Controleer de telling opnieuw.");
}
