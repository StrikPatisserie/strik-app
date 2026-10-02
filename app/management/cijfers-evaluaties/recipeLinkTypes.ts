export type EvaluationRecipeOption = {
  id: string;
  name: string;
  articleNumber: string;
  costPrice: number;
  salesPrice: number;
  currentMargin: number;
  lastUpdated: string;
};

export type EvaluationRecipeLink = EvaluationRecipeOption & {
  quantity: number;
  revenueGross: number;
  capturedAt: string;
};

export type EvaluationRecipeLinkInput = {
  recipeId: string;
  quantity: number;
  revenueGross: number;
};
