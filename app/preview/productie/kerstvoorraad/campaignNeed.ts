import { addDays } from "../../../productie/planning";
import { articleKey, mergeDispatchDays, type DispatchDay } from "../../../productie/inventory";
import type { SalesProduct } from "./forecast";

export const CAMPAIGN_START = "2026-11-16";
export const CAMPAIGN_END = "2026-12-31";
export type CampaignReceipts = { mode: "example" | "live"; available: boolean; days: DispatchDay[]; checkedAt?: string; error?: string };
export type RemainingNeed = { remaining: number | null; issued: number | null; through: string | null; note: string };
export type CampaignWindow = { through: string | null; problem: string | null; quantities: Map<string, number> };
export function todayInAmsterdam() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function validCampaignDays(value: unknown): value is DispatchDay[] {
  return Array.isArray(value) && value.length <= 1000 && value.every(day => {
    if (!day || typeof day.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || typeof day.importedAt !== "string" || !Number.isFinite(Date.parse(day.importedAt)) || !Number.isInteger(day.unknownLines) || day.unknownLines < 0 || !Array.isArray(day.lines)) return false;
    try { if (addDays(day.date, 0) !== day.date) return false; } catch { return false; }
    return day.lines.every((line: DispatchDay["lines"][number]) => typeof line.article === "string" && typeof line.description === "string" && Number.isFinite(line.quantity) && Math.abs(line.quantity) <= 1e6);
  });
}

/** Prepare the daily coverage and article totals once for the whole table. */
export function campaignWindow(receipts: CampaignReceipts, today: string): CampaignWindow {
  const quantities = new Map<string, number>();
  if (today <= CAMPAIGN_START) return { through: null, problem: null, quantities };
  if (!receipts.available) return { through: null, problem: "Bonnen niet bereikbaar", quantities };
  const through = [addDays(today, -1), CAMPAIGN_END].sort()[0];
  const days = mergeDispatchDays([], receipts.days).filter(day => day.date >= CAMPAIGN_START && day.date <= through);
  const covered = new Set(days.filter(day => day.unknownLines === 0).map(day => day.date));
  let missing = 0;
  for (let date = CAMPAIGN_START; date <= through; date = addDays(date, 1)) if (!covered.has(date)) missing++;
  if (missing) return { through, problem: `${missing} bondag${missing === 1 ? "" : "en"} controleren`, quantities };
  for (const day of days) for (const line of day.lines) {
    const article = articleKey(line.article);
    quantities.set(article, (quantities.get(article) ?? 0) + line.quantity);
  }
  return { through, problem: null, quantities };
}

/** Remaining dispatch demand, not a stock balance. Today's requirement is
 * still needed today; missing days and unverified units never become zero. */
export function remainingNeed(product: SalesProduct, forecast: number | null, receipts: CampaignReceipts, today: string, mappingValid: boolean, window = campaignWindow(receipts, today)): RemainingNeed {
  const unknown = (note: string): RemainingNeed => ({ remaining: null, issued: null, through: null, note });
  if (forecast === null) return unknown("Prognose controleren");
  if (today <= CAMPAIGN_START) return { remaining: forecast, issued: 0, through: null, note: "Start 16 nov" };
  if (window.problem) return unknown(window.problem);
  if (product.members) return unknown("Varianten op bon koppelen");
  if (product.articleAmbiguous) return unknown("Artikel/formaat koppelen");
  if (!mappingValid || !product.cashCode || product.cashCode === "9999999999" || product.cashCode === "-") return unknown("Bonartikel koppelen");
  const article = articleKey(product.cashCode);
  const issued = Math.round((window.quantities.get(article) ?? 0) * 1e6) / 1e6;
  const remaining = Math.max(0, Math.ceil(Math.round((forecast - issued) * 1e6) / 1e6));
  return { remaining, issued, through: window.through, note: issued > forecast ? `${Math.round((issued - forecast) * 1e6) / 1e6} boven prognose` : "Afgeronde bondagen verwerkt" };
}

/** Deliberately future-dated fixtures for the preview date selector. */
export function exampleCampaignReceipts(products: SalesProduct[]): CampaignReceipts {
  const quantities: Record<string, number[]> = {
    "bakery:bossche bol": [100, 120, 80], "bakery:hazelnootbol": [50, 40, 60],
    "bakery:passievol bombe": [20, 40, 20], "folder:stol-groot": [5, 10, 5], "folder:tulband": [2, 1, 3],
  };
  return { mode: "example", available: true, days: ["2026-11-16", "2026-11-17", "2026-11-18"].map((date, index) => ({ date, importedAt: `${date}T18:00:00.000Z`, unknownLines: 0, lines: products.flatMap(product => quantities[product.id] && product.cashCode ? [{ article: product.cashCode, description: product.name, quantity: quantities[product.id][index] }] : []) })) };
}
