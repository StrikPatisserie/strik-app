export type SpecsPlazaEnvironment = "test" | "production";

export type SpecsPlazaProduct = {
  id: string;
  name: string;
  articleNumber: string;
  supplier: string;
};

export type SpecsPlazaSearchField = "name" | "articleNumber" | "supplierCompanyName";

export type SpecsPlazaSearchResult = {
  environment: SpecsPlazaEnvironment;
  checkedAt: string;
  products: SpecsPlazaProduct[];
  nextSkip: number;
  hasMore: boolean;
};

export type SpecsPlazaProductResult = {
  environment: SpecsPlazaEnvironment;
  checkedAt: string;
  product: SpecsPlazaProduct;
  sample: SpecsPlazaConnectionResult["sample"];
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
