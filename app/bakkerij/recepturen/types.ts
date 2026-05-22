export type RecipeType = "finalProduct" | "semiFinished";
export type RecipeStatus = "active" | "draft" | "old";
export type RecipeUnit = "gram" | "kg" | "ml" | "liter" | "stuk";
export type IngredientStatus = "active" | "inactive";
export type MarginStatus = "good" | "pressure" | "critical";
export type InvoiceReviewStatus =
  | "pending"
  | "approved"
  | "ignored"
  | "reverted";
export type InvoiceImportStatus =
  | "analyzed"
  | "review"
  | "processed"
  | "ignored"
  | "reverted";

export type Ingredient = {
  id: string;
  name: string;
  supplier: string;
  supplierArticleNumber: string;
  packageSize: string;
  recipeUnit: RecipeUnit;
  lastPrice: number;
  previousPrice: number;
  pricePerBaseUnit: number;
  allergens: string[];
  lastUpdated: string;
  status: IngredientStatus;
  lastInvoice: string;
  aliases: string[];
};

export type RecipeIngredient = {
  ingredientId: string;
  quantity: number;
  unit: RecipeUnit;
  wastePercentage?: number;
  costContribution: number;
};

export type SemiFinishedUsage = {
  semiFinishedRecipeId: string;
  quantity: number;
  unit: RecipeUnit;
  costContribution: number;
};

export type Recipe = {
  id: string;
  name: string;
  type: RecipeType;
  productGroup: string;
  salesPrice: number;
  costPrice: number;
  previousCostPrice: number;
  targetMargin: number;
  currentMargin: number;
  status: RecipeStatus;
  ingredients: RecipeIngredient[];
  semiFinishedItems: SemiFinishedUsage[];
  preparationSteps: string[];
  allergens: string[];
  version: string;
  lastUpdated: string;
  portionLabel: string;
  batchSize: string;
  photoHint: string;
  notes: string;
  linkedFinalProductIds?: string[];
  packagingCost?: number;
  decorationCost?: number;
};

export type InvoiceLine = {
  articleNumber: string;
  description: string;
  quantity: number;
  unit: string;
  totalPrice: number;
  pricePerUnit: number;
  matchedIngredientId?: string;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  reviewStatus: InvoiceReviewStatus;
  previousLastInvoice?: string;
  appliedAt?: string;
  revertedAt?: string;
};

export type InvoiceImport = {
  id: string;
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  uploadedAt: string;
  status: InvoiceImportStatus;
  lines: InvoiceLine[];
};

export type StockEntry = {
  ingredientId: string;
  quantity: number;
  unit: RecipeUnit;
};
