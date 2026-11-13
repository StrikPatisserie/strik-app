import type { SalesProduct } from "./forecast";

export type DebtorSalesLine = {
  code: string;
  subcode: string;
  name: string;
  quantity: number;
  row: number;
};

const text = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("nl-NL");
const rounded = (value: number) => Math.round(value * 1e6) / 1e6;

/** Marti Orbak's delivery-date report has two header rows and may insert
 * empty columns. Read quantities by their headers, never monetary columns. */
export function parseDebtorReport(rows: unknown[][]): DebtorSalesLine[] {
  const header = rows.findIndex((row, index) => text(row[0]) === "artikel"
    && row.some((value, column) => text(value) === "verkocht" && text(rows[index - 1]?.[column]) === "aantal"));
  if (header < 1) throw Error("De aantal-kolommen van het debiteurenrapport ontbreken.");
  const quantityColumn = rows[header].findIndex((value, column) => text(value) === "totaal" && text(rows[header - 1][column]) === "aantal");
  if (quantityColumn < 3) throw Error("De netto-afzet van het debiteurenrapport ontbreekt.");
  const result: DebtorSalesLine[] = [];
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const code = String(row[0] ?? "").match(/^\s*(\d+)\s+(\d{3})\s*$/);
    if (!code) continue; // Category subtotals have no article/subcode pair.
    const name = row.slice(1, quantityColumn - 2).find(value => typeof value === "string" && value.trim());
    const quantity = row[quantityColumn];
    if (typeof name !== "string" || typeof quantity !== "number" || !Number.isFinite(quantity)) {
      throw Error(`Artikel of afzet ontbreekt op rapportregel ${index + 1}.`);
    }
    const key = `${code[1]}:${code[2]}:${text(name)}`;
    if (seen.has(key)) throw Error(`Dubbele debiteurenregel op rapportregel ${index + 1}.`);
    seen.add(key);
    result.push({ code: code[1], subcode: code[2], name: name.trim(), quantity, row: index + 1 });
  }
  if (!result.length) throw Error("Het debiteurenrapport bevat geen artikelregels.");
  return result;
}

