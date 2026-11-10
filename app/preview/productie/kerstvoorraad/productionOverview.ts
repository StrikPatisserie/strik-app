import { inventoryOverview, type InventoryState, type DispatchDay } from "../../../productie/inventory";
import type { DemoRecipe, PreviewState } from "../../../productie/planning";
import type { ProductChoice, SalesProduct } from "./forecast";

export type StockOverview = ReturnType<typeof inventoryOverview>;
export type StockRow = StockOverview["rows"][number];
export type ProductionReading = {
  mode: "example" | "live";
  overview: StockOverview;
  items: PreviewState["items"];
  recipes: DemoRecipe[];
};

/** Article numbers are matched only in the current Cash-it namespace.
 * Old Bake-it numbers and names must not silently match another product. */
export function productInventory(product: SalesProduct, choice: ProductChoice, source: ProductionReading): StockRow | null {
  if (product.members) return null;
  if (choice.productionItemId) return source.overview.rows.find(row => row.itemId === choice.productionItemId && row.kind === "product" && row.unit === "stuks") || null;
  if (source.mode === "example") {
    const item = source.items.find(item => item.recipeId === choice.recipeId && item.kind === "product");
    return source.overview.rows.find(row => row.itemId === item?.id) || null;
  }
  if (product.articleAmbiguous || !product.cashCode || product.cashCode === "9999999999" || product.cashCode === "-") return null;
  const matches = source.overview.rows.filter(row => row.kind === "product" && row.unit === "stuks" && row.link?.article === product.cashCode);
  return matches.length === 1 ? matches[0] : null;
}

export function stockDisplay(row: StockRow | null) {
  if (!row) return { quantity: null, note: "Productieartikel koppelen" };
  if (!row.count) return { quantity: null, note: "Eerst voorraad tellen" };
  if (row.checkpoint) return { quantity: null, note: "Einde-dagtelling nodig" };
  if (row.balance !== null && row.balance < 0) return { quantity: null, note: "Telling controleren" };
  if (!row.known) return { quantity: null, note: row.missingDays ? `${row.missingDays} brondagen ontbreken` : "Verbruik nog koppelen" };
  return { quantity: row.balance, note: `t/m ${row.through}` };
}

/** Disposable fixture, deliberately constructed through the same inventory
 * calculation as production. No fixture is a real stock count or production. */
export function exampleProduction(products: SalesProduct[], choices: Record<string, ProductChoice>, recipes: DemoRecipe[]): ProductionReading {
  const values: Record<string, { count: number; made: number; issued: number }> = {
    "demo-passievol": { count: 200, made: 500, issued: 580 },
    "demo-hazelnoot": { count: 80, made: 400, issued: 320 },
    "demo-bossche": { count: 50, made: 600, issued: 450 },
    "demo-stol": { count: 0, made: 100, issued: 20 },
    "demo-tulband": { count: 0, made: 24, issued: 0 },
  };
  const selected = products.flatMap(product => {
    const recipe = recipes.find(recipe => recipe.id === choices[product.id]?.recipeId);
    return recipe && values[recipe.id] ? [{ product, recipe, value: values[recipe.id] }] : [];
  });
  const planner: PreviewState = {
    version: 1,
    items: selected.map(({ product, recipe }) => ({ id: `example:${product.id}`, name: product.name, recipeId: recipe.id, kind: "product", unit: "stuks", departmentId: product.department === "bak" ? "bak" : "luxe", stock: 0, note: "Voorbeeldproductie" })),
    tasks: selected.map(({ product, value }) => ({ id: `made:${product.id}`, itemId: `example:${product.id}`, batchId: `batch:${product.id}`, departmentId: "luxe", date: "2026-11-09", quantity: value.made, completedQuantity: value.made, recordsOutput: true, status: "done", source: "manual", operation: "Afwerken", note: "Voorbeeld" })),
  };
  const inventory: InventoryState = {
    revision: 0, actions: [],
    counts: selected.map(({ product, value }) => ({ id: `count:${product.id}`, itemId: `example:${product.id}`, quantity: value.count, unit: "stuks", date: "2026-11-08", who: "Voorbeeld", actorId: "example", at: "2026-11-08T17:00:00.000Z" })),
    links: selected.map(({ product }) => ({ itemId: `example:${product.id}`, article: product.cashCode || product.id, factor: 1, leadDays: 1, unit: "stuks" })),
  };
  const days: DispatchDay[] = [
    { date: "2026-11-09", importedAt: "2026-11-09T18:00:00.000Z", unknownLines: 0, lines: selected.map(({ product, value }) => ({ article: product.cashCode || product.id, description: product.name, quantity: value.issued })) },
    { date: "2026-11-10", importedAt: "2026-11-10T18:00:00.000Z", unknownLines: 0, lines: [] },
  ];
  return { mode: "example", items: planner.items, recipes, overview: inventoryOverview(planner, inventory, days, "2026-11-10") };
}
