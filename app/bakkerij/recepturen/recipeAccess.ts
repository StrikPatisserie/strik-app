import type { RecepturenData } from "./recepturenApi";
import type { Recipe } from "./types";

// Explicit production projections keep newly added financial fields private by default.
function pick<T extends object>(value: T, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, (value as Record<string, unknown>)[key]]));
}
export function recipeDataForProduction(data: RecepturenData): RecepturenData {
  return {
    financialAccess: false,
    ingredients: data.ingredients.map(item => ({
      ...pick(item, ["id", "name", "supplier", "supplierArticleNumber", "packageSize", "recipeUnit", "allergens", "lastUpdated", "status", "aliases"]),
      specification: item.specification ? pick(item.specification, ["specsPlazaId", "specificationVersion", "ingredientsText", "allergensConfirmed", "nutritionPer100g", "densityGramsPerMl", "pieceWeightGrams", "source", "updatedAt"]) : undefined,
      lastPrice: 0, previousPrice: 0, pricePerBaseUnit: 0, lastInvoice: "",
    })) as RecepturenData["ingredients"],
    recipes: data.recipes.map(item => ({
      ...pick(item, ["id", "name", "strikArticleNumber", "type", "productGroup", "createdAt", "standardBatchQuantity", "standardBatchUnit", "status", "workInstructions", "preparationSteps", "finishingSteps", "equipment", "allergens", "isWorkModeVisible", "workCategories", "version", "lastUpdated", "portionLabel", "batchSize", "photoHint", "photoPreviewDataUrl", "photoFileName", "photoUpdatedAt", "notes", "linkedFinalProductIds", "canProduceAhead", "desiredProductionFrequencyDays", "desiredProductionBatchQuantity", "lastProducedAt", "lastProducedQuantity", "productionLog", "productionRequests"]),
      labeling: item.labeling ? pick(item.labeling, ["productName", "ingredientsText", "finalBatchWeightGrams", "netQuantity", "storageInstructions", "shelfLifeText", "operatorDetails", "notes"]) : undefined,
      ingredients: item.ingredients.map(line => ({ ...pick(line, ["ingredientId", "quantity", "unit", "wastePercentage", "sortOrder"]), costContribution: 0 })),
      semiFinishedItems: item.semiFinishedItems.map(line => ({ ...pick(line, ["semiFinishedRecipeId", "quantity", "unit", "sortOrder"]), costContribution: 0 })),
      packagingItems: item.packagingItems?.map(line => ({ ...pick(line, ["id", "packagingId", "quantity", "nameSnapshot"]), unitPrice: 0, costContribution: 0 })),
      salesPrice: 0, costPrice: 0, previousCostPrice: 0, targetMargin: 0, currentMargin: 0,
    })) as Recipe[],
    packagingItems: data.packagingItems?.map(item => ({ ...pick(item, ["id", "name", "supplier", "articleNumber", "packageSize", "quantityPerPackage", "status", "lastUpdated"]), packagePrice: 0, unitPrice: 0 })) as RecepturenData["packagingItems"],
    invoiceImports: [], hefeOrderHistory: [],
    bakeryHome: data.bakeryHome,
    manualProductionPlanningItems: data.manualProductionPlanningItems,
    allergenLists: data.allergenLists,
    updatedAt: data.updatedAt,
  };
}

// Production accounts may update production registrations; recipe administration,
// ingredients, prices and invoices remain untouched on the server.
const productionFields = [
  "productionLog", "productionRequests", "currentStock", "stockQuantity",
  "lastProducedAt", "lastProducedQuantity", "lastProductionDate", "stockUpdatedAt",
] as const;
export function mergeProductionUpdates(current: RecepturenData, incoming: RecepturenData): RecepturenData {
  const incomingById = new Map(incoming.recipes.map(recipe => [recipe.id, recipe]));
  return {
    ...current,
    recipes: current.recipes.map(recipe => {
      const update = incomingById.get(recipe.id);
      if (!update) return recipe;
      const changes: Record<string, unknown> = {};
      for (const key of productionFields) if (Object.hasOwn(update, key)) changes[key] = (update as unknown as Record<string, unknown>)[key];
      return { ...recipe, ...changes } as Recipe;
    }),
    manualProductionPlanningItems: incoming.manualProductionPlanningItems ?? current.manualProductionPlanningItems,
    bakeryHome: incoming.bakeryHome ?? current.bakeryHome,
  };
}
