import type {
  Ingredient,
  InvoiceLine,
  MarginStatus,
  Recipe,
  RecipeIngredient,
  RecipeStatus,
  RecipeType,
  RecipeUnit,
  SemiFinishedUsage,
} from "./types";

export function formatEuro(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function baseUnitFactor(unit: RecipeUnit) {
  if (unit === "gram" || unit === "ml") return 1000;

  return 1;
}

export function packagePriceLabel(unit: RecipeUnit) {
  if (unit === "gram" || unit === "kg") return "Prijs /kg";
  if (unit === "ml" || unit === "liter") return "Prijs /l";

  return "Prijs /st";
}

export function ingredientPackagePrice(ingredient: Ingredient) {
  if (
    ingredient.lastPrice > 0 &&
    ingredient.lastPrice < 1 &&
    ingredient.pricePerBaseUnit > 0 &&
    Math.abs(ingredient.lastPrice - ingredient.pricePerBaseUnit) < 0.000001
  ) {
    return ingredient.pricePerBaseUnit * baseUnitFactor(ingredient.recipeUnit);
  }

  if (ingredient.lastPrice > 0) return ingredient.lastPrice;

  return ingredient.pricePerBaseUnit * baseUnitFactor(ingredient.recipeUnit);
}

export function ingredientPreviousPackagePrice(ingredient: Ingredient) {
  if (
    ingredient.previousPrice > 0 &&
    ingredient.previousPrice < 1 &&
    ingredient.pricePerBaseUnit > 0 &&
    Math.abs(ingredient.previousPrice - ingredient.pricePerBaseUnit) < 0.000001
  ) {
    return ingredient.previousPrice * baseUnitFactor(ingredient.recipeUnit);
  }

  if (ingredient.previousPrice > 0) return ingredient.previousPrice;

  return ingredient.previousPrice * baseUnitFactor(ingredient.recipeUnit);
}

export function normalizePackagePrice(value: number, unit: RecipeUnit = "gram") {
  if (value > 0 && value < 1 && (unit === "gram" || unit === "ml")) {
    return value * 1000;
  }

  return value;
}

export function pricePerBaseUnitFromPackagePrice(
  price: number,
  unit: RecipeUnit
) {
  return price / baseUnitFactor(unit);
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toLocaleString("nl-NL", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}%`;
}

export function formatSignedPercent(value: number, digits = 0) {
  return `${value > 0 ? "+" : ""}${formatPercent(value, digits)}`;
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function marginStatusForRecipe(recipe: Recipe): MarginStatus {
  if (recipe.type === "semiFinished") return "good";
  if (recipe.currentMargin >= recipe.targetMargin) return "good";
  if (recipe.currentMargin >= recipe.targetMargin - 3) return "pressure";

  return "critical";
}

export function marginStatusLabel(status: MarginStatus) {
  if (status === "good") return "Goed";
  if (status === "pressure") return "Onder druk";

  return "Kritisch";
}

export function recipeStatusLabel(status: RecipeStatus) {
  if (status === "active") return "Actief";
  if (status === "draft") return "Concept";

  return "Oud recept";
}

export function recipeTypeLabel(type: RecipeType) {
  return type === "finalProduct" ? "Eindproduct" : "Halffabricaat";
}

export function unitLabel(unit: RecipeUnit) {
  if (unit === "kg") return "kg";
  if (unit === "gram") return "g";
  if (unit === "liter") return "l";
  if (unit === "ml") return "ml";

  return "st.";
}

export function quantityLabel(quantity: number, unit: RecipeUnit) {
  return `${quantity.toLocaleString("nl-NL", {
    maximumFractionDigits: quantity < 10 ? 2 : 0,
  })} ${unitLabel(unit)}`;
}

export function ingredientPriceChange(ingredient: Ingredient) {
  const previousPrice = ingredientPreviousPackagePrice(ingredient);
  if (!previousPrice) return 0;

  return ((ingredientPackagePrice(ingredient) - previousPrice) / previousPrice) * 100;
}

export function recipeCostChange(recipe: Recipe) {
  if (!recipe.previousCostPrice) return 0;

  return ((recipe.costPrice - recipe.previousCostPrice) / recipe.previousCostPrice) * 100;
}

export function recipeCostDelta(recipe: Recipe) {
  return recipe.costPrice - recipe.previousCostPrice;
}

export function targetSalesPrice(recipe: Recipe) {
  if (!recipe.targetMargin || recipe.targetMargin >= 100) return recipe.salesPrice;

  return recipe.costPrice / (1 - recipe.targetMargin / 100);
}

export function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase("nl-NL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function directIngredientCost(ingredients: RecipeIngredient[]) {
  return ingredients.reduce((total, item) => total + item.costContribution, 0);
}

export function semiFinishedCost(items: SemiFinishedUsage[]) {
  return items.reduce((total, item) => total + item.costContribution, 0);
}

export function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Math.round(value * 1000) / 1000;
}

export function calculateMargin(salesPrice: number, costPrice: number) {
  if (!salesPrice) return 0;

  return Math.round(((salesPrice - costPrice) / salesPrice) * 1000) / 10;
}

export function unitFromText(value: string): RecipeUnit {
  const normalized = value.toLowerCase();
  if (["kg", "kilo", "kilogram"].includes(normalized)) return "kg";
  if (["g", "gr", "gram"].includes(normalized)) return "gram";
  if (["l", "ltr", "liter"].includes(normalized)) return "liter";
  if (normalized === "ml") return "ml";

  return "stuk";
}

export function recipeBatchInfo(recipe?: Recipe | null) {
  if (!recipe) return null;

  if (recipe.standardBatchQuantity && recipe.standardBatchUnit) {
    return {
      quantity: recipe.standardBatchQuantity,
      unit: recipe.standardBatchUnit,
    };
  }

  const match = recipe.batchSize.match(
    /(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram|g|gr|gram|l|ltr|liter|ml|st|stuk|stuks)\b/i
  );
  if (!match) return null;

  const quantity = parseDutchQuantity(match[1]);
  if (!quantity) return null;

  return {
    quantity,
    unit: unitFromText(match[2]),
  };
}

export function recipeBatchQuantity(recipe: Recipe) {
  return recipeBatchInfo(recipe)?.quantity || 1;
}

export function convertQuantityToUnit(
  quantity: number,
  fromUnit: RecipeUnit,
  toUnit: RecipeUnit
) {
  if (fromUnit === toUnit) return quantity;
  if (isWeightUnit(fromUnit) && isWeightUnit(toUnit)) {
    const grams = fromUnit === "kg" ? quantity * 1000 : quantity;
    return toUnit === "kg" ? grams / 1000 : grams;
  }
  if (isVolumeUnit(fromUnit) && isVolumeUnit(toUnit)) {
    const ml = fromUnit === "liter" ? quantity * 1000 : quantity;
    return toUnit === "liter" ? ml / 1000 : ml;
  }

  return quantity;
}

export function ingredientCostForQuantity(
  ingredient: Ingredient,
  quantity: number,
  unit: RecipeUnit
) {
  const baseQuantity = convertQuantityToUnit(quantity, unit, ingredient.recipeUnit);

  return roundMoney(baseQuantity * ingredient.pricePerBaseUnit);
}

export function semiFinishedCostForQuantity(
  recipe: Recipe,
  quantity: number,
  unit: RecipeUnit
) {
  const batch = recipeBatchInfo(recipe);
  if (!batch || batch.quantity <= 0) return roundMoney(recipe.costPrice * quantity);

  const requested = convertQuantityToUnit(quantity, unit, batch.unit);

  return roundMoney((requested / batch.quantity) * recipe.costPrice);
}

export function costPriceFromBatchCost(
  type: RecipeType,
  batchCost: number,
  batchQuantity: number
) {
  if (type === "finalProduct" && batchQuantity > 0) {
    return roundMoney(batchCost / batchQuantity);
  }

  return roundMoney(batchCost);
}

export function recipeCostBreakdown(
  recipe: Recipe,
  ingredients: Ingredient[],
  recipes: Recipe[]
) {
  const recalculatedIngredients = recipe.ingredients.map((item) => {
    const ingredient = findIngredient(ingredients, item.ingredientId);

    return {
      ...item,
      costContribution: ingredient
        ? ingredientCostForQuantity(ingredient, item.quantity, item.unit)
        : 0,
    };
  });
  const recalculatedSemiFinished = recipe.semiFinishedItems.map((item) => {
    const linkedRecipe = findRecipe(recipes, item.semiFinishedRecipeId);

    return {
      ...item,
      costContribution: linkedRecipe
        ? semiFinishedCostForQuantity(linkedRecipe, item.quantity, item.unit)
        : 0,
    };
  });
  const directCost = directIngredientCost(recalculatedIngredients);
  const semiFinishedTotal = semiFinishedCost(recalculatedSemiFinished);
  const extraCost = (recipe.packagingCost || 0) + (recipe.decorationCost || 0);
  const batchCost = roundMoney(directCost + semiFinishedTotal + extraCost);
  const costPrice = costPriceFromBatchCost(
    recipe.type,
    batchCost,
    recipeBatchQuantity(recipe)
  );

  return {
    ingredients: recalculatedIngredients,
    semiFinishedItems: recalculatedSemiFinished,
    directCost,
    semiFinishedCost: semiFinishedTotal,
    extraCost,
    batchCost,
    costPrice,
  };
}

export function recalculateRecipeCosts(
  recipe: Recipe,
  ingredients: Ingredient[],
  recipes: Recipe[],
  options: { markAsUpdated?: boolean } = {}
): Recipe {
  const costs = recipeCostBreakdown(recipe, ingredients, recipes);

  return {
    ...recipe,
    ingredients: costs.ingredients,
    semiFinishedItems: costs.semiFinishedItems,
    previousCostPrice:
      costs.costPrice === recipe.costPrice ? recipe.previousCostPrice : recipe.costPrice,
    costPrice: costs.costPrice,
    currentMargin: calculateMargin(recipe.salesPrice, costs.costPrice),
    lastUpdated: options.markAsUpdated ? new Date().toISOString().slice(0, 10) : recipe.lastUpdated,
  };
}

export function recalculateAllRecipeCosts(
  recipes: Recipe[],
  ingredients: Ingredient[],
  options: { markAsUpdated?: boolean } = {}
) {
  const originals = new Map(
    recipes.map((recipe) => [
      recipe.id,
      {
        costPrice: recipe.costPrice,
        previousCostPrice: recipe.previousCostPrice,
        lastUpdated: recipe.lastUpdated,
      },
    ])
  );
  let recipePool = recipes;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    recipePool = recipePool.map((recipe) =>
      recalculateRecipeCosts(recipe, ingredients, recipePool)
    );
  }

  return recipePool.map((recipe) => {
    const original = originals.get(recipe.id);
    const changed = original ? recipe.costPrice !== original.costPrice : true;

    return {
      ...recipe,
      previousCostPrice: changed
        ? original?.costPrice || recipe.previousCostPrice
        : original?.previousCostPrice || recipe.previousCostPrice,
      lastUpdated:
        options.markAsUpdated && changed
          ? new Date().toISOString().slice(0, 10)
          : original?.lastUpdated || recipe.lastUpdated,
    };
  });
}

export function findIngredient(ingredients: Ingredient[], id: string) {
  return ingredients.find((ingredient) => ingredient.id === id);
}

export function findRecipe(recipes: Recipe[], id: string) {
  return recipes.find((recipe) => recipe.id === id);
}

export function linkedFinalProducts(recipes: Recipe[], semiFinishedId: string) {
  return recipes.filter((recipe) =>
    recipe.semiFinishedItems.some((item) => item.semiFinishedRecipeId === semiFinishedId)
  );
}

export function recipesUsingIngredient(recipes: Recipe[], ingredientId: string) {
  return recipes.filter((recipe) =>
    recipe.ingredients.some((item) => item.ingredientId === ingredientId)
  );
}

export function invoiceLineImpact(line: InvoiceLine, recipes: Recipe[]) {
  if (!line.matchedIngredientId) return [];

  return recipesUsingIngredient(recipes, line.matchedIngredientId)
    .slice(0, 4)
    .map((recipe) => recipe.name);
}

export function scaledRecipeIngredients(recipe: Recipe, amount: number) {
  const multiplier = recipeProductionMultiplier(recipe, amount);

  return recipe.ingredients.map((item) => ({
    ...item,
    quantity: item.quantity * multiplier,
    costContribution: item.costContribution * multiplier,
  }));
}

export function scaledSemiFinishedItems(recipe: Recipe, amount: number) {
  const multiplier = recipeProductionMultiplier(recipe, amount);

  return recipe.semiFinishedItems.map((item) => ({
    ...item,
    quantity: item.quantity * multiplier,
    costContribution: item.costContribution * multiplier,
  }));
}

function recipeProductionMultiplier(recipe: Recipe, amount: number) {
  const safeAmount = Math.max(0, amount);

  if (recipe.type !== "finalProduct") return safeAmount;

  return safeAmount / recipeBatchQuantity(recipe);
}

export function maxPiecesForIngredient(recipe: Recipe, ingredientId: string, stock: number) {
  const directNeed = recipe.ingredients
    .filter((item) => item.ingredientId === ingredientId)
    .reduce((total, item) => total + item.quantity, 0);

  if (!directNeed) return null;

  return Math.floor(stock / directNeed);
}

function parseDutchQuantity(value: string) {
  const quantity = Number.parseFloat(
    value
      .trim()
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(quantity) && quantity > 0
    ? Math.round(quantity * 10000) / 10000
    : 0;
}

function isWeightUnit(unit: RecipeUnit) {
  return unit === "gram" || unit === "kg";
}

function isVolumeUnit(unit: RecipeUnit) {
  return unit === "ml" || unit === "liter";
}
