import type { SalesProduct } from "./forecast";
import type { SalesLine } from "./assortment";
import { salesVariant } from "./variants";

export type WeeklySalesLine = SalesLine & { variant: string };
const normalize = (value: string) => value.trim().toLocaleLowerCase("nl-NL").replace(/[–—]/g, "-");
const size = (value: string) => value.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:p\b|pers)/i)?.slice(1).join("-");
const usableCode = (code: string) => !!code && code !== "-" && code !== "9999999999";

/** Match complete weekly exports in their own Cash-it/Bake-it namespaces.
 * Subcodes select size-specific rows. A source row is assigned at most once. */
export function attachWeek52Sales(products: SalesProduct[], cash: WeeklySalesLine[], bake: WeeklySalesLine[]): SalesProduct[] {
  const leaves = products.flatMap(product => product.members || [product]);
  const totals = new Map(leaves.map(product => [product.id, { cash: 0, bake: 0, issue: "" }]));
  for (const [channel, lines] of [["cash", cash], ["bake", bake]] as const) {
    const codeKey = channel === "cash" ? "cashCode" : "bakeCode";
    for (const line of lines) {
      if (line.quantity === 0) continue;
      let matches = leaves.filter(product => usableCode(line.code)
        ? product[codeKey] === line.code
        : [product.name, ...(product.searchNames || [])].some(name => normalize(name) === normalize(line.name)));
      const named = matches.filter(product => normalize(product.salesName || product.name) === normalize(line.name));
      const aliased = matches.filter(product => [product.name, ...(product.searchNames || [])].some(name => normalize(name) === normalize(line.name)));
      if (named.length) matches = named;
      else if (aliased.length) matches = aliased;
      if (matches.some(product => product.salesVariant)) {
        const variant = salesVariant(line.variant);
        if (!line.variant.trim()) {
          for (const match of matches) totals.get(match.id)!.issue = "Week 52 heeft geen herkenbare subcode";
          continue;
        }
        matches = matches.filter(product => (product.salesVariant || "") === variant);
      }
      const lineSize = size(salesVariant(line.variant)) || size(line.name);
      if (!lineSize && matches.some(product => size(product.name))) {
        for (const match of matches) totals.get(match.id)!.issue = "Week 52 heeft geen herkenbaar formaat";
        continue;
      }
      if (matches.some(product => size(product.name))) matches = matches.filter(product => size(product.name) === lineSize);
      if (matches.length !== 1) {
        for (const match of matches) totals.get(match.id)!.issue = "Week 52 heeft geen unieke artikel-/formaatkoppeling";
        continue;
      }
      const match = matches[0], total = totals.get(match.id)!;
      if (line.quantity === null) { total.issue = "Een week-52-aantal ontbreekt"; continue; }
      // The family is explicitly 10–12p. Do not put another subcode in it.
      if (lineSize && lineSize !== "10-12" && products.some(product => product.members?.some(member => member.id === match.id))) continue;
      total[channel] += line.quantity;
    }
  }
  function apply(product: SalesProduct): SalesProduct {
    const members = product.members?.map(apply);
    const values = members ? members.map(member => member.week52).filter(value => !!value) : [totals.get(product.id)!];
    const cashTotal = values.reduce((sum, value) => sum + value.cash, 0);
    const bakeTotal = values.reduce((sum, value) => sum + value.bake, 0);
    const historical = product.cash === null && product.bake === null ? null : (product.cash ?? 0) + (product.bake ?? 0);
    const issue = values.find(value => value.issue)?.issue || (historical !== null && cashTotal + bakeTotal > historical + 0.000001 ? "Week 52 is groter dan de periodebasis. Controleer de selectie." : undefined);
    // A catalogue-only product has no verified historical coverage.
    const week52 = historical === null && cashTotal === 0 && bakeTotal === 0 ? undefined : { cash: cashTotal, bake: bakeTotal, ...(issue ? { issue } : {}) };
    return { ...product, ...(members ? { members } : {}), week52 };
  }
  return products.map(apply);
}
