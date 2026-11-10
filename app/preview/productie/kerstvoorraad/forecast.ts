import { preparationProposal } from "../../../productie/recipePlanning";
import type { DemoRecipe, DepartmentId, ItemUnit, PreviewState } from "../../../productie/planning";
import type { StockCategory } from "./assortment";

export type SalesProduct = {
  id: string; name: string; group: StockCategory; department: "patisserie" | "bak" | "chocolade";
  cashCode: string; bakeCode: string; cash: number | null; bake: number | null;
  needsSalesReview: boolean; note: string; folderProduct: boolean;
  unitUnconfirmed?: boolean;
  searchNames?: string[];
  articleAmbiguous?: boolean;
  members?: SalesProduct[];
  articleGroup?: string;
  salesVariant?: string;
  salesName?: string;
  week52?: { cash: number; bake: number; issue?: string };
};
export type ProductAdjustment = {
  growthPercent?: number;
  periodTotal?: number;
  week52Total?: number;
  name2026?: string;
  cashCode2026?: string;
  hidden?: boolean;
};
export type ProductChoice = {
  target: number | null; stock: number | null; recipeId: string;
  checked: boolean; storageChecked: boolean; phase: "components" | "whole";
  week52Base?: number | null;
  productionItemId?: string;
  adjustment?: ProductAdjustment;
};
export type ForecastRow = {
  product: SalesProduct; choice: ProductChoice; historical: number | null;
  forecast: number | null; remaining: number | null; issues: string[];
};
export type ComponentTotal = {
  id: string; name: string; unit: ItemUnit; needed: number; stock: number | null;
  remaining: number | null; batches: number | null; make: number | null; department: DepartmentId;
  forProducts: string[];
  finishedStockDeducted: boolean;
};
export type ForecastPlan = { rows: ForecastRow[]; components: ComponentTotal[]; errors: string[] };
export const emptyChoice = (): ProductChoice => ({ target: null, stock: null, recipeId: "", checked: false, storageChecked: false, phase: "components" });
const rounded = (value: number) => Math.round(value * 1e6) / 1e6;
const amount = (value: number | null) => value !== null && Number.isFinite(value) && value >= 0 && value <= 1e6;

export function projectedSales(base: number | null, growth: number): number | null {
  return base === null || !Number.isFinite(base) || base < 0 ? null : Math.ceil(rounded(base * (1 + growth / 100)));
}

export function productProjection(product: SalesProduct, choice: ProductChoice, growth: number) {
  const adjustment = choice.adjustment || {};
  const uplift = adjustment.growthPercent ?? growth;
  const historical = product.cash === null && product.bake === null ? null : (product.cash ?? 0) + (product.bake ?? 0);
  const period = adjustment.periodTotal ?? (product.unitUnconfirmed ? null : projectedSales(historical, uplift));
  const weekBase = choice.week52Base ?? (product.week52 && !product.week52.issue ? product.week52.cash + product.week52.bake : null);
  const week52 = adjustment.week52Total ?? (product.unitUnconfirmed ? null : projectedSales(weekBase, uplift));
  const issue = period !== null && week52 !== null && week52 > period
    ? "Week 52 is groter dan de prognose voor de hele periode" : null;
  return { historical, period, week52: issue ? null : week52, growth: uplift, issue };
}

/** A replacement keeps its historical basis but needs its own receipt and
 * production links. Never continue subtracting the retired article's sales. */
export function productFor2026(product: SalesProduct, choice: ProductChoice): SalesProduct {
  const adjustment = choice.adjustment;
  if (!adjustment?.name2026) return product;
  return { ...product, name: adjustment.name2026, cashCode: adjustment.cashCode2026 || "", members: undefined,
    articleAmbiguous: !adjustment.cashCode2026, searchNames: [...(product.searchNames || []), product.name] };
}

export function mappedProductsFor2026(products: SalesProduct[], choices: Record<string, ProductChoice>, growth: number): SalesProduct[] {
  const mapped = products.map(product => productFor2026(product, choices[product.id] || emptyChoice()));
  const counts = new Map<string, number>();
  for (const [index, product] of mapped.entries()) {
    if (choices[product.id]?.adjustment?.hidden) continue;
    const period = productProjection(products[index], choices[product.id] || emptyChoice(), growth).period;
    if (!product.cashCode || product.cashCode === "9999999999" || period === null || period <= 0) continue;
    counts.set(product.cashCode, (counts.get(product.cashCode) || 0) + 1);
  }
  return mapped.map(product => (counts.get(product.cashCode) || 0) > 1 ? { ...product, articleAmbiguous: true } : product);
}

export function forecastRow(product: SalesProduct, choice: ProductChoice, growth: number): ForecastRow {
  const { historical, period: forecast } = productProjection(product, choice, growth);
  const issues: string[] = [];
  if (!choice.checked) issues.push(product.needsSalesReview ? "Artikel en eenheid controleren" : "Artikelkoppeling controleren");
  if (!amount(choice.target)) issues.push("Doel vóór kerst invullen");
  if (!amount(choice.stock)) issues.push("Voorraad tellen");
  if (!choice.recipeId) issues.push("Recept koppelen");
  if (!choice.storageChecked) issues.push("Bewaarfase bevestigen");
  return { product, choice, historical, forecast, issues, remaining: amount(choice.target) && amount(choice.stock) ? Math.max(0, rounded(choice.target! - choice.stock!)) : null };
}

