import type { SalesProduct } from "./forecast";

const normalize = (value: string) => value.trim().toLocaleLowerCase("nl-NL").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[–—]/g, "-");
const usableArticle = (value: string) => /^\d+$/.test(value) && value !== "9999999999";
const largeRange = /\b10\s*-\s*12\s*(?:p\b|pers(?:onen)?\.?)/;
const fourteen = /\b14\s*(?:p\b|pers(?:onen)?\.?|punten\b)/;

/** An explicit subcode takes precedence over a size in the base article name. */
function largeFormat(product: SalesProduct): boolean {
  const variant = normalize(product.salesVariant || "");
  if (variant && variant !== "standaard") return /^(?:10\s*-\s*12\s*(?:p|pers(?:onen)?)|(?:gesneden\s+)?14\s*(?:p|pers(?:onen)?|punten))\.?(?:\s*\(rond\))?$/.test(variant);
  const name = normalize(product.salesName || product.name);
  return largeRange.test(name) || fourteen.test(name);
}
function familyName(product: SalesProduct): string {
  return (product.salesName || product.name).split(/\s+·\s+/)[0]
    .replace(/\b10\s*[-–—]\s*12\s*(?:p\b|pers(?:onen)?\.?)/gi, "")
    .replace(/(?:gesneden\s+)?\b14\s*(?:p\b|pers(?:onen)?\.?|punten\b)/gi, "")
    .replace(/[\s·,;()]+$/g, "").trim();
}
function familyKey(product: SalesProduct): string {
  const name = normalize(familyName(product));
  // Approved seasonal article 30801: the two exports use different seasons.
  return product.cashCode === "30801" && /^(?:herfst|seizoens)vlaai caramel-hazelnoot$/.test(name)
    ? "seizoensvlaai caramel-hazelnoot" : name;
}
const total = (members: SalesProduct[], field: "cash" | "bake") => members.every(member => member[field] === null)
  ? null : Math.round(members.reduce((sum, member) => sum + (member[field] ?? 0), 0) * 1e6) / 1e6;

/** View-only grouping of whole flans, before growth, rounding and filtering.
 * The 8p/subcode rows and imported sales remain untouched. Keep the 10–12p ID
 * so its existing recipe link and manual forecast settings remain available. */
export function combineLargeFlans(products: SalesProduct[]): SalesProduct[] {
  const groups = new Map<string, SalesProduct[]>();
  for (const product of products) {
    if (product.members || product.combinedFlan || !/vlaai\b/.test(normalize(product.name)) || !largeFormat(product)) continue;
    const key = familyKey(product);
    groups.set(key, [...(groups.get(key) || []), product]);
  }
  const replacements = new Map<string, SalesProduct>(), removed = new Set<string>();
  for (const members of groups.values()) {
    if (members.length < 2 && !fourteen.test(normalize(members[0].salesVariant || members[0].name))) continue;
    const preferred = members.find(member => largeRange.test(normalize(member.salesVariant || member.name))) || members[0];
    const ids = new Set(members.map(member => member.id));
    const cashCodes = [...new Set(members.map(member => member.cashCode).filter(usableArticle))];
    const ambiguous = members.some(member => !usableArticle(member.cashCode))
      || products.some(product => !ids.has(product.id) && cashCodes.includes(product.cashCode));
    const weekly = members.flatMap(member => member.week52 ? [member.week52] : []);
    const issue = weekly.find(week => week.issue)?.issue || (weekly.length !== members.length ? "Week 52 ontbreekt voor een vlaaiformaat" : undefined);
    const week52 = weekly.length ? {
      cash: Math.round(weekly.reduce((sum, week) => sum + week.cash, 0) * 1e6) / 1e6,
      bake: Math.round(weekly.reduce((sum, week) => sum + week.bake, 0) * 1e6) / 1e6,
      ...(issue ? { issue } : {}),
    } : undefined;
    replacements.set(preferred.id, { ...preferred, name: `${familyName(preferred)} · 10–12/14p`, salesVariant: "10–12/14p",
      cash: total(members, "cash"), bake: total(members, "bake"), week52, members,
      combinedFlan: { cashCodes }, articleAmbiguous: ambiguous,
      unitUnconfirmed: members.some(member => member.unitUnconfirmed),
      needsSalesReview: members.some(member => member.needsSalesReview),
      searchNames: [...new Set(members.flatMap(member => [member.name, member.cashCode, member.bakeCode, ...(member.searchNames || [])]).filter(Boolean))],
      note: `10–12 personen en gesneden in 14 punten samengeteld als hele vlaaien. 8-persoonsvlaaien staan apart. Bijstellingen gelden voor het samengevoegde totaal.${ambiguous ? " Dagelijkse bonnen moeten het formaat onderscheiden." : ""}`,
    });
    members.filter(member => member !== preferred).forEach(member => removed.add(member.id));
  }
  return products.filter(product => !removed.has(product.id)).map(product => replacements.get(product.id) || product);
}
