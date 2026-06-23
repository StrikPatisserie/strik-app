export type RecipeType = "finalProduct" | "semiFinished";
export type RecipeStatus = "active" | "draft" | "old";
export type RecipeUnit = "gram" | "kg" | "ml" | "liter" | "stuk";
export type SalesPeriod = "week" | "month" | "year";
export type ProductionLogSource = "work" | "manual" | "stock";
export type ProductionRequestStatus = "open" | "done";
export type IngredientStatus = "active" | "inactive";
export type PackagingStatus = "active" | "inactive";
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

export type BakeryHomeNote = {
  id: string;
  text: string;
  updatedAt: string;
};

export type BakeryHomeOffer = {
  id: string;
  weekStart: string;
  weekEnd: string;
  label: string;
  imageUrl: string;
  mediaId?: number;
  fileName?: string;
  createdAt: string;
  updatedAt: string;
};

export type BakeryHomeData = {
  notes: BakeryHomeNote[];
  offers: BakeryHomeOffer[];
};

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

export type RecipeImportCandidateKind = "ingredient" | "semiFinished";

export type RecipeImportCandidate = {
  id: string;
  recipeName: string;
  name: string;
  quantity: number;
  unit: RecipeUnit;
  sourceLine: string;
  suggestedKind: RecipeImportCandidateKind;
};

export type PackagingItem = {
  id: string;
  name: string;
  supplier: string;
  articleNumber: string;
  packageSize: string;
  quantityPerPackage: number;
  packagePrice: number;
  unitPrice: number;
  status: PackagingStatus;
  lastUpdated: string;
};

export type RecipePackagingLine = {
  id?: string;
  packagingId: string;
  quantity: number;
  unitPrice: number;
  costContribution: number;
  nameSnapshot?: string;
};

export type ProductionLogEntry = {
  id: string;
  date: string;
  quantity: number;
  note?: string;
  source?: ProductionLogSource;
};

export type ProductionRequest = {
  id: string;
  date: string;
  quantity: number;
  reason: string;
  status: ProductionRequestStatus;
};

export type ManualProductionPlanningItem = {
  id: string;
  date: string;
  title: string;
  quantity: number;
  unit: string;
  note: string;
  status: ProductionRequestStatus;
  createdAt: string;
  completedAt?: string;
};

export type Recipe = {
  id: string;
  name: string;
  type: RecipeType;
  productGroup: string;
  standardBatchQuantity?: number;
  standardBatchUnit?: RecipeUnit;
  salesPrice: number;
  costPrice: number;
  previousCostPrice: number;
  targetMargin: number;
  currentMargin: number;
  status: RecipeStatus;
  ingredients: RecipeIngredient[];
  semiFinishedItems: SemiFinishedUsage[];
  packagingItems?: RecipePackagingLine[];
  workInstructions?: string[];
  preparationSteps: string[];
  finishingSteps?: string[];
  equipment?: string[];
  allergens: string[];
  internalNotes?: string;
  isWorkModeVisible?: boolean;
  workCategories?: string[];
  version: string;
  lastUpdated: string;
  portionLabel: string;
  batchSize: string;
  photoHint: string;
  photoPreviewDataUrl?: string;
  photoFileName?: string;
  photoUpdatedAt?: string;
  notes: string;
  linkedFinalProductIds?: string[];
  packagingCost?: number;
  decorationCost?: number;
  decorationMargin?: number;
  averageSalesQuantity?: number;
  averageSalesPeriod?: SalesPeriod;
  canProduceAhead?: boolean;
  desiredProductionFrequencyDays?: number;
  desiredProductionBatchQuantity?: number;
  lastProducedAt?: string;
  lastProducedQuantity?: number;
  productionLog?: ProductionLogEntry[];
  productionRequests?: ProductionRequest[];
};

export type InvoiceLine = {
  id?: string;
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