/** Uses the existing recipe expansion. Shared preparations are combined by ID.
 * Stock and whole-batch rounding are applied before dependent preparations,
 * so using a mousse from stock also removes its upstream requirements.
 */
export function buildForecastPlan(products: SalesProduct[], choices: Record<string, ProductChoice>, recipes: DemoRecipe[], componentStocks: Record<string, number | null>, growth: number, date: string): ForecastPlan {
  const state: PreviewState = { version: 1, tasks: [], items: recipes.map(recipe => ({ id: `recipe:${recipe.id}`, recipeId: recipe.id, name: recipe.name, unit: recipe.unit, kind: recipe.type === "finalProduct" ? "product" : "component", departmentId: recipe.id.includes("bodem") || recipe.id.includes("soes") ? "bak" : "luxe", stock: 0, note: "" })) };
  const rows = products.map(product => forecastRow(product, choices[product.id] || emptyChoice(), growth));
  const nodes = new Map<string, { needed: number; requires: string[]; forProducts: Set<string>; department: DepartmentId }>();
  const wholeProducts = new Set<string>();
  const errors: string[] = [];
  function proposal(recipeId: string, quantity: number) {
    return preparationProposal(state, recipes, { task: { id: `forecast:${recipeId}`, itemId: `recipe:${recipeId}`, date, departmentId: "luxe", operation: "Voorbereiden", status: "planned", note: "", source: "manual", batchId: `forecast:${recipeId}`, recordsOutput: true }, amount: quantity, amountMode: "quantity", preparation: { daysBefore: 0, choices: {} } });
  }
  for (const row of rows) {
    const recipe = recipes.find(recipe => recipe.id === row.choice.recipeId);
    if (row.choice.recipeId && !recipe) row.issues.push("Gekoppeld recept ontbreekt");
    if (!recipe || row.remaining === null || row.issues.length) continue;
    if (row.remaining === 0) continue;
    if (!Number.isFinite(recipe.yield) || recipe.yield <= 0 || recipe.reviewRequired || (!recipe.ingredients.length && !recipe.semiFinishedItems?.length)) {
      row.issues.push("Recept aanvullen en controleren"); continue;
    }
    if (recipe.unit !== "stuks") { row.issues.push("Omrekening van verkoop naar recept controleren"); continue; }
    const result = proposal(recipe.id, row.remaining);
    if (result.errors.length) { row.issues.push(...result.errors); continue; }
    if (result.rows.some(item => {
      const child = recipes.find(candidate => candidate.id === item.recipeId);
      return !child || (!child.ingredients.length && !child.semiFinishedItems?.length);
    })) { row.issues.push("Een onderdeel heeft nog een leeg recept"); continue; }
    if (row.choice.phase === "components" && !result.rows.length) { row.issues.push("Voor te bereiden onderdelen vastleggen"); continue; }
    if (row.choice.phase === "whole") wholeProducts.add(recipe.id);
    const requirements = row.choice.phase === "whole"
      ? [{ recipeId: recipe.id, quantity: row.remaining, requires: (recipe.semiFinishedItems || []).map(line => line.recipeId), departmentId: row.product.department === "bak" ? "bak" as const : "luxe" as const }, ...result.rows]
      : result.rows;
    for (const requirement of requirements) {
      const current = nodes.get(requirement.recipeId) || { needed: 0, requires: requirement.requires, forProducts: new Set<string>(), department: requirement.departmentId };
      current.needed = rounded(current.needed + requirement.quantity);
      current.forProducts.add(row.product.name);
      nodes.set(requirement.recipeId, current);
    }
  }
  const ordered: string[] = [], visited = new Set<string>();
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    for (const child of nodes.get(id)?.requires || []) visit(child);
    ordered.push(id);
  }
  nodes.forEach((_, id) => visit(id));
  const components: ComponentTotal[] = [];
  for (const id of ordered.reverse()) {
    const node = nodes.get(id), recipe = recipes.find(recipe => recipe.id === id);
    if (!node || !recipe) continue;
    // Finished stock was already deducted at product level.
    const stock = wholeProducts.has(id) ? 0 : componentStocks[id] ?? null;
    const remaining = amount(stock) ? Math.max(0, rounded(node.needed - stock!)) : null;
    const batches = remaining === null ? null : Math.ceil(rounded(remaining / recipe.yield));
    const make = batches === null ? null : rounded(batches * recipe.yield);
    components.push({ id, name: recipe.name, unit: recipe.unit, needed: node.needed, stock, remaining, batches, make, department: node.department, forProducts: [...node.forProducts], finishedStockDeducted: wholeProducts.has(id) });
    if (remaining === null) errors.push(`${recipe.name} · voorraad tellen`);
    if (make !== null && node.requires.length) {
      const difference = rounded(make - node.needed);
      if (difference) {
        const adjustment = proposal(id, Math.abs(difference));
        if (adjustment.errors.length) errors.push(...adjustment.errors);
        for (const child of adjustment.rows) {
          const descendant = nodes.get(child.recipeId);
          if (descendant) descendant.needed = Math.max(0, rounded(descendant.needed + Math.sign(difference) * child.quantity));
        }
      }
    }
  }
  return { rows, components, errors: [...new Set(errors)] };
}
