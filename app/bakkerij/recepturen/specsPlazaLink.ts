import type { SpecsPlazaProductResult } from "@/app/lib/specsplaza/types";
import type { Ingredient } from "./types";
import type { RecepturenData } from "./recepturenApi";

// Keep the supplier snapshot separate from the user's checked labeling data.
// A test link never confirms or replaces allergens, composition or nutrients.
export function linkSpecsPlazaProduct(ingredient: Ingredient, result: SpecsPlazaProductResult, now = new Date().toISOString()): Ingredient {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(result.product.id) ||
      !["test", "production"].includes(result.environment) ||
      !result.sample || result.sample.product.id !== result.product.id) {
    throw new Error("Dit product heeft geen geldige specificatie. Kies een ander resultaat of probeer opnieuw.");
  }
  return {
    ...ingredient,
    specification: {
      ...ingredient.specification,
      specsPlazaId: result.product.id,
      specificationVersion: result.sample.versionNumber === null ? undefined : String(result.sample.versionNumber),
      specsPlazaLink: { ...result, linkedAt: now },
      updatedAt: now,
    },
  };
}

function same(first: unknown, second: unknown): boolean {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) :
    value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  return JSON.stringify(canonical(first)) === JSON.stringify(canonical(second));
}

export function mergeIngredientSpecification(current: Ingredient, updated: Ingredient, expected: Ingredient): Ingredient {
  if (current.id !== updated.id || current.id !== expected.id) throw new Error("De grondstof is veranderd. Open deze opnieuw.");
  if (!same(current.specification || {}, expected.specification || {}) || !same(current.allergens, expected.allergens)) {
    throw new Error("De specificatie is ondertussen gewijzigd. Open de grondstof opnieuw voordat je opslaat.");
  }
  // Preserve newer prices, names and invoice data from the current shared storage.
  return { ...current, specification: updated.specification, allergens: updated.allergens };
}

export async function persistIngredientSpecification(updated: Ingredient, expected: Ingredient): Promise<Ingredient> {
  async function request(init?: RequestInit) {
    const response = await fetch("/api/recepturen", { cache: "no-store", ...init });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : "De specificatie kon niet worden opgeslagen. Probeer opnieuw.");
    if (!data || !Array.isArray(data.ingredients) || !Array.isArray(data.recipes) || !Array.isArray(data.invoiceImports)) throw new Error("De opslag geeft geen geldige receptuurgegevens terug.");
    if (data.financialAccess !== true) throw new Error("Alleen managers kunnen productspecificaties opslaan.");
    return data as RecepturenData & Record<string, unknown>;
  }
  // Start with the latest full payload. Do not run unrelated invoice pruning or
  // recipe normalization just to change one ingredient's specification.
  const live = await request();
  const matches = live.ingredients.filter((item) => item.id === updated.id);
  if (matches.length !== 1) throw new Error("De grondstof ontbreekt of heeft een dubbel ID. Herlaad de grondstoffenlijst.");
  const next = mergeIngredientSpecification(matches[0], updated, expected);
  const payload = { ...live, ingredients: live.ingredients.map((item) => item.id === next.id ? next : item) };
  delete payload.financialAccess;
  const saved = await request({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const stored = saved.ingredients.filter((item) => item.id === next.id);
  if (stored.length !== 1 || !same(stored[0].specification, next.specification) || !same(stored[0].allergens, next.allergens)) {
    throw new Error("De opslag heeft de specificatie niet bevestigd. Herlaad de grondstof en controleer de koppeling.");
  }
  return stored[0];
}
