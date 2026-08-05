const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const [, , inputJsonPath, workbookPath, outputJsonPath, reportPath] = process.argv;

if (!inputJsonPath || !workbookPath || !outputJsonPath || !reportPath) {
  console.error(
    "Usage: node scripts/migrate-hf-from-excel.cjs <input-json> <workbook> <output-json> <report-json>"
  );
  process.exit(1);
}

const sourceData = JSON.parse(fs.readFileSync(inputJsonPath, "utf8"));
const workbook = XLSX.readFile(workbookPath, { cellDates: false });
const now = new Date().toISOString();

const baseData = {
  ingredients: Array.isArray(sourceData.ingredients) ? sourceData.ingredients : [],
  recipes: Array.isArray(sourceData.recipes) ? sourceData.recipes : [],
  packagingItems: Array.isArray(sourceData.packagingItems)
    ? sourceData.packagingItems
    : [],
  invoiceImports: Array.isArray(sourceData.invoiceImports)
    ? sourceData.invoiceImports
    : [],
  manualProductionPlanningItems: Array.isArray(
    sourceData.manualProductionPlanningItems
  )
    ? sourceData.manualProductionPlanningItems
    : [],
  bakeryHome:
    sourceData.bakeryHome && typeof sourceData.bakeryHome === "object"
      ? sourceData.bakeryHome
      : { notes: [], offers: [] },
  updatedAt: now,
};

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHfPrefix(value) {
  return cleanText(value).replace(/^HF\s+/i, "").trim();
}

