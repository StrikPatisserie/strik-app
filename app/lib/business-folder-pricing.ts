export const BUSINESS_FOLDER_LOGO_PRICE_INCL = 0.5;

const FOOD_VAT_FACTOR = 1.09;

export const BUSINESS_FOLDER_PRICE_TIERS = [
  { min: 1, label: "1–24", discountPercent: 0 },
  { min: 25, label: "25–50", discountPercent: 5 },
  { min: 51, label: "51–100", discountPercent: 10 },
  { min: 101, label: "101–200", discountPercent: 15 },
  { min: 201, label: ">200", discountPercent: 20 },
];

export function businessFolderRetailPrice(
  retailPriceIncl: number,
  discountPercent: number,
  includeVat: boolean,
  fixedSurchargeIncl = 0
) {
  const discountedIncl = Math.ceil((retailPriceIncl * (1 - discountPercent / 100) - Number.EPSILON) * 20) / 20;
  const totalIncl = Math.round((discountedIncl + fixedSurchargeIncl + Number.EPSILON) * 100) / 100;
  return includeVat ? totalIncl : Math.round((totalIncl / FOOD_VAT_FACTOR + Number.EPSILON) * 100) / 100;
}

export function businessFolderLogoPrice(includeVat: boolean) {
  if (includeVat) return BUSINESS_FOLDER_LOGO_PRICE_INCL;
  return Math.round((BUSINESS_FOLDER_LOGO_PRICE_INCL / FOOD_VAT_FACTOR + Number.EPSILON) * 100) / 100;
}
