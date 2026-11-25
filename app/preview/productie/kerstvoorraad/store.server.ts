import "server-only";
import { readOperational, saveOperational } from "@/app/productie/operationalStore.server";
import { ProductionStoreError } from "@/app/productie/documents.server";
import { SALES_KEY, SETTINGS_KEY, applyForecastCommand, emptySharedSettings, forecastProducts, type ForecastSales, type SharedForecastSettings } from "./sharedSettings";

export async function readForecastSales(): Promise<ForecastSales> {
  const sales = await readOperational<ForecastSales | null>(SALES_KEY, null);
  if (sales?.version !== 1 || !sales.products?.length) throw new ProductionStoreError("De verkoopbasis voor kerst is nog niet bereikbaar.");
  return sales;
}
export async function readForecastSettings(): Promise<SharedForecastSettings> {
  return readOperational(SETTINGS_KEY, emptySharedSettings());
}
export async function saveForecastCommand(command: unknown, actor: string): Promise<SharedForecastSettings> {
  const sales = await readForecastSales();
  for (let attempt = 0; ; attempt++) {
    const current = await readForecastSettings();
    const productIds = new Set(forecastProducts(sales.products, current).map(product => product.id));
    const next = applyForecastCommand(current, command, productIds, actor, new Date().toISOString());
    if (next === current) return current;
    try {
      await saveOperational(SETTINGS_KEY, current.revision, next, actor);
      return next;
    } catch (error) {
      if (!(error instanceof ProductionStoreError) || error.status !== 409 || attempt >= 3) throw error;
    }
  }
}
