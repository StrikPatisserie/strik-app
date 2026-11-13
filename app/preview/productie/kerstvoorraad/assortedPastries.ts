import type { SalesProduct } from "./forecast";

export const ASSORTED_ARTICLE = "10000";
/** Owner's selection, 13 Nov 2026. Seasonal aliases share one actual article. */
export const ASSORTED_PASTRIES = [
  { article: "10100", id: "bakery:bossche bol" },
  { article: "10101", id: "bakery:tompouce" },
  { article: "10102", id: "bakery:framboos slagroom" },
  { article: "10200", id: "bakery:nougatine vanille cremegebak" },
  { article: "10301", id: "bakery:appel royale punt" },
  { article: "10400", id: "bakery:passievol bombe" },
  { article: "10401", id: "bakery:steventje" },
  { article: "10402", id: "bakery:herfst parel", aliases: ["bakery:lente parel"] },
  { article: "10403", id: "bakery:brownie trésor" },
  { article: "10404", id: "bakery:hazelino" },
  { article: "10405", id: "bakery:hazelnootbol" },
  { article: "10407", id: "bakery:pistache slofje" },
  { article: "10409", id: "bakery:carrot rondo" },
  { article: "10430", id: "bakery:seizoens cheese punt (appel-bitterkoek)", aliases: ["bakery:seizoens cheese punt (framboos-merengue)"] },
  { article: "10431", id: "bakery:red velvet punt" },
] as const;

/** Whole pieces, spread as evenly as possible. Continue at the next recipient
 * across sales channels, so rounding never creates or loses a pastry. Returns
 * reverse the same allocation; any fractional source quantity is kept. */
export function assortedShares(quantity: number, offset = 0): number[] {
  const count = ASSORTED_PASTRIES.length, absolute = Math.abs(quantity);
  const whole = Math.trunc(absolute), base = Math.floor(whole / count), rest = whole % count;
  const sign = quantity < 0 ? -1 : 1;
  return ASSORTED_PASTRIES.map((_, index) => sign * (base + ((index - offset + count) % count < rest ? 1 : 0) + (absolute - whole) / count));
}

/** Derived view only: keep the imported sales document untouched. Remove the
 * assorted source after assigning it once, before growth and volume cutoffs.
 * Unknown variants stop the allocation instead of guessing which row to use. */
export function allocateAssortedSales(products: SalesProduct[]): SalesProduct[] {
  const sources = products.filter(product => product.cashCode === ASSORTED_ARTICLE);
  if (!sources.length) return products;
  const targets = ASSORTED_PASTRIES.map(target => {
    const matches = products.filter(product => product.cashCode === target.article);
    const preferred = matches.find(product => product.id === target.id) || (matches.length === 1 ? matches[0] : undefined);
    const aliases: readonly string[] = "aliases" in target ? target.aliases : [];
    return preferred && matches.every(product => product === preferred || aliases.includes(product.id))
      && matches.every(product => !product.members && !product.salesVariant && !product.unitUnconfirmed)
      ? { preferred, matches } : null;
  });
  if (targets.some(target => !target) || sources.some(product => product.members || product.unitUnconfirmed || product.cash === null && product.bake === null)) {
    return products.map(product => sources.includes(product) ? { ...product, needsSalesReview: true,
      note: `${product.note} Gesorteerd gebak nog niet verdeeld: controleer de 15 artikelkoppelingen.` } : product);
  }
  const sum = (rows: SalesProduct[], channel: "cash" | "bake") => rows.every(row => row[channel] === null) ? null : rows.reduce((total, row) => total + (row[channel] ?? 0), 0);
  const sourceCash = sum(sources, "cash") ?? 0, sourceBake = sum(sources, "bake") ?? 0;
  const cashShares = assortedShares(sourceCash), bakeShares = assortedShares(sourceBake, Math.trunc(Math.abs(sourceCash)) % ASSORTED_PASTRIES.length);
  const weeks = sources.flatMap(product => product.week52 ? [product.week52] : []);
  const weekIssue = weeks.find(week => week.issue)?.issue;
  const weekCash = weeks.reduce((total, week) => total + week.cash, 0), weekBake = weeks.reduce((total, week) => total + week.bake, 0);
  const weeklyCash = assortedShares(weekCash), weeklyBake = assortedShares(weekBake, Math.trunc(Math.abs(weekCash)) % ASSORTED_PASTRIES.length);
  const replacements = new Map<string, SalesProduct>();
  const removed = new Set(sources.map(product => product.id));
  targets.forEach((target, index) => {
    if (!target) return;
    const { preferred, matches } = target;
    matches.filter(product => product !== preferred).forEach(product => removed.add(product.id));
    const add = (channel: "cash" | "bake", share: number) => {
      const original = sum(matches, channel);
      return original === null && share === 0 ? null : (original ?? 0) + share;
    };
    const ownWeeks = matches.flatMap(product => product.week52 ? [product.week52] : []);
    const issue = ownWeeks.find(week => week.issue)?.issue || weekIssue || (ownWeeks.length !== matches.length ? "Eigen week-52-verkoop ontbreekt" : undefined) || (weeks.length !== sources.length ? "Week 52 van gesorteerd gebak ontbreekt" : undefined);
    const week52 = ownWeeks.length || weeks.length ? {
      cash: ownWeeks.reduce((total, week) => total + week.cash, 0) + weeklyCash[index],
      bake: ownWeeks.reduce((total, week) => total + week.bake, 0) + weeklyBake[index],
      ...(issue ? { issue } : {}),
    } : undefined;
    replacements.set(preferred.id, { ...preferred, cash: add("cash", cashShares[index]), bake: add("bake", bakeShares[index]), week52,
      articleAmbiguous: false,
      searchNames: [...new Set(matches.flatMap(product => [product.name, ...(product.searchNames || [])]))],
      assortedSales: { cash: cashShares[index], bake: bakeShares[index], ...(weeks.length ? { week52: weeklyCash[index] + weeklyBake[index] } : {}) },
      note: `${preferred.note} Gesorteerd gebak gelijk verdeeld over 15 soorten (schatting); eigen artikelverkopen blijven erbij.`,
    });
  });
  return products.filter(product => !removed.has(product.id)).map(product => replacements.get(product.id) || product);
}