function key(value) {
  return stripHfPrefix(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function tokenKey(value) {
  return stripHfPrefix(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slug(value) {
  return stripHfPrefix(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  let text = cleanText(value)
    .replace(/[€%]/g, "")
    .replace(/\s/g, "");

  if (!text || text === "-") return 0;

  if (text.includes(",") && text.includes(".")) {
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }

  const parsed = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 10000) / 10000;
}

function roundQuantity(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function normalizeUnit(value) {
  const unit = cleanText(value).toLowerCase();
  if (["kg", "kilo", "kilogram"].includes(unit)) return "kg";
  if (["g", "gr", "gram"].includes(unit)) return "gram";
  if (["l", "ltr", "liter", "liters"].includes(unit)) return "liter";
  if (["ml", "milliliter"].includes(unit)) return "ml";
  return "stuk";
}

function quantityToKg(quantity, unit) {
  if (unit === "kg") return quantity;
  if (unit === "gram") return quantity / 1000;
  if (unit === "liter") return quantity;
  if (unit === "ml") return quantity / 1000;
  return 0;
}

function quantityToBase(quantity, unit, baseUnit) {
  if (unit === baseUnit) return quantity;
  if (unit === "kg" && baseUnit === "gram") return quantity * 1000;
  if (unit === "gram" && baseUnit === "kg") return quantity / 1000;
  if (unit === "liter" && baseUnit === "ml") return quantity * 1000;
  if (unit === "ml" && baseUnit === "liter") return quantity / 1000;
  return quantity;
}

function costForIngredientLine(ingredient, quantity, unit, excelCost) {
  if (excelCost > 0) return roundMoney(excelCost);
  const baseQuantity = quantityToBase(quantity, unit, ingredient.recipeUnit);
  return roundMoney(baseQuantity * (ingredient.pricePerBaseUnit || 0));
}

function costForSemiLine(recipe, quantity, unit) {
  if (!recipe) return 0;
  const kg =
    recipe.standardBatchUnit === "gram"
      ? quantityToBase(quantity, unit, "gram") / 1000
      : quantityToKg(quantity, unit);
  if (kg > 0) return roundMoney(kg * (recipe.costPrice || 0));
  return roundMoney(quantity * (recipe.costPrice || 0));
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j];
      row[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : Math.min(prev + 1, row[j] + 1, row[j - 1] + 1);
      prev = temp;
    }
  }
  return row[b.length];
}

function similarity(a, b) {
  const first = key(a);
  const second = key(b);
  if (!first || !second) return 0;
  if (first === second) return 1;
  if (first.includes(second) || second.includes(first)) {
    return Math.min(first.length, second.length) / Math.max(first.length, second.length);
  }
  const distance = levenshtein(first, second);
  return 1 - distance / Math.max(first.length, second.length);
}

function bestMatchByName(name, candidates, minScore = 0.84) {
  let best = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = similarity(name, candidate.name);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best && bestScore >= minScore ? { item: best, score: bestScore } : null;
}

function makeBlankRecipe(id, name, sourceLabel) {
  return {
    id,
    name,
    type: "semiFinished",
    productGroup: "Halffabricaat",
    standardBatchQuantity: 1,
    standardBatchUnit: "kg",
    salesPrice: 0,
    costPrice: 0,
    previousCostPrice: 0,
    targetMargin: 0,
    currentMargin: 0,
    status: "active",
    ingredients: [],
    semiFinishedItems: [],
    packagingItems: [],
    workInstructions: [],
    preparationSteps: [],
    finishingSteps: [],
    equipment: [],
    allergens: [],
    internalNotes: "",
    isWorkModeVisible: true,
    workCategories: [],
    version: "1.0",
    lastUpdated: now,
    portionLabel: "1 kg",
    batchSize: "1 kg",
    photoHint: "",
    notes: `Aangemaakt uit ${sourceLabel}.`,
    linkedFinalProductIds: [],
    packagingCost: 0,
    decorationCost: 0,
    decorationMargin: 0,
  };
}

function mergeRecipe(existing, replacement) {
  return {
    ...makeBlankRecipe(replacement.id, replacement.name, "Excel halffabricaten 2026"),
    ...existing,
    ...replacement,
    id: existing?.id || replacement.id,
    name: replacement.name || existing?.name,
    type: "semiFinished",
    productGroup: existing?.productGroup || "Halffabricaat",
    salesPrice: existing?.salesPrice || 0,
    targetMargin: existing?.targetMargin || 0,
    status: existing?.status || "active",
    version: existing?.version || "1.0",
    lastUpdated: now,
    linkedFinalProductIds: existing?.linkedFinalProductIds || [],
    packagingItems: existing?.packagingItems || [],
    productionLog: existing?.productionLog || [],
    productionRequests: existing?.productionRequests || [],
  };
}

const originalIngredients = baseData.ingredients;
const originalRecipes = baseData.recipes;
const hfIngredientRegex = /(^|\b)HF(\b|\s|-|_)/i;
const hfIngredients = originalIngredients.filter((ingredient) =>
  hfIngredientRegex.test(ingredient.name || ingredient.supplierArticleNumber || "")
);
const realIngredients = originalIngredients.filter(
  (ingredient) => !hfIngredients.includes(ingredient)
);

const existingSemiRecipes = originalRecipes.filter(
  (recipe) => recipe.type === "semiFinished"
);

const semiCandidates = [
  ...existingSemiRecipes.map((recipe) => ({ id: recipe.id, name: recipe.name, recipe })),
  ...hfIngredients.map((ingredient) => ({
    id: ingredient.id,
    name: stripHfPrefix(ingredient.name),
    ingredient,
  })),
];

const hfSheetNames = workbook.SheetNames.filter((sheetName) => {
  const trimmed = cleanText(sheetName);
  return /^HF\s+/i.test(trimmed) && !/^Template/i.test(trimmed);
});

function targetForSheet(sheetName) {
  const stripped = stripHfPrefix(sheetName);
  const candidates = [
    { name: stripped, source: "sheet" },
    ...semiCandidates,
  ];
  const exact = semiCandidates.find((candidate) => key(candidate.name) === key(stripped));
  if (exact) return { id: exact.id, name: exact.name, source: "exact" };

  const fuzzy = bestMatchByName(stripped, semiCandidates, 0.78);
  if (fuzzy) {
    return {
      id: fuzzy.item.id,
      name: fuzzy.item.name,
      source: `fuzzy:${roundQuantity(fuzzy.score)}`,
    };
  }

  return {
    id: `hf-excel-${slug(stripped) || slug(sheetName)}`,
    name: stripped,
    source: "new",
  };
}

const sheetTargets = new Map(
  hfSheetNames.map((sheetName) => [sheetName, targetForSheet(sheetName)])
);

const semiByKey = new Map();
for (const candidate of semiCandidates) semiByKey.set(key(candidate.name), candidate.id);
for (const target of sheetTargets.values()) semiByKey.set(key(target.name), target.id);

function findSemiByName(name) {
  const exact = semiByKey.get(key(name));
  if (exact) return exact;

  const targetCandidates = Array.from(sheetTargets.values()).map((target) => ({
    id: target.id,
    name: target.name,
  }));
  const fuzzy = bestMatchByName(name, [...semiCandidates, ...targetCandidates], 0.86);
  return fuzzy?.item.id || "";
}

const ingredientsByArticle = new Map();
const ingredientsByName = new Map();
for (const ingredient of realIngredients) {
  const article = cleanText(ingredient.supplierArticleNumber);
  if (article && article !== "0") ingredientsByArticle.set(article, ingredient);
  ingredientsByName.set(key(ingredient.name), ingredient);
  for (const alias of ingredient.aliases || []) ingredientsByName.set(key(alias), ingredient);
}

const createdIngredients = [];
const createdIngredientIds = new Set();

function findOrCreateIngredient(line, report) {
  if (line.articleNumber && line.articleNumber !== "0") {
    const exactArticle = ingredientsByArticle.get(line.articleNumber);
    if (exactArticle) return exactArticle;
  }

  const exactName = ingredientsByName.get(key(line.name));
  if (exactName) return exactName;

  const fuzzy = bestMatchByName(line.name, realIngredients, 0.9);
  if (fuzzy) {
    report.fuzzyIngredientMatches.push({
      source: line.name,
      matched: fuzzy.item.name,
      score: roundQuantity(fuzzy.score),
    });
    return fuzzy.item;
  }

  const idBase =
    line.articleNumber && line.articleNumber !== "0"
      ? `beko-${line.articleNumber}`
      : `excel-${slug(line.name)}`;
  let id = idBase;
  let suffix = 2;
  const allIds = new Set([
    ...realIngredients.map((ingredient) => ingredient.id),
    ...createdIngredients.map((ingredient) => ingredient.id),
  ]);
  while (allIds.has(id)) {
    id = `${idBase}-${suffix}`;
    suffix += 1;
  }

  const pricePerKg = line.pricePerKg || (line.quantityKg ? line.cost / line.quantityKg : 0);
  const ingredient = {
    id,
    name: line.name,
    supplier: line.supplier || "Excel",
    supplierArticleNumber: line.articleNumber === "0" ? "" : line.articleNumber,
    packageSize: "1 kg",
    recipeUnit: "gram",
    lastPrice: roundMoney(pricePerKg),
    previousPrice: 0,
    pricePerBaseUnit: roundMoney(pricePerKg / 1000),
    allergens: [],
    lastUpdated: now,
    status: "active",
    lastInvoice: "Excel halffabricaten 2026",
    aliases: [],
  };

  createdIngredients.push(ingredient);
  createdIngredientIds.add(ingredient.id);
  realIngredients.push(ingredient);
  if (ingredient.supplierArticleNumber) {
    ingredientsByArticle.set(ingredient.supplierArticleNumber, ingredient);
  }
  ingredientsByName.set(key(ingredient.name), ingredient);
  report.createdIngredients.push({
    id: ingredient.id,
    name: ingredient.name,
    articleNumber: ingredient.supplierArticleNumber,
    pricePerKg: ingredient.lastPrice,
  });
  return ingredient;
}

function isStopRow(row) {
  const label = cleanText(row[0]).toLowerCase();
  return [
    "totaal",
    "aantal",
    "productietijd",
    "gemiddelde loonkosten",
    "loonkosten recept",
    "loonkosten per product",
    "grondstofkosten",
    "werkijze",
    "werkwijze",
  ].some((stop) => label.startsWith(stop));
}

function extractWorkSteps(rows) {
  const start = rows.findIndex((row) => cleanText(row[0]).toLowerCase() === "werkwijze");
  if (start < 0) return [];

  return rows
    .slice(start + 1)
    .map((row) => cleanText(row[0]))
    .filter(Boolean)
    .filter((line) => /^\d+[\).\s]/.test(line))
    .map((line) => line.replace(/^\d+[\).\s]+/, "").trim());
}

function parseBatchKg(rows, lines) {
  const lineWeight = lines.reduce(
    (total, line) => total + quantityToKg(line.quantity, line.unit),
    0
  );
  const saneWeight = (amount) => {
    if (amount <= 0) return 0;
    if (lineWeight > 0 && amount < lineWeight * 0.5) return lineWeight;
    return amount;
  };

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const label = cleanText(row[0]).toLowerCase();
    if (label.startsWith("nettogewicht")) {
      const amount = parseNumber(row[1]);
      if (amount > 0) return saneWeight(amount);
    }
    if (label.includes("totaal gewicht") || label.includes("totaal drooggewicht")) {
      const next = rows[index + 1] || [];
      const amount = parseNumber(next[0]);
      if (amount > 0) return saneWeight(amount);
    }
    if (label.startsWith("opbrengst") && label.includes("kg")) {
      const amount = parseNumber(row[1]);
      if (amount > 0) return saneWeight(amount);
    }
    if (label === "totaal") {
      const amount = parseNumber(row[1]);
      const unit = normalizeUnit(row[2]);
      const kg = quantityToKg(amount, unit);
      if (kg > 0) return saneWeight(kg);
    }
  }

  return lineWeight > 0 ? lineWeight : 1;
}

