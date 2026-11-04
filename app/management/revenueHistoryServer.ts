import "server-only";
import { createAdminClient } from "../lib/supabase/admin";
import { normalizeRevenueDayRecord, type RevenueDayRecord } from "./revenueData";

export const REVENUE_DAILY_HISTORY_KEY = "management_revenue_daily_history";

/** Private comparison data. These rows never enter accounting rollups or current
 * turnover: the source workbook splits the New Year week by calendar year. */
export async function getRevenueComparisonHistory(): Promise<RevenueDayRecord[]> {
  try {
    const db = createAdminClient();
    const {data,error} = await db.from("app_settings").select("value").eq("key",REVENUE_DAILY_HISTORY_KEY).maybeSingle();
    if (error || !data?.value || typeof data.value !== "object" || Array.isArray(data.value)) return [];
    const value = data.value as Record<string, unknown>;
    if (value.schema !== 1 || !Array.isArray(value.records)) return [];
    return value.records.flatMap(row => { const normalized = normalizeRevenueDayRecord(row); return normalized ? [normalized] : []; });
  } catch { return []; }
}
