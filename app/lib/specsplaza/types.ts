export type SpecsPlazaEnvironment = "test" | "production";

export type SpecsPlazaProduct = {
  id: string;
  name: string;
  articleNumber: string;
  supplier: string;
};

export type SpecsPlazaConnectionResult = {
  environment: SpecsPlazaEnvironment;
  checkedAt: string;
  totalProducts: number | null;
  products: SpecsPlazaProduct[];
  sample: {
    product: SpecsPlazaProduct;
    versionNumber: number | null;
    validationDate: string | null;
    allergens: {
      name: string;
      status: "Absent" | "Present" | "RiskCrossContamination" | "Unknown" | "NotFilledIn";
    }[];
    nutritionalValues: {
      name: string;
      value: number | null;
      unit: string;
    }[];
  } | null;
};
