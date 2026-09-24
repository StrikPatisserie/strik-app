export const BUSINESS_FOLDER_LOGO_PRICE_INCL = 0.5;

const FOOD_VAT_FACTOR = 1.09;

export function businessFolderLogoPrice(includeVat: boolean) {
  if (includeVat) return BUSINESS_FOLDER_LOGO_PRICE_INCL;
  return Math.round((BUSINESS_FOLDER_LOGO_PRICE_INCL / FOOD_VAT_FACTOR + Number.EPSILON) * 100) / 100;
}