function parseSheet(sheetName, target, report) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
  });

  const headerIndex = rows.findIndex((row) =>
    row.some((cell) =>
      /ingrediënt\/omschrijving|ingredient\/omschrijving|hoeveelheid/i.test(cleanText(cell))
    )
  );

  if (headerIndex < 0) {
    report.skippedSheets.push({
      sheetName,
      reason: "Geen ingrediëntentabel gevonden",
    });
    return null;
  }

  const header = rows[headerIndex].map((cell) => cleanText(cell).toLowerCase());
  const modernLayout = header.some((cell) => cell.includes("ingrediënt"));
  const nameCol = modernLayout ? 0 : 0;
  const quantityCol = modernLayout ? 1 : 1;
  const unitCol = modernLayout ? 2 : 2;
  const supplierCol = modernLayout ? 3 : -1;
  const articleCol = modernLayout ? 4 : -1;
  const priceCol = modernLayout ? 5 : 3;
  const costCol = modernLayout ? 6 : 4;

  const rawLines = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (isStopRow(row)) break;

    const name = cleanText(row[nameCol]);
    const quantity = parseNumber(row[quantityCol]);
    const unit = normalizeUnit(row[unitCol]);
    const supplier = supplierCol >= 0 ? cleanText(row[supplierCol]) : "";
    const articleNumber = articleCol >= 0 ? cleanText(row[articleCol]) : "";
    const pricePerKg = parseNumber(row[priceCol]);
    const cost = parseNumber(row[costCol]);

    if (!name && !quantity) continue;
    if (!name || quantity <= 0) {
      report.unresolvedLines.push({
        sheetName,
        name,
        quantity,
        unit,
        reason: "Regel zonder naam of hoeveelheid overgeslagen",
      });
      continue;
    }

    rawLines.push({
      name,
      quantity,
      unit,
      supplier,
      articleNumber,
      pricePerKg,
      cost,
      quantityKg: quantityToKg(quantity, unit),
    });
  }

  if (rawLines.length === 0) {
    report.skippedSheets.push({
      sheetName,
      reason: "Geen bruikbare ingredientregels gevonden",
    });
    return null;
  }

  const recipeIngredients = [];
  const semiFinishedItems = [];

  for (const line of rawLines) {
    const semiId =
      hfIngredientRegex.test(line.name) || findSemiByName(line.name)
        ? findSemiByName(line.name)
        : "";

    if (semiId && semiId !== target.id) {
      semiFinishedItems.push({
        semiFinishedRecipeId: semiId,
        quantity: roundQuantity(line.quantity),
        unit: line.unit,
        costContribution: 0,
      });
      continue;
    }

    const ingredient = findOrCreateIngredient(line, report);
    recipeIngredients.push({
      ingredientId: ingredient.id,
      quantity: roundQuantity(line.quantity),
      unit: line.unit,
      costContribution: costForIngredientLine(ingredient, line.quantity, line.unit, line.cost),
    });
  }

  const batchKg = roundQuantity(parseBatchKg(rows, rawLines));
  const ingredientCost = recipeIngredients.reduce(
    (total, line) => total + (line.costContribution || 0),
    0
  );
  const directCost = roundMoney(ingredientCost);
  const costPrice = batchKg > 0 ? roundMoney(directCost / batchKg) : 0;
  const steps = extractWorkSteps(rows);

  const parsedRecipe = {
    ...makeBlankRecipe(target.id, target.name, `Excel-tabblad ${sheetName}`),
    standardBatchQuantity: batchKg,
    standardBatchUnit: "kg",
    costPrice,
    previousCostPrice: 0,
    currentMargin: 0,
    ingredients: recipeIngredients,
    semiFinishedItems,
    preparationSteps: steps.length ? steps : ["Controleer en vul de werkwijze aan."],
    workInstructions: steps,
    batchSize: `${batchKg} kg`,
    portionLabel: "per kg",
    notes: `Geimporteerd uit Excel-tabblad ${cleanText(sheetName)}.`,
  };

  report.parsedSheets.push({
    sheetName,
    id: target.id,
    name: target.name,
    source: target.source,
    ingredients: recipeIngredients.length,
    semiFinishedItems: semiFinishedItems.length,
    batchKg,
    costPrice,
  });

  return parsedRecipe;
}

