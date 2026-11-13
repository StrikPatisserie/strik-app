import type { SalesProduct } from "./forecast";

const normalize = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("nl-NL");
export const isPetitDV = (name: string) => /\bpetit\s*(?:fleurs?|cremes?|fours?|choux?|gateau)\b/.test(normalize(name));
const packs: Record<string, { size: number; name: RegExp }> = {
  "10601": { size: 6, name: /petit\s*gateau.*\(6st\)/ },
  "10604": { size: 6, name: /petit\s*gateau.*\(6st\)/ },
  "65100": { size: 6, name: /petit\s*four.*\(6st\)/ },
  "65101": { size: 15, name: /petit\s*creme.*\(15st\)/ },
};

/** Apply to imported and already saved source rows without changing their IDs
 * or raw sales. Forecasts and receipt quantities use the same explicit factor.
 * Unknown subcodes, weights and fractional pack counts remain reviewable. */
export function normalizePetitProducts(products: SalesProduct[]): SalesProduct[] {
  return products.map(product => {
    const name = normalize(product.salesName || product.name);
    const group = product.group !== "kerst" && isPetitDV(product.name) ? "petit-dv" : product.group;
    const pack = packs[product.cashCode];
    const standard = !product.salesVariant || product.salesVariant === "standaard";
    const wholeCounts = [product.cash, product.bake].every(value => value === null || Number.isInteger(value));
    if (pack && standard && pack.name.test(name) && wholeCounts) return {
      ...product, group, unitsPerSale: pack.size, unitUnconfirmed: false,
      overviewSubtitle: `Per ${pack.size} verpakt · prognose in stuks`,
    };
    if (product.cashCode === "65200" && standard && /petit\s*chou.*200\s*gr/.test(name) && wholeCounts) return {
      ...product, group, quantityLabel: "zakjes", unitUnconfirmed: false,
      overviewSubtitle: "Zakjes van circa 200 g · prognose in zakjes",
    };
    return { ...product, group };
  });
}
