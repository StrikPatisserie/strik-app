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
  const multiplier = Math.max(0, amount);

  return recipe.ingredients.map((item) => ({
    ...item,
    quantity: item.quantity * multiplier,
    costContribution: item.costContribution * multiplier,
  }));
}

export function scaledSemiFinishedItems(recipe: Recipe, amount: number) {
  const multiplier = Math.max(0, amount);

  return recipe.semiFinishedItems.map((item) => ({
    ...item,
    quantity: item.quantity * multiplier,
    costContribution: item.costContribution * multiplier,
  }));
}

export function maxPiecesForIngredient(recipe: Recipe, ingredientId: string, stock: number) {
  const directNeed = recipe.ingredients
    .filter((item) => item.ingredientId === ingredientId)
    .reduce((total, item) => total + item.quantity, 0);

  if (!directNeed) return null;

  return Math.floor(stock / directNeed);
}