const report = {
  sourceWorkbook: workbookPath,
  inputJson: inputJsonPath,
  outputJson: outputJsonPath,
  startedAt: now,
  before: {
    ingredients: originalIngredients.length,
    recipes: originalRecipes.length,
    semiFinishedRecipes: existingSemiRecipes.length,
    hfIngredients: hfIngredients.length,
  },
  removedHfIngredients: hfIngredients.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.name,
  })),
  parsedSheets: [],
  skippedSheets: [],
  placeholderRecipes: [],
  createdIngredients: [],
  fuzzyIngredientMatches: [],
  unresolvedLines: [],
  replacedReferences: [],
};

const parsedRecipes = [];
for (const [sheetName, target] of sheetTargets.entries()) {
  const parsed = parseSheet(sheetName, target, report);
  if (parsed) parsedRecipes.push(parsed);
}

const parsedRecipeIds = new Set(parsedRecipes.map((recipe) => recipe.id));
const recipesById = new Map(originalRecipes.map((recipe) => [recipe.id, recipe]));

for (const parsedRecipe of parsedRecipes) {
  recipesById.set(
    parsedRecipe.id,
    mergeRecipe(recipesById.get(parsedRecipe.id), parsedRecipe)
  );
}

for (const ingredient of hfIngredients) {
  if (recipesById.has(ingredient.id) || parsedRecipeIds.has(ingredient.id)) continue;

  const placeholder = makeBlankRecipe(
    ingredient.id,
    stripHfPrefix(ingredient.name),
    "bestaande HF-grondstof zonder Excel-tabblad"
  );
  placeholder.costPrice = roundMoney(
    ingredient.pricePerBaseUnit > 0 ? ingredient.pricePerBaseUnit * 1000 : ingredient.lastPrice
  );
  placeholder.notes =
    "Deze stond als HF-grondstof in de grondstoffenlijst, maar er is geen bruikbaar Excel-tabblad gevonden. Vul de receptuur later aan.";
  recipesById.set(placeholder.id, placeholder);
  report.placeholderRecipes.push({
    id: placeholder.id,
    name: placeholder.name,
    costPrice: placeholder.costPrice,
  });
}

