export const LETTER_GIFT_WRAP_PRICE_CENTS = 25;

export function letterGiftWrapPrice(includeVat = true) {
  const incl = LETTER_GIFT_WRAP_PRICE_CENTS / 100;
  return includeVat ? incl : Math.round((incl / 1.09 + Number.EPSILON) * 100) / 100;
}
