import type { ProductAdjustment, ProductChoice } from "./forecast";

export const ADJUSTMENTS_STORAGE_KEY = "strik-christmas-forecast-2026-v1";

// Owner-approved changes made through Codex can be recorded here by stable
// historical product ID. The source spreadsheets stay read-only.
export const configuredProductAdjustments: Record<string, ProductAdjustment> = {};

export type ForecastMapping = Pick<ProductChoice, "recipeId" | "productionItemId" | "checked">;
export type ForecastSettings = { growth: number; adjustments: Record<string, ProductAdjustment>; mappings: Record<string, ForecastMapping> };

export function parseForecastSettings(raw: string | null): ForecastSettings {
  const result: ForecastSettings = { growth: 10, adjustments: { ...configuredProductAdjustments }, mappings: {} };
  if (!raw) return result;
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !data.adjustments || typeof data.adjustments !== "object" || Array.isArray(data.adjustments)) return result;
    if ([0, 5, 8, 10, 15].includes(data.growth)) result.growth = data.growth;
    for (const [id, value] of Object.entries(data.adjustments).slice(0, 3000)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const input = value as Record<string, unknown>, adjustment: ProductAdjustment = {};
      if (input.hidden === true) adjustment.hidden = true;
      for (const field of ["growthPercent", "periodTotal", "week52Total"] as const) {
        const number = input[field];
        if (typeof number === "number" && Number.isFinite(number) && number >= (field === "growthPercent" ? -100 : 0)
          && number <= (field === "growthPercent" ? 500 : 1e6) && (field === "growthPercent" || Number.isInteger(number))) adjustment[field] = number;
      }
      if (typeof input.name2026 === "string" && input.name2026.trim() && input.name2026.trim().length <= 150) {
        adjustment.name2026 = input.name2026.trim();
        if (typeof input.cashCode2026 === "string" && /^\d{1,20}$/.test(input.cashCode2026) && input.cashCode2026 !== "9999999999") adjustment.cashCode2026 = input.cashCode2026;
      }
      result.adjustments[id] = adjustment;
    }
    if (data.mappings && typeof data.mappings === "object" && !Array.isArray(data.mappings)) {
      for (const [id, value] of Object.entries(data.mappings).slice(0, 3000)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const input = value as Record<string, unknown>;
        const recipeId = typeof input.recipeId === "string" && input.recipeId.length <= 200 ? input.recipeId : "";
        const productionItemId = typeof input.productionItemId === "string" && input.productionItemId.length <= 200 ? input.productionItemId : undefined;
        result.mappings[id] = { recipeId, productionItemId, checked: input.checked === true };
      }
    }
  } catch { /* An unavailable or older local trial keeps the configured defaults. */ }
  return result;
}
