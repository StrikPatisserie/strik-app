import type { SalesProduct } from "./forecast";

export const usableSalesArticle = (code: string) => !!code && code !== "-" && code !== "9999999999";

/** Keep every original Cash-it article in a grouped row. The Set prevents
 * aliases or formats sharing an article from subtracting the same sales twice.
 * Keep missing codes too, so incomplete groups still require a mapping. */
export function salesArticleCodes(product: SalesProduct): string[] {
  const codes = product.members?.length
    ? product.members.flatMap(salesArticleCodes)
    : product.combinedFlan?.cashCodes || [product.cashCode];
  return [...new Set(codes.map(code => code.trim()))];
}
