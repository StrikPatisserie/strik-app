import { products } from "../sint-voor-bedrijven/sintProducts";
import { christmasProducts } from "../kerst-voor-bedrijven/christmasProducts";
export type BusinessProductPhoto = { id: string; name: string; image: string };
const catalog: BusinessProductPhoto[] = [...products, ...christmasProducts.map(product => ({ ...product, id: `kerst-${product.id}` }))].flatMap(product => product.image ? [{ id: product.id, name: product.name, image: product.image }] : []);
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const names = [...new Map(catalog.map(product => [product.name.toLowerCase(), product])).values()].sort((a, b) => b.name.length - a.name.length);
const mentions = new RegExp(names.map(product => escaped(product.name)).join("|"), "gi");
const packageProduct = products.find(product => product.id === "speculaasbrok-met-letter")!;
const legacyPackage = new RegExp(`(${escaped(packageProduct.name)}\\s*·\\s*(?:${packageProduct.variants!.map(variant => escaped(variant.label)).join("|")}))(?=\\s*(?:\\r?\\n|$|·\\s*(?:€|eigen logo)))`, "gi");

export function businessProductTextParts(original: string) {
  // Display the original standard S on older requests, without changing stored orders.
  const text = original.replace(legacyPackage, "$1 · letter S");
  const result: { text: string; product?: BusinessProductPhoto }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(mentions)) {
    const at = match.index!;
    if (at > 0 && /[\p{L}\p{N}]/u.test(text[at - 1]) || /[\p{L}\p{N}]/u.test(text[at + match[0].length] || "")) continue;
    if (at > cursor) result.push({ text: text.slice(cursor, at) });
    result.push({ text: match[0], product: names.find(product => product.name.toLowerCase() === match[0].toLowerCase()) });
    cursor = at + match[0].length;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor) });
  return result;
}
