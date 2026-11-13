import { parseForecastSettings, type ForecastSettings } from "./adjustments";
import type { ProductChoice, SalesProduct } from "./forecast";

export const SALES_KEY = "production-christmas-forecast-sales-2026";
export const SETTINGS_KEY = "production-christmas-forecast-settings-2026";
export type SharedForecastSettings = ForecastSettings & {
  version: 1; revision: number; updatedAt: string | null; updatedBy: string | null;
};
export type ForecastProductSettings = {
  adjustment: NonNullable<ProductChoice["adjustment"]>;
  mapping: ForecastSettings["mappings"][string];
};
export type ForecastCommand =
  | { kind: "growth"; value: number; previous: number }
  | { kind: "product"; productId: string; value: ForecastProductSettings; previous: ForecastProductSettings };
export type ForecastSales = {
  version: 1; revision: number; products: SalesProduct[]; importedAt: string; sources: string[];
};
export const emptySharedSettings = (): SharedForecastSettings => ({
  ...parseForecastSettings(null), version: 1, revision: 0, updatedAt: null, updatedBy: null,
});
export function forecastProductSettings(choice?: Partial<ProductChoice>): ForecastProductSettings {
  const settings = parseForecastSettings(JSON.stringify({ version: 1, adjustments: { product: choice?.adjustment || {} }, mappings: { product: choice || {} } }));
  return { adjustment: settings.adjustments.product, mapping: settings.mappings.product };
}
export function settingsForProduct(settings: ForecastSettings, id: string): ForecastProductSettings {
  return forecastProductSettings({ adjustment: settings.adjustments[id], ...settings.mappings[id] });
}
export function choicesFromSettings(products: SalesProduct[], settings: ForecastSettings, choices: Record<string, ProductChoice>): Record<string, ProductChoice> {
  return Object.fromEntries(products.map(product => [product.id, {
    ...choices[product.id], ...settingsForProduct(settings, product.id).mapping, adjustment: settings.adjustments[product.id],
  }]));
}
function validateProduct(input: unknown): ForecastProductSettings {
  if (!input || typeof input !== "object") throw Error("Controleer de productbijstelling.");
  const { adjustment, mapping } = input as ForecastProductSettings;
  if (!adjustment || typeof adjustment !== "object" || Array.isArray(adjustment) || !mapping || typeof mapping !== "object") throw Error("Controleer de productbijstelling.");
  const normalized = forecastProductSettings({ ...mapping, adjustment });
  for (const [key, value] of Object.entries(adjustment)) {
    if (key === "hidden" && value === false) continue;
    if (value !== undefined && value !== "" && normalized.adjustment[key as keyof typeof adjustment] !== value) throw Error("Controleer de prognose, productnaam en het artikelnummer.");
  }
  if (typeof mapping.recipeId !== "string" || mapping.recipeId.length > 200 || typeof mapping.checked !== "boolean"
    || mapping.productionItemId !== undefined && (typeof mapping.productionItemId !== "string" || mapping.productionItemId.length > 200)) throw Error("Controleer de receptkoppeling.");
  return normalized;
}
export class ForecastConflictError extends Error {}
/** Compare the edited product only. Independent edits can be merged after a CAS retry. */
export function applyForecastCommand(current: SharedForecastSettings, input: unknown, productIds: Set<string>, actor: string, now: string): SharedForecastSettings {
  if (!input || typeof input !== "object") throw Error("Ongeldige bijstelling.");
  const command = input as ForecastCommand;
  let next: SharedForecastSettings;
  if (command.kind === "growth") {
    if (![0, 5, 8, 10, 15].includes(command.value) || ![0, 5, 8, 10, 15].includes(command.previous)) throw Error("Kies een geldige algemene groei.");
    if (current.growth === command.value) return current;
    if (current.growth !== command.previous) throw new ForecastConflictError("De algemene groei is intussen aangepast. Controleer de actuele waarde.");
    next = { ...current, growth: command.value };
  } else if (command.kind === "product") {
    if (!productIds.has(command.productId)) throw Error("Dit product staat niet in de verkoopbasis.");
    const value = validateProduct(command.value), previous = validateProduct(command.previous);
    const actual = settingsForProduct(current, command.productId);
    if (JSON.stringify(actual) === JSON.stringify(value)) return current;
    if (JSON.stringify(actual) !== JSON.stringify(previous)) throw new ForecastConflictError("Dit product is intussen door iemand anders aangepast. Je invoer blijft staan. Open het product opnieuw om de actuele bijstelling te vergelijken.");
    next = { ...current, adjustments: { ...current.adjustments, [command.productId]: value.adjustment }, mappings: { ...current.mappings, [command.productId]: value.mapping } };
  } else throw Error("Ongeldige bijstelling.");
  return { ...next, revision: current.revision + 1, updatedAt: now, updatedBy: actor };
}
