import type { RevenueDayRecord, RevenueShop } from "./revenueData";

export const HOME_REVENUE_SHOPS: RevenueShop[] = ["Heyendaal", "Ziekerstraat", "Daalseweg", "Lent"];
export type HomeRevenueComparison = { date: string; amount: number | null; index: number | null };
export type HomeDayRevenueRow = { shop: RevenueShop; date: string | null; amount: number | null; week?: HomeRevenueComparison; year?: HomeRevenueComparison };
export type HomeDayRevenue = { date: string | null; shops: HomeDayRevenueRow[]; navigation?: { previous: string | null; next: string | null; latest: string | null } };

export function amsterdamDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Amsterdam",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  return ["year","month","day"].map(type => parts.find(part=>part.type===type)?.value).join("-");
}
function validDay(date:string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
}
/** Only actual imported daily closings; never weekly Excel seeds or forecasts.
 * Keep dates per shop so a late report cannot silently turn yesterday into today. */
export function latestHomeDayRevenue(records: RevenueDayRecord[], now = new Date(), history: RevenueDayRecord[] = [], selectedDate: string | null = null): HomeDayRevenue {
  const today = amsterdamDateKey(now);
  const latest = new Map<RevenueShop, RevenueDayRecord>();
  const byDay = new Map<string, RevenueDayRecord>();
  // Historical exports are references only; real app reports always take precedence.
  for (const record of history) {
    if (HOME_REVENUE_SHOPS.includes(record.shop) && validDay(record.date) && record.date <= today && Number.isFinite(record.amount) && record.amount >= 0) byDay.set(`${record.shop}:${record.date}`, record);
  }
  const liveByDay = new Map<string, RevenueDayRecord>();
  for (const record of records) {
    if (!HOME_REVENUE_SHOPS.includes(record.shop) || record.source !== "dagafsluiting" || !validDay(record.date) || record.date > today || !Number.isFinite(record.amount) || record.amount < 0) continue;
    const previous = latest.get(record.shop);
    const timestamp = (row:RevenueDayRecord) => Date.parse(row.updatedAt || row.importedAt || "") || 0;
    const key = `${record.shop}:${record.date}`, sameDay = liveByDay.get(key);
    if (!sameDay || timestamp(record) >= timestamp(sameDay)) {
      liveByDay.set(key, record);
      byDay.set(key, record);
    }
    if (!previous || record.date > previous.date || (record.date === previous.date && timestamp(record) >= timestamp(previous))) latest.set(record.shop, record);
  }
  const dates=[...new Set([...liveByDay.values()].map(record=>record.date))].sort();
  const latestDate=dates.at(-1)||null;
  const selected=selectedDate && validDay(selectedDate) && selectedDate<=today ? selectedDate : null;
  const displayDate=selected || latestDate;
  const shops = HOME_REVENUE_SHOPS.map(shop => {
    const record = selected ? liveByDay.get(`${shop}:${selected}`) : latest.get(shop);
    if (!record) return {shop,date:null,amount:null};
    const compare = (days:number):HomeRevenueComparison => {
      const date = new Date(`${record.date}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate()-days);
      const key = date.toISOString().slice(0,10);
      const reference = byDay.get(`${shop}:${key}`);
      // Missing or zero turnover is not a usable denominator; never invent 100.
      return {date:key,amount:reference?.amount ?? null,index:reference && reference.amount > 0 ? Math.round(record.amount/reference.amount*1000)/10 : null};
    };
    return {shop,date:record.date,amount:record.amount,week:compare(7),year:compare(364)};
  });
  return {date: displayDate,shops,navigation:{previous:dates.filter(date=>displayDate && date<displayDate).at(-1)||null,next:dates.find(date=>displayDate && date>displayDate)||null,latest:latestDate}};
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
