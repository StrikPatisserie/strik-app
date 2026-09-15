export const ALLERGENS = [
  "Selderij",
  "Vis",
  "Schaaldieren",
  "Mosterd",
  "Zwaveldioxide en sulfieten",
  "Weekdieren",
  "Lupine",
  "Pinda",
  "Soja",
  "Noten",
  "Sesam",
  "Melk (lactose)",
  "Gluten",
  "Alcohol",
  "Ei",
] as const;

export type AllergenName = (typeof ALLERGENS)[number];

export type AllergenListLine = {
  id: string;
  recipeId?: string;
  productName: string;
  allergens: AllergenName[];
  origins: Partial<Record<AllergenName, string>>;
};

export type CustomerAllergenList = {
  id: string;
  customerName: string;
  contactName: string;
  reference: string;
  lines: AllergenListLine[];
  createdAt: string;
  updatedAt: string;
};