function normalizedName(value: string): string {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d+)\s*[-–]\s*(\d+)\s*(?:pers(?:onen)?\.?|p\b)?/g, "$1tot$2p")
    .replace(/(\d+)\s*pers(?:onen)?\.?/g, "$1p")
    .replace(/\b(?:rond|vierkant|horeca)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function uniqueProduct(products: SalesProduct[]): SalesProduct | undefined {
  if (products.length === 1) return products[0];
  // Reused seasonal names may have a separate old invoice-only alias. Keep
  // the existing Cash-it product ID, where the user's recipe/choices live.
  const withCashSales = products.filter(product => product.cash !== null);
  return withCashSales.length === 1 ? withCashSales[0] : undefined;
}

function matchesName(product: SalesProduct, name: string): boolean {
  return [product.name, `${product.salesName || product.name} ${product.salesVariant || ""}`]
    .some(value => normalizedName(value) === normalizedName(name));
}

function matchProduct(line: DebtorSalesLine, products: SalesProduct[]): SalesProduct | undefined {
  const candidates = products.filter(product => product.cashCode === line.code);
  if (!candidates.length || line.code === "9999999999") {
    const named = products.filter(product => matchesName(product, line.name));
    if (named.length === 1) return named[0];
    // Placeholder article numbers identify unrelated products. A number or
    // matching size alone can never select one of them.
    if (line.code === "9999999999") return undefined;
  }
  const named = uniqueProduct(candidates.filter(product => matchesName(product, line.name)));
  if (named) return named;
  const variant = uniqueProduct(candidates.filter(product => product.salesVariant
    && normalizedName(line.name).endsWith(normalizedName(product.salesVariant))));
  if (variant) return variant;
  if (line.code === "40823" && line.subcode === "779" && /kleine pop zonder amandel/i.test(line.name)) {
    return candidates.find(product => product.salesVariant === "pop klein zonder amandel");
  }
  // These invoice subcodes were already combined in the existing Appel
  // Royale baseline. Keep that product and record both source subcodes.
  if (line.code === "20305" && ["092", "094"].includes(line.subcode) && /^appel royale /i.test(line.name)) {
    return uniqueProduct(candidates.filter(product => !product.salesVariant));
  }
  return line.subcode === "000"
    ? uniqueProduct(candidates.filter(product => !product.salesVariant)) : undefined;
}

function outsideAssortment(line: DebtorSalesLine): boolean {
  return /bezorg|bez\.kost|toeslag|administratiekosten|kostenpl\.|logo per stuk|verpakking|^tasje\b|^open artikel\b/i.test(line.name)
    || /spuitletter|vormletter/i.test(line.name);
}

/** Replace a complete debtor export, preserving stable product IDs, Cash-it
 * sales and family members. Omitted articles have zero debtor sales. Each
 * source row is assigned once, and unresolved production rows stop import. */
export function replaceDebtorSales(products: SalesProduct[], period: DebtorSalesLine[], week52?: DebtorSalesLine[]) {
  const leaves = products.flatMap(product => product.members || [product]);
  const periodTotals = new Map<string, number>();
  const weeklyTotals = new Map<string, number>();
  const sourceRows = new Map<string, DebtorSalesLine[]>();
  const ignored: DebtorSalesLine[] = [];
  const unresolved: DebtorSalesLine[] = [];
  const assignments: { line: DebtorSalesLine; productId: string }[] = [];
  for (const line of period) {
    const product = matchProduct(line, leaves);
    if (!product) {
      (outsideAssortment(line) ? ignored : unresolved).push(line);
      continue;
    }
    periodTotals.set(product.id, rounded((periodTotals.get(product.id) || 0) + line.quantity));
    sourceRows.set(product.id, [...(sourceRows.get(product.id) || []), line]);
    assignments.push({ line, productId: product.id });
  }
  if (unresolved.length) throw Error(`Debiteurenartikel nog koppelen: ${unresolved.map(line => `${line.code}/${line.subcode} ${line.name}`).join(", ")}`);
  if (week52) {
    for (const line of week52) {
      const assignment = assignments.find(entry => entry.line.code === line.code
        && entry.line.subcode === line.subcode && normalizedName(entry.line.name) === normalizedName(line.name));
      if (!assignment) {
        if (outsideAssortment(line)) continue;
        throw Error(`Week-52-artikel ontbreekt in de periode: ${line.name}`);
      }
      weeklyTotals.set(assignment.productId, rounded((weeklyTotals.get(assignment.productId) || 0) + line.quantity));
    }
    for (const [id, quantity] of weeklyTotals) {
      if (quantity > (periodTotals.get(id) || 0) + 0.000001) throw Error(`Week 52 is groter dan de periodeafzet van ${id}.`);
    }
  }
  function apply(product: SalesProduct): SalesProduct {
    const members = product.members?.map(apply);
    const bake = members ? rounded(members.reduce((sum, member) => sum + (member.bake || 0), 0)) : periodTotals.get(product.id) || 0;
    const cashWeek = product.week52?.cash || 0;
    const bakeWeek = members ? rounded(members.reduce((sum, member) => sum + (member.week52?.bake || 0), 0)) : weeklyTotals.get(product.id) || 0;
    // Keep unrelated Cash-it issues. The previous combined-period comparison
    // is recalculated after the corrected debtor quantities are attached.
    let issue = product.week52?.issue?.includes("groter dan de periodebasis") ? undefined : product.week52?.issue;
    if (cashWeek + bakeWeek > (product.cash || 0) + bake + 0.000001) issue = "Week 52 is groter dan de periodebasis. Controleer de selectie.";
    const hasWeeklyCoverage = product.week52 !== undefined || bakeWeek !== 0;
    return {
      ...product, bake, ...(members ? { members } : {}),
      debtorSources: members ? members.flatMap(member => member.debtorSources || []) : sourceRows.get(product.id) || [],
      ...(week52 ? { week52: hasWeeklyCoverage ? { cash: cashWeek, bake: bakeWeek, ...(issue ? { issue } : {}) } : undefined } : {}),
    };
  }
  return { products: products.map(apply), assignments, ignored };
}
