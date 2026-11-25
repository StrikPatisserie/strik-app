import type { SalesProduct } from "./forecast";
import { christmasCakeVariant } from "./christmasCakes";

const nameKey = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(?:xmas|kerst|noel)\b/g, "").trim();

function family(product: SalesProduct) {
  const name = nameKey(product.name);
  if (christmasCakeVariant(product) || product.group === "taart" || /taart(?!je)/.test(name)) return 0;
  if (product.group === "gebak" || /taartje|gebak|gateau|tompouce|tartelette|tiramisu|dessert/.test(name)) return 1;
  if (product.group === "slof" || /slof|schnitt|vlaai/.test(name)) return 2;
  if (/stol/.test(name)) return 3;
  if (/amandel|speculaas/.test(name)) return 4;
  if (/tulband|cake|brownie|blondie/.test(name)) return 5;
  if (product.group === "petit-dv" || /petit|macaron|mergpijp|bokkepoot/.test(name)) return 6;
  if (/krans|koek|schuim|meringue/.test(name)) return 7;
  if (/chocola|bonbon|truffel/.test(name)) return 8;
  if (/pakket|cadeau|gift/.test(name)) return 9;
  return 10;
}

/** Keep similar products and their sizes together, regardless of sales volume. */
export function compareStockProducts(a: SalesProduct, b: SalesProduct) {
  const group = family(a) - family(b);
  if (group) return group;
  const christmas = (christmasCakeVariant(a)?.rank ?? 6) - (christmasCakeVariant(b)?.rank ?? 6);
  return christmas || nameKey(a.name).localeCompare(nameKey(b.name), "nl", { numeric: true })
    || (a.salesVariant || "").localeCompare(b.salesVariant || "", "nl", { numeric: true }) || a.id.localeCompare(b.id);
}
