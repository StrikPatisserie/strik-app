import type {
  Ingredient,
  InvoiceLine,
  MarginStatus,
  ProductionLogEntry,
  ProductionRequest,
  Recipe,
  RecipeIngredient,
  RecipeStatus,
  RecipeType,
  RecipeUnit,
  SalesPeriod,
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

export function changeBadgeClass(value: number, positiveIsGood = false) {
  if (Math.abs(value) < 0.05) {
    return "bg-[#f1eee9] text-[#2d2a26]/55";
  }

  const isGood = positiveIsGood ? value > 0 : value < 0;

  return isGood
    ? "bg-[#dce8d6] text-[#45663b]"
    : "bg-[#ffe0dc] text-[#a83e31]";
}

export function marginGap(recipe: Recipe) {
  if (recipe.type === "semiFinished") return 0;

  return recipe.salesPrice - targetSalesPrice(recipe);
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

export function todayIsoDate() {
  return localIsoDate(new Date());
}

export function marginStatusForRecipe(recipe: Recipe): MarginStatus {
  if (recipe.type === "semiFinished") return "good";

  const targetPrice = targetSalesPrice(recipe);
  if (!targetPrice) return "good";
  if (recipe.salesPrice >= targetPrice) return "good";
  if (recipe.salesPrice >= targetPrice * 0.97) return "pressure";

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

export function formatBatchWeight(weightKg: number) {
  if (!weightKg) return "-";

  const rounded = Math.round(weightKg * 100) / 100;

  return `${rounded.toLocaleString("nl-NL", {
    maximumFractionDigits: rounded < 10 ? 2 : 1,
    minimumFractionDigits: 0,
  })} kg`;
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

  if (recipe.type !== "finalProduct") {
    return recipe.costPrice / (1 - recipe.targetMargin / 100);
  }

  const extras = recipeExtraCostBreakdown(recipe);
  const marginBaseCost = Math.max(
    0,
    recipe.costPrice - extras.packagingUnitCost - extras.decorationUnitCost
  );
  const decorationMargin = Math.min(
    99,
    Math.max(0, recipe.decorationMargin ?? 30)
  );
  const decorationTarget = extras.decorationUnitCost
    ? extras.decorationUnitCost / (1 - decorationMargin / 100)
    : 0;

  return (
    marginBaseCost / (1 - recipe.targetMargin / 100) +
    extras.packagingUnitCost +
    decorationTarget
  );
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

function formatQuantityForLabel(value: number) {
  return value.toLocaleString("nl-NL", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  });
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

  if (recipe.type === "semiFinished") {
    return roundMoney(requested * recipe.costPrice);
  }

  return roundMoney((requested / batch.quantity) * recipe.costPrice);
}

export function costPriceFromBatchCost(
  type: RecipeType,
  batchCost: number,
  batchQuantity: number
) {
  if ((type === "finalProduct" || type === "semiFinished") && batchQuantity > 0) {
    return roundMoney(batchCost / batchQuantity);
  }

  return roundMoney(batchCost);
}

export function recipeExtraCostBreakdown(recipe: Recipe) {
  if (recipe.type === "semiFinished") {
    return {
      packagingUnitCost: 0,
      decorationUnitCost: 0,
      packagingTotal: 0,
      decorationTotal: 0,
      extraCost: 0,
    };
  }

  const batchQuantity = recipeBatchQuantity(recipe);
  const packagingUnitCost = recipe.packagingCost || 0;
  const decorationUnitCost = recipe.decorationCost || 0;
  const packagingTotal =
    recipe.type === "finalProduct"
      ? packagingUnitCost * batchQuantity
      : packagingUnitCost;
  const decorationTotal =
    recipe.type === "finalProduct"
      ? decorationUnitCost * batchQuantity
      : decorationUnitCost;

  return {
    packagingUnitCost,
    decorationUnitCost,
    packagingTotal: roundMoney(packagingTotal),
    decorationTotal: roundMoney(decorationTotal),
    extraCost: roundMoney(packagingTotal + decorationTotal),
  };
}

export function recipeLineWeightInKg(quantity: number, unit: RecipeUnit) {
  if (unit === "kg") return quantity;
  if (unit === "gram") return quantity / 1000;
  if (unit === "liter") return quantity;
  if (unit === "ml") return quantity / 1000;

  return 0;
}

export function recipeLinesWeightInKg(
  ingredients: RecipeIngredient[],
  semiFinishedItems: SemiFinishedUsage[]
) {
  const directWeight = ingredients.reduce(
    (total, item) => total + recipeLineWeightInKg(item.quantity, item.unit),
    0
  );
  const semiWeight = semiFinishedItems.reduce(
    (total, item) => total + recipeLineWeightInKg(item.quantity, item.unit),
    0
  );

  return roundMoney(directWeight + semiWeight);
}

export function recipeBatchWeightKg(recipe: Recipe) {
  return recipeLinesWeightInKg(recipe.ingredients, recipe.semiFinishedItems);
}

export function scaledRecipeBatchWeightKg(recipe: Recipe, multiplier: number) {
  return roundMoney(recipeBatchWeightKg(recipe) * Math.max(0, multiplier));
}

const SALES_PERIOD_DAYS: Record<SalesPeriod, number> = {
  week: 7,
  month: 30,
  year: 365,
};

export type ProductionNeedStatus = "none" | "ok" | "soon" | "due" | "overdue";

export type ProductionNeed = {
  recipe: Recipe;
  status: ProductionNeedStatus;
  manualRequestId?: string;
  requestReason?: string;
  requestedQuantity?: number;
  averageSalesQuantity: number;
  averageSalesPeriod: SalesPeriod;
  lastProducedAt: string;
  lastProducedQuantity: number;
  nextProductionDate: string;
  daysUntilProduction: number;
  daysCovered: number;
  estimatedRemainingQuantity: number;
};

export function salesPeriodLabel(period: SalesPeriod) {
  if (period === "month") return "maand";
  if (period === "year") return "jaar";

  return "week";
}

export function salesPeriodDays(period: SalesPeriod = "week") {
  return SALES_PERIOD_DAYS[period] || SALES_PERIOD_DAYS.week;
}

export function normalizeProductionLog(entries: ProductionLogEntry[] = []) {
  return entries
    .filter((entry) => entry.date && entry.quantity > 0)
    .map((entry) => ({
      id: entry.id || `production-${entry.date}-${entry.quantity}`,
      date: entry.date,
      quantity: roundPlanningQuantity(entry.quantity),
      note: entry.note || "",
      source: entry.source || "manual",
    }))
    .sort((first, second) => {
      const dateCompare = second.date.localeCompare(first.date);

      return dateCompare || second.id.localeCompare(first.id);
    });
}

export function productionLogForRecipe(recipe: Recipe) {
  const log = normalizeProductionLog(recipe.productionLog || []);
  if (log.length) return log;

  if (!recipe.lastProducedAt || !recipe.lastProducedQuantity) return [];

  return [
    {
      id: `legacy-${recipe.id}-${recipe.lastProducedAt}`,
      date: recipe.lastProducedAt,
      quantity: recipe.lastProducedQuantity,
      note: "Eerdere productieregistratie",
      source: "work" as const,
    },
  ];
}

export function normalizeProductionRequests(
  requests: ProductionRequest[] = []
) {
  return requests
    .filter((request) => request.date && request.quantity > 0)
    .map((request) => ({
      id: request.id || `request-${request.date}-${request.quantity}`,
      date: request.date,
      quantity: roundPlanningQuantity(request.quantity),
      reason: request.reason || "Extra productie",
      status: request.status || "open",
    }))
    .sort((first, second) => {
      const dateCompare = first.date.localeCompare(second.date);

      return dateCompare || first.id.localeCompare(second.id);
    });
}

export function openProductionRequests(recipe: Recipe) {
  return normalizeProductionRequests(recipe.productionRequests || []).filter(
    (request) => request.status === "open"
  );
}

export function syncRecipeProductionMetadata(recipe: Recipe): Recipe {
  if (recipe.type !== "finalProduct") {
    return {
      ...recipe,
      averageSalesQuantity: 0,
      averageSalesPeriod: "week",
      lastProducedAt: "",
      lastProducedQuantity: 0,
      productionLog: [],
      productionRequests: [],
    };
  }

  const productionLog = normalizeProductionLog(productionLogForRecipe(recipe));
  const productionRequests = normalizeProductionRequests(
    recipe.productionRequests || []
  );
  const latestEntry = productionLog[0];
  const averageSalesPeriod = recipe.averageSalesPeriod || "week";
  const learnedAverageSalesQuantity = learnedSalesAverageFromLog(
    productionLog,
    averageSalesPeriod
  );

  return {
    ...recipe,
    averageSalesQuantity:
      learnedAverageSalesQuantity || Math.max(0, recipe.averageSalesQuantity || 0),
    averageSalesPeriod,
    lastProducedAt: latestEntry?.date || "",
    lastProducedQuantity: latestEntry?.quantity || 0,
    productionLog,
    productionRequests,
  };
}

export function productionNeedForRecipe(
  recipe: Recipe,
  today: Date = new Date()
): ProductionNeed {
  const syncedRecipe = syncRecipeProductionMetadata(recipe);
  const averageSalesQuantity = Math.max(
    0,
    syncedRecipe.averageSalesQuantity || 0
  );
  const averageSalesPeriod = syncedRecipe.averageSalesPeriod || "week";
  const lastProducedQuantity =
    syncedRecipe.lastProducedQuantity || recipeBatchQuantity(recipe);

  if (syncedRecipe.type !== "finalProduct" || averageSalesQuantity <= 0) {
    return {
      recipe: syncedRecipe,
      status: "none",
      averageSalesQuantity,
      averageSalesPeriod,
      lastProducedAt: syncedRecipe.lastProducedAt || "",
      lastProducedQuantity,
      nextProductionDate: "",
      daysUntilProduction: 9999,
      daysCovered: 0,
      estimatedRemainingQuantity: 0,
    };
  }

  const todayStart = dateAtStartOfDay(today);
  const lastProducedAt = syncedRecipe.lastProducedAt || "";

  if (!lastProducedAt) {
    return {
      recipe: syncedRecipe,
      status: "due",
      averageSalesQuantity,
      averageSalesPeriod,
      lastProducedAt: "",
      lastProducedQuantity,
      nextProductionDate: todayIsoDate(),
      daysUntilProduction: 0,
      daysCovered: 0,
      estimatedRemainingQuantity: 0,
    };
  }

  const dailySales = averageSalesQuantity / salesPeriodDays(averageSalesPeriod);
  const daysCovered = dailySales > 0 ? lastProducedQuantity / dailySales : 0;
  const lastProducedDate = isoDateAtStartOfDay(lastProducedAt);
  const nextProductionDateObject = new Date(lastProducedDate);
  const daysSinceProduction = Math.max(
    0,
    Math.floor((todayStart.getTime() - lastProducedDate.getTime()) / 86400000)
  );
  const estimatedRemainingQuantity = roundPlanningQuantity(
    Math.max(0, lastProducedQuantity - dailySales * daysSinceProduction)
  );

  nextProductionDateObject.setDate(
    lastProducedDate.getDate() + Math.max(1, Math.floor(daysCovered))
  );

  const daysUntilProduction = Math.ceil(
    (nextProductionDateObject.getTime() - todayStart.getTime()) / 86400000
  );
  const status: ProductionNeedStatus =
    daysUntilProduction < 0
      ? "overdue"
      : daysUntilProduction <= 1
        ? "due"
        : daysUntilProduction <= 7
          ? "soon"
          : "ok";

  return {
    recipe: syncedRecipe,
    status,
    averageSalesQuantity,
    averageSalesPeriod,
    lastProducedAt,
    lastProducedQuantity,
    nextProductionDate: localIsoDate(nextProductionDateObject),
    daysUntilProduction,
    daysCovered,
    estimatedRemainingQuantity,
  };
}

export function productionNeedForRequest(
  recipe: Recipe,
  request: ProductionRequest,
  today: Date = new Date()
): ProductionNeed {
  const baseNeed = productionNeedForRecipe(recipe, today);
  const todayStart = dateAtStartOfDay(today);
  const requestDate = isoDateAtStartOfDay(request.date);
  const daysUntilProduction = Math.ceil(
    (requestDate.getTime() - todayStart.getTime()) / 86400000
  );
  const status: ProductionNeedStatus =
    daysUntilProduction < 0
      ? "overdue"
      : daysUntilProduction <= 1
        ? "due"
        : daysUntilProduction <= 7
          ? "soon"
          : "ok";

  return {
    ...baseNeed,
    status,
    manualRequestId: request.id,
    requestReason: request.reason,
    requestedQuantity: request.quantity,
    nextProductionDate: request.date,
    daysUntilProduction,
  };
}

export function productionForecasts(recipes: Recipe[]) {
  return recipes
    .filter((recipe) => recipe.type === "finalProduct")
    .map((recipe) => productionNeedForRecipe(recipe))
    .sort(
      (first, second) =>
        first.daysUntilProduction - second.daysUntilProduction ||
        first.recipe.name.localeCompare(second.recipe.name, "nl-NL")
    );
}

export function productionNeeds(recipes: Recipe[]) {
  const forecastNeeds = productionForecasts(recipes).filter((item) =>
    ["overdue", "due", "soon"].includes(item.status)
  );
  const requestedNeeds = recipes.flatMap((recipe) =>
    openProductionRequests(recipe)
      .map((request) => productionNeedForRequest(recipe, request))
      .filter((item) => ["overdue", "due", "soon"].includes(item.status))
  );

  return [...requestedNeeds, ...forecastNeeds]
    .sort(
      (first, second) =>
        first.daysUntilProduction - second.daysUntilProduction ||
        first.recipe.name.localeCompare(second.recipe.name, "nl-NL")
    );
}

export function productionNeedLabel(need: ProductionNeed) {
  if (need.status === "overdue") {
    return `${Math.abs(need.daysUntilProduction)} dagen te laat`;
  }

  if (need.status === "due") return "Nu maken";
  if (need.status === "soon") return `Over ${need.daysUntilProduction} dagen`;

  return "Nog niet nodig";
}

export function productionNeedClass(status: ProductionNeedStatus) {
  if (status === "overdue" || status === "due") {
    return "bg-[#ffe0dc] text-[#a83e31]";
  }

  if (status === "soon") return "bg-[#fff0bd] text-[#7a5a18]";

  return "bg-[#f1eee9] text-[#2d2a26]/55";
}

export function registerRecipeProduction(
  recipe: Recipe,
  producedQuantity: number,
  producedAt: Date = new Date(),
  note = "Geregistreerd in werkmodus"
) {
  const safeProducedQuantity = Math.max(
    0,
    producedQuantity || recipe.standardBatchQuantity || recipeBatchQuantity(recipe)
  );
  const productionDate = dateAtStartOfDay(producedAt);
  const productionLog = productionLogForRecipe(recipe);
  const newEntry: ProductionLogEntry = {
    id: `production-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: localIsoDate(productionDate),
    quantity: safeProducedQuantity,
    note,
    source: "work",
  };

  return syncRecipeProductionMetadata({
    ...recipe,
    productionLog: [newEntry, ...productionLog],
  });
}

function dateAtStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoDateAtStartOfDay(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateAtStartOfDay(new Date(value));

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
}

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function roundPlanningQuantity(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;

  return Math.round(value * 10) / 10;
}

function weightedSalesAverage(currentAverage: number, observedAverage: number) {
  return roundPlanningQuantity(currentAverage * 0.65 + observedAverage * 0.35);
}

function learnedSalesAverageFromLog(
  productionLog: ProductionLogEntry[],
  averageSalesPeriod: SalesPeriod
) {
  const oldestFirst = [...productionLog].sort((first, second) => {
    const dateCompare = first.date.localeCompare(second.date);

    return dateCompare || first.id.localeCompare(second.id);
  });
  let learnedAverage = 0;

  for (let index = 1; index < oldestFirst.length; index += 1) {
    const previous = oldestFirst[index - 1];
    const current = oldestFirst[index];
    const daysBetween = Math.round(
      (isoDateAtStartOfDay(current.date).getTime() -
        isoDateAtStartOfDay(previous.date).getTime()) /
        86400000
    );

    if (daysBetween <= 0 || previous.quantity <= 0) continue;

    const observedPeriodSales =
      (previous.quantity / daysBetween) * salesPeriodDays(averageSalesPeriod);

    learnedAverage = learnedAverage
      ? weightedSalesAverage(learnedAverage, observedPeriodSales)
      : roundPlanningQuantity(observedPeriodSales);
  }

  return learnedAverage;
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
  const extraBreakdown = recipeExtraCostBreakdown(recipe);
  const extraCost = extraBreakdown.extraCost;
  const batchCost = roundMoney(directCost + semiFinishedTotal + extraCost);
  const batchQuantity =
    recipe.type === "semiFinished"
      ? recipeLinesWeightInKg(
          recalculatedIngredients,
          recalculatedSemiFinished
        ) || recipeBatchQuantity(recipe)
      : recipeBatchQuantity(recipe);
  const costPrice = costPriceFromBatchCost(
    recipe.type,
    batchCost,
    batchQuantity
  );

  return {
    ingredients: recalculatedIngredients,
    semiFinishedItems: recalculatedSemiFinished,
    directCost,
    semiFinishedCost: semiFinishedTotal,
    extraCost,
    batchCost,
    batchQuantity,
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
    currentMargin:
      recipe.type === "semiFinished"
        ? 0
        : calculateMargin(recipe.salesPrice, costs.costPrice),
    lastUpdated: options.markAsUpdated ? new Date().toISOString().slice(0, 10) : recipe.lastUpdated,
    standardBatchQuantity:
      recipe.type === "semiFinished" ? costs.batchQuantity : recipe.standardBatchQuantity,
    standardBatchUnit:
      recipe.type === "semiFinished" ? "kg" : recipe.standardBatchUnit,
    batchSize:
      recipe.type === "semiFinished"
        ? `${formatQuantityForLabel(costs.batchQuantity)} kg`
        : recipe.batchSize,
    portionLabel: recipe.type === "semiFinished" ? "per kg" : recipe.portionLabel,
    packagingCost: recipe.type === "semiFinished" ? 0 : recipe.packagingCost,
    decorationCost: recipe.type === "semiFinished" ? 0 : recipe.decorationCost,
    decorationMargin: recipe.type === "semiFinished" ? 0 : recipe.decorationMargin,
    targetMargin: recipe.type === "semiFinished" ? 0 : recipe.targetMargin,
    salesPrice: recipe.type === "semiFinished" ? 0 : recipe.salesPrice,
    photoHint: recipe.type === "semiFinished" ? "" : recipe.photoHint,
    photoPreviewDataUrl:
      recipe.type === "semiFinished" ? "" : recipe.photoPreviewDataUrl,
    photoFileName: recipe.type === "semiFinished" ? "" : recipe.photoFileName,
    photoUpdatedAt:
      recipe.type === "semiFinished" ? "" : recipe.photoUpdatedAt,
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
