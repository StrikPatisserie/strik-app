import { projectedSales, type SalesProduct } from "./forecast";
import { salesVariant } from "./variants";
import { isPetitDV } from "./petitProducts";

export const stockCategories = [
  { id: "kerst", name: "Kerst" },
  { id: "gebak", name: "Gebak" },
  { id: "taart", name: "Taart" },
  { id: "slof", name: "Slof/schnitt/vlaai" },
  { id: "bak", name: "Bakkant" },
  { id: "petit-dv", name: "Petit DV" },
  { id: "overig", name: "Overig" },
] as const;
export type StockCategory = typeof stockCategories[number]["id"];
export type CatalogArticle = { name: string; newNumber: string | null; previousNumber: string | null; groupNumber: string; groupName: string };
export type SalesLine = { name: string; code: string; quantity: number | null; variant?: string; originalName?: string };
type FolderProduct = { id: string; name: string };

const key = (name: string) => name.trim().toLocaleLowerCase("nl-NL");
const normalize = (name: string) => key(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const foodGroups = new Set(["10", "20", "25", "30", "35", "40", "45", "50", "60", "65", "70", "75", "85", "90", "120", "145", "150", "155", "160"]);
const bakeryGroups = new Set(["40", "45", "50", "60", "120", "145", "150", "155", "160"]);
const christmasCodes = new Set(["20831", "20833", "65830", "65832"]);
const placeholder = "9999999999";

export function stockCategory(name: string, article?: CatalogArticle): StockCategory | null {
  const text = normalize(`${name} ${article?.name || ""}`);
  if (/bezorg|bez\.kost|toeslag|korting|coupon|kadobon|cadeaubon|verpakking|winkelbenodigd|draagtas|cadeaupapier|statiegeld|emballage|^logo op /i.test(text)) return null;
  if (article && !foodGroups.has(article.groupNumber)) return null;
  // Christmas wins over the usual department, including marzipan cakes.
  if (/kerst|xmas|noel|arrenslee|\bstol(?:len)?\b|amandelstaaf|amandelkrans/.test(text) || article?.newNumber && christmasCodes.has(article.newNumber)) return "kerst";
  if (isPetitDV(text)) return "petit-dv";
  if (/truffels?(?:\s|$)/.test(text)) return "overig";
  if (article?.groupNumber === "10" || /petit\s*gateau|cheese\s*punt|slofje/.test(text)) return "gebak";
  if (article && ["30", "35"].includes(article.groupNumber) || /slof|schnitt|vlaai/.test(text)) return "slof";
  if (article && ["20", "25"].includes(article.groupNumber) || /taart|cheesecake/.test(text)) return "taart";
  if (article && bakeryGroups.has(article.groupNumber) || /saucij|worstenbrood|brood|croissant|olieboll|appelbeignet/.test(text)) return "bak";
  if (/petit|truffel|bonbon|choco/.test(text) || article) return "overig";
  return null;
}

const folderAliases: Record<string, string> = {
  "stol-groot": "Luxe Kerst stol", tulband: "Kerst Tulband", kerststaaf: "Kerst Amandelstaaf",
  kerstkrans: "Amandel Kerstkrans", kruidcake: "Kerst Kruidcake", bonbons: "Kerstbonbon Cadeau",
  "krans-puur": "Chocolade Kerstkrans Puur", kerstkoekjes: "Kerst Koekkransjes", kerstchocolade: "Luxe Kerst chocolade (per 100gr)",
  schuimkransjes: "Pakje Schuimkransjes",
};

/** Sales channels have different article namespaces. Only identical historical
 * names are combined; renamed articles remain reviewable, never added twice.
 */
export function buildSalesAssortment(cash: SalesLine[], bake: SalesLine[], catalog: CatalogArticle[], folder: FolderProduct[]): SalesProduct[] {
  function expand(lines: SalesLine[]) {
    return lines.map(line => {
      const variant = salesVariant(line.variant || "");
      return { ...line, originalName: line.name, variant, name: variant ? `${line.name} · ${variant}` : line.name };
    });
  }
  function index(lines: SalesLine[]) {
    const result = new Map<string, SalesLine>();
    for (const line of lines) {
      const old = result.get(key(line.name));
      result.set(key(line.name), old ? { ...old, quantity: old.quantity === null && line.quantity === null ? null : (old.quantity ?? 0) + (line.quantity ?? 0) } : line);
    }
    return result;
  }
  const cashNames = index(expand(cash)), bakeNames = index(expand(bake));
  const names = [...new Set([...cashNames.keys(), ...bakeNames.keys()])];
  const used = new Set<string>();
  const products: SalesProduct[] = [];
  function matching(name: string) {
    const c = cashNames.get(key(name)), b = bakeNames.get(key(name));
    const original = c?.originalName || b?.originalName || name;
    return catalog.filter(item => key(item.name) === key(original) || c?.code && c.code !== placeholder && item.newNumber === c.code || b?.code && b.code !== placeholder && item.previousNumber === b.code);
  }
  function add(name: string, id: string, folderProduct = false, displayName = name, forcedArticle?: CatalogArticle) {
    const c = cashNames.get(key(name)), b = bakeNames.get(key(name));
    const originalName = c?.originalName || b?.originalName || name;
    const variant = c?.variant || b?.variant || "";
    const matches = matching(name);
    const article = forcedArticle || matches.find(item => key(item.name) === key(originalName)) || matches.find(item => item.newNumber === c?.code) || matches[0];
    const group = folderProduct ? "kerst" : stockCategory(name, article);
    if (!group) return;
    const aliases = [...new Set([name, originalName, displayName, ...matches.map(item => item.name), ...(article?.newNumber === "40840" ? ["Kerstkransjes"] : [])])];
    // Fractional whole-cake sales are legitimate (e.g. half a cake). They
    // should be uplifted and rounded, not mistaken for an unknown sales unit.
    const wholeCake = article && ["20", "25", "30", "35"].includes(article.groupNumber);
    const unitUnconfirmed = /100\s*g|100gr|per\s*\d|\(.*st\)|pakket|\bpp\b|per\s+persoon/i.test(name) || !wholeCake && [c?.quantity, b?.quantity].some(value => value != null && !Number.isInteger(value));
    const renamed = matches.some(item => key(item.name) !== key(originalName));
    const department = article?.groupNumber === "70" || !article && /choco|bonbon|truffel/i.test(name) ? "chocolade" : group === "bak" || article && bakeryGroups.has(article.groupNumber) || /stol|amandelstaaf|amandelkrans|kruidcake|tulband|koekkrans/i.test(name) ? "bak" : "patisserie";
    used.add(key(name));
    products.push({ id, name: displayName, salesName: originalName, group, department, articleGroup: article?.groupNumber, salesVariant: variant || undefined, cashCode: c?.code || article?.newNumber || "", bakeCode: b?.code || article?.previousNumber || "", cash: c?.quantity ?? null, bake: b?.quantity ?? null, unitUnconfirmed, searchNames: aliases,
      needsSalesReview: unitUnconfirmed || !c || !b || c.code === placeholder || b.code === placeholder || renamed || group === "kerst",
      note: unitUnconfirmed ? "Bronaantallen hebben een te controleren eenheid. Vul het voorbereidingsdoel zelf in stuks in." : renamed ? `Artikelnaam gewijzigd: ${aliases.join(" / ")}. Koppeling controleren.` : !c && !b ? "Nog geen historische verkoop gekoppeld" : "Cash-it en Bake-it aan hetzelfde product koppelen",
      folderProduct });
  }
  for (const item of folder) {
    const sourceName = folderAliases[item.id] || item.name;
    const displayName = item.id === "kerstkoekjes" ? "Kerstkoekkransjes" : item.name;
    const variants = names.filter(name => key(cashNames.get(name)?.originalName || bakeNames.get(name)?.originalName || "") === key(sourceName));
    if (!variants.length) add(sourceName, `folder:${item.id}`, true, displayName);
    for (const name of variants) {
      const variant = cashNames.get(name)?.variant || bakeNames.get(name)?.variant;
      add(name, `folder:${item.id}${variant ? `:${variant}` : ""}`, true, variant ? `${displayName} · ${variant}` : displayName);
    }
  }
  for (const name of names) {
    if (used.has(name)) continue;
    const original = cashNames.get(name)?.name || bakeNames.get(name)!.name;
    add(original, `${/kerst|xmas|no[eëö]l|arrenslee/i.test(original) ? "history" : "bakery"}:${name}`);
  }
  // Expose the rest of the current food catalogue with unknown sales, rather
  // than treating a missing source row as zero. One entry per current code.
  const seenCodes = new Set(products.map(product => product.cashCode).filter(Boolean));
  for (const item of catalog) {
    if (!item.newNumber || item.newNumber === placeholder || seenCodes.has(item.newNumber) || used.has(key(item.name)) || !stockCategory(item.name, item)) continue;
    add(item.name, `catalog:${item.newNumber}`, false, item.name, item);
    seenCodes.add(item.newNumber);
  }
  const codeCounts = new Map<string, number>();
  for (const product of products) if (product.cashCode) codeCounts.set(product.cashCode, (codeCounts.get(product.cashCode) ?? 0) + 1);
  for (const product of products) if ((codeCounts.get(product.cashCode) ?? 0) > 1) {
    product.articleAmbiguous = true;
    product.needsSalesReview = true;
    product.note += " Meerdere verkoopnamen op dit artikelnummer: voorraadartikel zelf controleren en koppelen.";
  }
  return aggregateMarzipanCakes(splitChristmasCakeSizes(products));
}

/** Owner-confirmed Cash-it subcode report, week 47–53 without Wijchen,
 * supplied 10 Nov 2026. The owner assigned all 41 KB invoice cakes to 6–8p.
 * Chipolata's physical subcode count is 75, superseding the Excel's 74.5.
 * Keep this adjustment explicit and reject it if the underlying totals change.
 */
export function splitChristmasCakeSizes(products: SalesProduct[]): SalesProduct[] {
  const splits: Record<string, { expectedCash: number[]; expectedBake: number; rows: { size: string; cash: number; bake: number }[] }> = {
    "25831": { expectedCash: [74.5, 75], expectedBake: 0, rows: [{ size: "6–8p", cash: 47, bake: 0 }, { size: "10–12p", cash: 28, bake: 0 }] },
    "25832": { expectedCash: [128], expectedBake: 41, rows: [{ size: "6–8p", cash: 103, bake: 41 }, { size: "10–12p", cash: 25, bake: 0 }] },
  };
  return products.flatMap(product => {
    const split = product.group === "kerst" ? splits[product.cashCode] : undefined;
    if (!split || product.salesVariant) return [product];
    if (product.cash === null || !split.expectedCash.includes(product.cash) || product.bake !== split.expectedBake) return [{ ...product, needsSalesReview: true, note: `${product.note} Formaatuitsplitsing niet toegepast: controleer de gewijzigde verkoopbasis.` }];
    return split.rows.map(row => ({ ...product, id: `${product.id}:${row.size}`, name: `${product.name} · ${row.size}`, cash: row.cash, bake: row.bake, unitUnconfirmed: false, articleAmbiguous: true,
      searchNames: [...(product.searchNames || []), `${product.name} ${row.size}`],
      note: `Bevestigde formaatuitsplitsing 2025 zonder Wijchen (10 nov 2026). ${product.cashCode === "25831" ? "Cash-it: 47 kleine + 28 grote taarten = 75, vervangt 74,5 uit de Excel." : "Cash-it: 103 kleine + 25 grote taarten; debiteuren: 41 kleine taarten."} Voorraad en recept per formaat koppelen.` }));
  });
}

/** Keep Christmas, explicitly small cakes and per-person sales separate.
 * Combine source quantities before applying the uplift, so individual
 * variants are not rounded up separately or removed by the 20-cake cutoff.
 */
export function aggregateMarzipanCakes(products: SalesProduct[]): SalesProduct[] {
  const members = products.filter(product => product.group === "taart" && /marsepein/.test(normalize(product.name))
    && (!product.salesVariant || product.salesVariant === "10–12p")
    && !/\bpp\b|per\s+persoon|\b(?:4|6|8)\s*(?:[-–]\s*(?:6|8))?\s*(?:p\b|pers)/.test(normalize(product.name)));
  if (!members.length) return products;
  const sum = (channel: "cash" | "bake") => members.every(member => member[channel] === null) ? null : members.reduce((total, member) => total + (member[channel] ?? 0), 0);
  const merged: SalesProduct = {
    id: "aggregate:marsepeintaarten-10-12p", name: "Marsepeintaarten · 10–12p", group: "taart", department: "patisserie",
    cash: sum("cash"), bake: sum("bake"), cashCode: "", bakeCode: "", members,
    searchNames: [...new Set(members.flatMap(member => [member.name, member.cashCode, member.bakeCode, ...(member.searchNames || [])]).filter(Boolean))],
    needsSalesReview: true, articleAmbiguous: true, folderProduct: false,
    unitUnconfirmed: members.some(member => member.unitUnconfirmed),
    note: "Gewone marsepeintaarten 10–12p samengevoegd. Kleine taarten, verkoop per persoon en kerstvarianten staan apart. Voorraad van deze verzameling moet per variant worden gekoppeld.",
  };
  const ids = new Set(members.map(member => member.id));
  return [...products.filter(product => !ids.has(product.id)), merged];
}

/** Keep the original primary article ID for saved settings and preserve each
 * source member for daily receipts, search and weekly historical data. */
function combineArticleFamily(products: SalesProduct[], family: {
  name: string;
  group: StockCategory;
  codes: string[];
  note: string;
}): SalesProduct[] {
  const articles = new Set(family.codes);
  const members = products.filter(product => !product.members && articles.has(product.cashCode)
    && (!product.salesVariant || product.salesVariant === "standaard"));
  if (members.length < 2) return products;
  const preferred = members.find(product => product.cashCode === family.codes[0]) || members[0];
  const sum = (channel: "cash" | "bake") => members.every(member => member[channel] === null)
    ? null : Math.round(members.reduce((total, member) => total + (member[channel] ?? 0), 0) * 1e6) / 1e6;
  const weeks = members.flatMap(member => member.week52 ? [member.week52] : []);
  const issue = weeks.find(week => week.issue)?.issue || (weeks.length !== members.length ? `Week 52 ontbreekt voor een variant van ${family.name}` : undefined);
  const week52 = weeks.length ? {
    cash: Math.round(weeks.reduce((total, week) => total + week.cash, 0) * 1e6) / 1e6,
    bake: Math.round(weeks.reduce((total, week) => total + week.bake, 0) * 1e6) / 1e6,
    ...(issue ? { issue } : {}),
  } : undefined;
  const merged: SalesProduct = {
    ...preferred,
    name: family.name,
    group: family.group,
    cash: sum("cash"),
    bake: sum("bake"),
    week52,
    members,
    unitUnconfirmed: members.some(member => member.unitUnconfirmed),
    articleAmbiguous: true,
    needsSalesReview: members.some(member => member.needsSalesReview),
    searchNames: [...new Set(members.flatMap(member => [member.name, member.cashCode, member.bakeCode, ...(member.searchNames || [])]).filter(Boolean))],
    note: family.note,
  };
  const ids = new Set(members.map(member => member.id));
  return products
    .filter(product => product.id === preferred.id || !ids.has(product.id))
    .map(product => product.id === preferred.id ? merged : product);
}

export function combinePetitFours(products: SalesProduct[]): SalesProduct[] {
  const combined = combineArticleFamily(products, {
    name: "Petit fours wit",
    group: "petit-dv",
    codes: ["65300", "65301", "65302"],
    note: "Petit fours per stuk, met tekst en met logo samengeteld. Alle drie de artikelnummers blijven meetellen in het dagelijkse verloop.",
  });
  return combined.map(product => product.cashCode === "65300" && (!product.salesVariant || product.salesVariant === "standaard")
    ? { ...product, name: "Petit fours wit", group: "petit-dv", overviewSubtitle: "Totaal inclusief foto- en tekstpetitfours" } : product);
}

export function combineKruidcakes(products: SalesProduct[]): SalesProduct[] {
  return combineArticleFamily(products, {
    name: "Kruidcake",
    group: "bak",
    codes: ["40350", "40821", "40861"],
    note: "Kruidcake, Sint Pepernoten Kruidcake en Seizoens Kruidcake samengeteld. Alle drie de artikelnummers blijven meetellen in het dagelijkse verloop.",
  });
}

export function includeInStockOverview(product: SalesProduct, growth: number): boolean {
  const articleNumber = /^\d+$/.test(product.cashCode.trim()) ? Number(product.cashCode) : null;
  if (articleNumber !== null && articleNumber >= 145100 && articleNumber <= 150802) return false;
  const names = normalize([product.name, ...(product.searchNames || [])].join(" "));
  if (/olieboll|appelbeignet|poedersuikersticks/.test(names)) return false;
  if (product.group === "overig" && /choco(?:lade)?[-\s]*letter|spuit[-\s]*letter|vorm[-\s]*letter|luxe\s+letter/.test(names)) return false;
  const base = product.cash === null && product.bake === null ? null : (product.cash ?? 0) + (product.bake ?? 0);
  const projection = product.unitUnconfirmed ? null : projectedSales(base === null ? null : base * (product.unitsPerSale ?? 1), growth);
  const chocolateWork = product.articleGroup === "70" || !product.articleGroup && product.department === "chocolade";
  if (projection === null || projection <= 0) return false;
  if (product.group === "kerst") return !chocolateWork;
  const minimum = product.group === "taart" ? 20 : ["gebak", "bak", "overig"].includes(product.group) ? 100 : 0;
  return projection >= minimum;
}

export function salesVolume(product: SalesProduct): "high" | "medium" | "low" | "unknown" {
  if (product.unitUnconfirmed || product.cash === null && product.bake === null) return "unknown";
  const base = ((product.cash ?? 0) + (product.bake ?? 0)) * (product.unitsPerSale ?? 1);
  return base >= 1000 ? "high" : base >= 300 ? "medium" : "low";
}