const hfIngredientIds = new Set(hfIngredients.map((ingredient) => ingredient.id));
const recipes = Array.from(recipesById.values());

function recipeForSemiId(id) {
  return recipesById.get(id);
}

for (const recipe of recipes) {
  if (!Array.isArray(recipe.ingredients)) recipe.ingredients = [];
  if (!Array.isArray(recipe.semiFinishedItems)) recipe.semiFinishedItems = [];

  const keptIngredients = [];
  for (const line of recipe.ingredients) {
    if (!hfIngredientIds.has(line.ingredientId)) {
      keptIngredients.push(line);
      continue;
    }

    if (line.ingredientId === recipe.id) {
      report.replacedReferences.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        ingredientId: line.ingredientId,
        action: "self-reference skipped",
      });
      continue;
    }

    const semiRecipe = recipeForSemiId(line.ingredientId);
    if (semiRecipe) {
      const existing = recipe.semiFinishedItems.find(
        (item) =>
          item.semiFinishedRecipeId === line.ingredientId &&
          item.unit === line.unit &&
          Math.abs(item.quantity - line.quantity) < 0.0001
      );
      const replacement = {
        semiFinishedRecipeId: line.ingredientId,
        quantity: line.quantity,
        unit: line.unit,
        costContribution: costForSemiLine(semiRecipe, line.quantity, line.unit),
      };
      if (existing) {
        existing.costContribution = replacement.costContribution;
      } else {
        recipe.semiFinishedItems.push(replacement);
      }
      report.replacedReferences.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        ingredientId: line.ingredientId,
        semiFinishedRecipeId: line.ingredientId,
        quantity: line.quantity,
        unit: line.unit,
        action: "ingredient -> semiFinishedItem",
      });
    } else {
      report.unresolvedLines.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        ingredientId: line.ingredientId,
        reason: "HF-grondstof verwijderd, maar geen halffabricaatrecept gevonden",
      });
    }
  }
  recipe.ingredients = keptIngredients;
}

