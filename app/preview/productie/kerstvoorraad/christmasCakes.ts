import type { ProductChoice, SalesProduct } from "./forecast";

/** The six Christmas cake formats stay together, even without sales or a recipe.
 * Source rows and quantities remain the historical 2025 basis. */
export function christmasCakeVariant(product: SalesProduct) {
  const flavour = ["25830", "25831", "25832"].indexOf(product.cashCode);
  if (flavour < 0 || product.members?.length) return null;
  const size = (product.salesVariant || product.name).replace(/\s/g, "");
  const small = /6[–-]8/.test(size);
  if (!small && !/10[–-]12/.test(size)) return null;
  return { rank: small ? flavour : flavour + 3, size: small ? flavour === 0 ? "4–6p" : "6–8p" : "10–12p" };
}

export function hiddenStockProduct(product: SalesProduct, choice?: ProductChoice) {
  return !!choice?.adjustment?.hidden && !christmasCakeVariant(product);
}
