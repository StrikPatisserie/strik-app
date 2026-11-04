import type { RevenueDayRecord, RevenueShop } from "./revenueData";

export const HOME_REVENUE_SHOPS: RevenueShop[] = ["Heyendaal", "Ziekerstraat", "Daalseweg", "Lent"];
export type HomeDayRevenueRow = { shop: RevenueShop; date: string | null; amount: number | null };
export type HomeDayRevenue = { date: string | null; shops: HomeDayRevenueRow[] };

export function amsterdamDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Amsterdam",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  return ["year","month","day"].map(type => parts.find(part=>part.type===type)?.value).join("-");
}
function validDay(date:string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
}
/** Only actual imported daily closings; never weekly Excel seeds or forecasts.
 * Keep dates per shop so a late report cannot silently turn yesterday into today. */
export function latestHomeDayRevenue(records: RevenueDayRecord[], now = new Date()): HomeDayRevenue {
  const today = amsterdamDateKey(now);
  const latest = new Map<RevenueShop, RevenueDayRecord>();
  for (const record of records) {
    if (!HOME_REVENUE_SHOPS.includes(record.shop) || record.source !== "dagafsluiting" || !validDay(record.date) || record.date > today || !Number.isFinite(record.amount) || record.amount < 0) continue;
    const previous = latest.get(record.shop);
    const timestamp = (row:RevenueDayRecord) => Date.parse(row.updatedAt || row.importedAt || "") || 0;
    if (!previous || record.date > previous.date || (record.date === previous.date && timestamp(record) >= timestamp(previous))) latest.set(record.shop, record);
  }
  const shops = HOME_REVENUE_SHOPS.map(shop => {
    const record = latest.get(shop);
    return {shop,date:record?.date || null,amount:record?.amount ?? null};
  });
  return {date: shops.flatMap(row=>row.date?[row.date]:[]).sort().at(-1) || null,shops};
}
export function revenueDateLabel(date:string,now:Date):string {
  if (!validDay(date)) return "";
  const today = amsterdamDateKey(now);
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate()-1);
  const relative = date === today ? "vandaag" : date === yesterday.toISOString().slice(0,10) ? "gisteren" : "";
  const short = new Intl.DateTimeFormat("nl-NL", {timeZone:"Europe/Amsterdam",weekday:"short",day:"numeric",month:"short"}).format(new Date(`${date}T12:00:00Z`)).replace(/\./g,"");
  return relative ? `${relative} · ${short}` : short;
}