function recalculateRecipeCost(recipe, seen = new Set()) {
  if (seen.has(recipe.id)) return recipe.costPrice || 0;
  seen.add(recipe.id);

  const ingredientTotal = (recipe.ingredients || []).reduce((total, line) => {
    const ingredient = realIngredients.find((item) => item.id === line.ingredientId);
    if (!ingredient) return total + (line.costContribution || 0);
    line.costContribution = costForIngredientLine(
      ingredient,
      line.quantity,
      line.unit,
      line.costContribution
    );
    return total + line.costContribution;
  }, 0);

  const semiTotal = (recipe.semiFinishedItems || []).reduce((total, line) => {
    const semiRecipe = recipesById.get(line.semiFinishedRecipeId);
    if (!semiRecipe) return total + (line.costContribution || 0);
    recalculateRecipeCost(semiRecipe, new Set(seen));
    line.costContribution = costForSemiLine(semiRecipe, line.quantity, line.unit);
    return total + line.costContribution;
  }, 0);

  const packagingTotal = (recipe.packagingItems || []).reduce(
    (total, line) => total + (line.costContribution || line.unitPrice || 0),
    0
  );
  const batchQuantity =
    recipe.standardBatchQuantity ||
    parseNumber(String(recipe.batchSize || "").replace(/[^0-9,.-]/g, "")) ||
    1;
  const batchCost = roundMoney(ingredientTotal + semiTotal + packagingTotal);

  const nextCostPrice =
    recipe.type === "semiFinished"
      ? batchQuantity > 0
        ? roundMoney(batchCost / batchQuantity)
        : recipe.costPrice || 0
      : batchQuantity > 0
        ? roundMoney(batchCost / batchQuantity)
        : recipe.costPrice || 0;

  recipe.previousCostPrice = recipe.costPrice || recipe.previousCostPrice || 0;
  recipe.costPrice = nextCostPrice;
  recipe.currentMargin =
    recipe.salesPrice > 0
      ? Math.round(((recipe.salesPrice - nextCostPrice) / recipe.salesPrice) * 100)
      : 0;
  recipe.lastUpdated = now;
  return recipe.costPrice;
}

for (const recipe of recipes) {
  recalculateRecipeCost(recipe);
}

const migratedData = {
  ...baseData,
  ingredients: [...realIngredients],
  recipes: recipes.sort((a, b) => a.name.localeCompare(b.name, "nl")),
  updatedAt: now,
};

report.after = {
  ingredients: migratedData.ingredients.length,
  recipes: migratedData.recipes.length,
  semiFinishedRecipes: migratedData.recipes.filter(
    (recipe) => recipe.type === "semiFinished"
  ).length,
  hfIngredients: migratedData.ingredients.filter((ingredient) =>
    hfIngredientRegex.test(ingredient.name || ingredient.supplierArticleNumber || "")
  ).length,
  createdIngredients: report.createdIngredients.length,
  parsedSheets: report.parsedSheets.length,
  skippedSheets: report.skippedSheets.length,
  placeholderRecipes: report.placeholderRecipes.length,
  replacedReferences: report.replacedReferences.length,
};

fs.writeFileSync(outputJsonPath, `${JSON.stringify(migratedData, null, 2)}\n`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      outputJson: path.resolve(outputJsonPath),
      reportJson: path.resolve(reportPath),
      before: report.before,
      after: report.after,
    },
    null,
    2
  )
);
