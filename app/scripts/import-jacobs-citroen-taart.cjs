const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const [, , inputJsonPath, workbookPath, outputJsonPath, reportPath] = process.argv;

if (!inputJsonPath || !workbookPath || !outputJsonPath || !reportPath) {
  console.error(
    "Usage: node scripts/import-jacobs-citroen-taart.cjs <input-json> <workbook> <output-json> <report-json>"
  );
  process.exit(1);
}

const sourceData = JSON.parse(fs.readFileSync(inputJsonPath, "utf8"));
const workbook = XLSX.readFile(workbookPath, { cellDates: false });
const today = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();
const sourceLabel = path.basename(workbookPath);

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactKey(value) {
  return normalizeKey(value).replace(/\s+/g, "");
}

function slug(value) {
  return normalizeKey(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
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
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function roundQuantity(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function roundBaseUnitPrice(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000000) / 1000000;
}

function formatNlQuantity(value) {
  return value.toLocaleString("nl-NL", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  });
}

function toKg(quantity, unit) {
  if (unit === "kg") return quantity;
  if (unit === "gram") return quantity / 1000;
  if (unit === "liter") return quantity;
  if (unit === "ml") return quantity / 1000;
  return 0;
}

function convertQuantityToUnit(quantity, fromUnit, toUnit) {
  if (fromUnit === toUnit) return quantity;
  if (["gram", "kg"].includes(fromUnit) && ["gram", "kg"].includes(toUnit)) {
    const grams = fromUnit === "kg" ? quantity * 1000 : quantity;
    return toUnit === "kg" ? grams / 1000 : grams;
  }
  if (["ml", "liter"].includes(fromUnit) && ["ml", "liter"].includes(toUnit)) {
    const ml = fromUnit === "liter" ? quantity * 1000 : quantity;
    return toUnit === "liter" ? ml / 1000 : ml;
  }
  return quantity;
}

function ingredientCostForQuantity(ingredient, quantity, unit) {
  const baseQuantity = convertQuantityToUnit(quantity, unit, ingredient.recipeUnit);
  return roundMoney(baseQuantity * (ingredient.pricePerBaseUnit || 0));
}

function semiFinishedCostForQuantity(recipe, quantity, unit) {
  const batchQuantity = recipe.standardBatchQuantity || 1;
  const batchUnit = recipe.standardBatchUnit || "kg";
  const requested = convertQuantityToUnit(quantity, unit, batchUnit);
  return roundMoney(requested * (recipe.costPrice || 0) / (recipe.type === "semiFinished" ? 1 : batchQuantity));
}

function recipeLineWeightKg(quantity, unit) {
  return roundQuantity(toKg(quantity, unit));
}

function recipeWeightKg(recipe) {
  const direct = (recipe.ingredients || []).reduce(
    (total, line) => total + recipeLineWeightKg(line.quantity, line.unit),
    0
  );
  const semi = (recipe.semiFinishedItems || []).reduce(
    (total, line) => total + recipeLineWeightKg(line.quantity, line.unit),
    0
  );
  return roundQuantity(direct + semi);
}

function recipeBatchQuantity(recipe) {
  return recipe.standardBatchQuantity || 1;
}

function calculateMargin(salesPrice, costPrice) {
  if (!salesPrice) return 0;
  const netSalesPrice = salesPrice / 1.09;
  return Math.round(((netSalesPrice - costPrice) / netSalesPrice) * 1000) / 10;
}

const baseData = {
  ingredients: Array.isArray(sourceData.ingredients) ? sourceData.ingredients : [],
  recipes: Array.isArray(sourceData.recipes) ? sourceData.recipes : [],
  packagingItems: Array.isArray(sourceData.packagingItems)
    ? sourceData.packagingItems
    : [],
  invoiceImports: Array.isArray(sourceData.invoiceImports)
    ? sourceData.invoiceImports
    : [],
  bakeryHome:
    sourceData.bakeryHome && typeof sourceData.bakeryHome === "object"
      ? sourceData.bakeryHome
      : { notes: [], offers: [] },
  manualProductionPlanningItems: Array.isArray(
    sourceData.manualProductionPlanningItems
  )
    ? sourceData.manualProductionPlanningItems
    : [],
  updatedAt: now,
};

const ingredients = baseData.ingredients.map((ingredient) => ({
  ...ingredient,
  aliases: Array.isArray(ingredient.aliases) ? [...ingredient.aliases] : [],
}));
const recipes = baseData.recipes.map((recipe) => ({ ...recipe }));
const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
const usedIngredientIds = new Set(ingredients.map((ingredient) => ingredient.id));

const report = {
  sourceWorkbook: workbookPath,
  inputJson: inputJsonPath,
  outputJson: outputJsonPath,
  startedAt: now,
  before: {
    ingredients: baseData.ingredients.length,
    recipes: baseData.recipes.length,
  },
  parsedSheets: [],
  createdIngredients: [],
  ingredientMatches: [],
  priceDifferences: [],
  recipeUpserts: [],
  warnings: [],
};

function addAlias(ingredient, alias) {
  const normalizedAlias = normalizeKey(alias);
  if (!normalizedAlias) return;

  const hasAlias = ingredient.aliases.some(
    (existing) => normalizeKey(existing) === normalizedAlias
  );

  if (!hasAlias && normalizeKey(ingredient.name) !== normalizedAlias) {
    ingredient.aliases.push(cleanText(alias));
  }
}

function createIngredientId(name) {
  const base = `jacobs-${slug(name) || "ingredient"}`;
  let id = base;
  let counter = 2;

  while (usedIngredientIds.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }

  usedIngredientIds.add(id);
  return id;
}

function createIngredient(name, pricePerKg) {
  const cleanName = cleanText(name);
  const cleanPrice = roundMoney(pricePerKg);
  const ingredient = {
    id: createIngredientId(cleanName),
    name: cleanName,
    supplier: "Jacobs Excel",
    supplierArticleNumber: "",
    packageSize: "1 kg",
    recipeUnit: "gram",
    lastPrice: cleanPrice,
    previousPrice: 0,
    pricePerBaseUnit: roundBaseUnitPrice(cleanPrice / 1000),
    allergens: [],
    lastUpdated: today,
    status: "active",
    lastInvoice: sourceLabel,
    aliases: [cleanName],
  };

  ingredients.push(ingredient);
  ingredientById.set(ingredient.id, ingredient);
  report.createdIngredients.push({
    id: ingredient.id,
    name: ingredient.name,
    pricePerKg: ingredient.lastPrice,
  });

  return ingredient;
}

const manualIngredientMatches = new Map(
  Object.entries({
    "witte basterdsuiker": "su003",
    citroenrasp: "kr003",
    zout: "ha010",
    heelei: "ei003",
    bakpoeder: "ba002",
    koolzuur: "ov001",
    patent: "bl002",
    water: "ov002",
    moscamix: "ba012",
    "kristalsuiker extra fijn": "ing-ijs-suiker-extra-fijn",
    gelatine: "ge003",
    room: "ingredient-slagroom-zonder-suiker-37-vet-uht-bib-10l",
    yoghurtpoeder: "kr014",
    "chocolade wit": "ch009",
  }).map(([name, id]) => [normalizeKey(name), id])
);

function findIngredientByName(name) {
  const normalized = normalizeKey(name);
  const compact = compactKey(name);

  for (const ingredient of ingredients) {
    if (normalizeKey(ingredient.name) === normalized) return ingredient;
    if ((ingredient.aliases || []).some((alias) => normalizeKey(alias) === normalized)) {
      return ingredient;
    }
  }

  for (const ingredient of ingredients) {
    const ingredientKey = compactKey(ingredient.name);
    if (!ingredientKey || !compact) continue;
    if (ingredientKey === compact) return ingredient;
  }

  return null;
}

function resolveIngredient(name, pricePerKg) {
  const normalized = normalizeKey(name);
  const manualId = manualIngredientMatches.get(normalized);
  const manualIngredient = manualId ? ingredientById.get(manualId) : null;
  const ingredient = manualIngredient || findIngredientByName(name) || createIngredient(name, pricePerKg);

  addAlias(ingredient, name);

  const appPricePerKg = roundMoney((ingredient.pricePerBaseUnit || 0) * 1000);
  const excelPricePerKg = roundMoney(pricePerKg);
  const priceDifference = roundMoney(appPricePerKg - excelPricePerKg);

  report.ingredientMatches.push({
    sourceName: cleanText(name),
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    matchType: ingredient.supplier === "Jacobs Excel" ? "created" : manualIngredient ? "manual" : "name",
    excelPricePerKg,
    appPricePerKg,
  });

  if (Math.abs(priceDifference) >= 0.5) {
    report.priceDifferences.push({
      sourceName: cleanText(name),
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      excelPricePerKg,
      appPricePerKg,
      difference: priceDifference,
    });
  }

  return ingredient;
}

function readSheetRows(sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Tabblad niet gevonden: ${sheetName}`);
  }

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });
}

const semiSheetConfig = {
  "tartelette deeg": {
    id: "hf-jacobs-tartelette-deeg",
    name: "Tartelette deeg",
  },
  biscuit: {
    id: "hf-jacobs-biscuit-kruimels",
    name: "Biscuit kruimels",
    extraSteps: [
      "Bakken volgens Excel: 5 pers. 200 gram, 185 C, 35 min., schuif half open.",
      "Bakken volgens Excel: 10 pers. 375 gram, 185 C, 35 min., schuif half open.",
      "Bakken volgens Excel: 15 pers. 550 gram, 185 C, 35 min., schuif half open.",
      "Bakken volgens Excel: 20 pers. 700 gram, 185 C, 40 min., schuif half open.",
      "Bakken volgens Excel: plaat 60 x 80 cm, 4250 gram, 185 C, 40 min., schuif half open.",
      "Alle kapsels direct lossen na het bakken op papier.",
    ],
  },
  limoenschuim: {
    id: "hf-jacobs-limoenschuim",
    name: "Limoenschuim",
  },
  limoenmousse: {
    id: "hf-jacobs-limoenmousse",
    name: "Limoenmousse",
  },
  citroenappereille: {
    id: "hf-jacobs-citroen-appereille",
    name: "Citroen appereille",
  },
  "chocolade groen": {
    id: "hf-jacobs-decor-chocolade-groen",
    name: "Decor chocolade groen",
  },
};

function parseSemiFinishedSheet(sheetName, config) {
  const rows = readSheetRows(sheetName);
  const ingredientHeaderIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeKey(cell) === "ingredienten")
  );

  if (ingredientHeaderIndex < 0) {
    throw new Error(`Geen ingredientenkop gevonden in ${sheetName}`);
  }

  const lines = [];
  for (const row of rows.slice(ingredientHeaderIndex + 1)) {
    if (row.some((cell) => normalizeKey(cell) === "werkwijze")) break;

    const quantityGram = parseNumber(row[4]);
    const name = cleanText(row[5]);
    const pricePerKg = parseNumber(row[9]);
    const excelCost = parseNumber(row[10]);

    if (!name && !quantityGram) continue;
    if (!name || quantityGram <= 0) continue;

    const ingredient = resolveIngredient(name, pricePerKg);
    const costContribution = ingredientCostForQuantity(
      ingredient,
      quantityGram,
      "gram"
    );

    lines.push({
      sourceName: name,
      ingredientId: ingredient.id,
      quantity: roundQuantity(quantityGram),
      unit: "gram",
      costContribution,
      excelCost: roundMoney(excelCost),
      excelPricePerKg: roundMoney(pricePerKg),
    });
  }

  const totalWeightKg = roundQuantity(
    lines.reduce((total, line) => total + line.quantity, 0) / 1000
  );
  const directCost = roundMoney(
    lines.reduce((total, line) => total + line.costContribution, 0)
  );
  const excelDirectCost = roundMoney(
    lines.reduce((total, line) => total + line.excelCost, 0)
  );
  const costPrice = totalWeightKg > 0 ? roundMoney(directCost / totalWeightKg) : 0;
  const excelCostPrice =
    totalWeightKg > 0 ? roundMoney(excelDirectCost / totalWeightKg) : 0;
  const preparationSteps = config.extraSteps?.length
    ? config.extraSteps
    : ["Werkwijze stond leeg in Excel; vul de bereidingsstappen aan waar nodig."];

  const recipe = {
    id: config.id,
    name: config.name,
    type: "semiFinished",
    productGroup: "Halffabricaat",
    standardBatchQuantity: totalWeightKg,
    standardBatchUnit: "kg",
    salesPrice: 0,
    costPrice,
    previousCostPrice: recipeById.get(config.id)?.costPrice || 0,
    targetMargin: 0,
    currentMargin: 0,
    status: "active",
    ingredients: lines.map(({ ingredientId, quantity, unit, costContribution }) => ({
      ingredientId,
      quantity,
      unit,
      costContribution,
    })),
    semiFinishedItems: [],
    packagingItems: [],
    workInstructions: preparationSteps,
    preparationSteps,
    finishingSteps: [],
    equipment: [],
    allergens: [],
    internalNotes: `Geimporteerd uit ${sourceLabel}, tabblad ${sheetName}. Excel kostprijs/kg: EUR ${excelCostPrice}.`,
    isWorkModeVisible: true,
    workCategories: [],
    version: "Jacobs Excel",
    lastUpdated: today,
    portionLabel: "per kg",
    batchSize: `${formatNlQuantity(totalWeightKg)} kg`,
    photoHint: "",
    photoPreviewDataUrl: "",
    photoFileName: "",
    photoUpdatedAt: "",
    notes: `Bron: ${sourceLabel}.`,
    linkedFinalProductIds: ["recipe-jacobs-taart-citroen"],
    packagingCost: 0,
    decorationCost: 0,
    decorationMargin: 0,
    averageSalesQuantity: 0,
    averageSalesPeriod: "week",
    canProduceAhead: true,
    desiredProductionFrequencyDays: 7,
    desiredProductionBatchQuantity: totalWeightKg,
    lastProducedAt: "",
    lastProducedQuantity: 0,
    productionLog: recipeById.get(config.id)?.productionLog || [],
    productionRequests: recipeById.get(config.id)?.productionRequests || [],
  };

  report.parsedSheets.push({
    sheetName,
    recipeId: recipe.id,
    recipeName: recipe.name,
    type: recipe.type,
    ingredients: recipe.ingredients.length,
    batchKg: totalWeightKg,
    appCostPrice: costPrice,
    excelCostPrice,
    appBatchCost: directCost,
    excelBatchCost: excelDirectCost,
  });

  return recipe;
}

const semiRecipes = Object.entries(semiSheetConfig).map(([sheetName, config]) =>
  parseSemiFinishedSheet(sheetName, config)
);
const semiRecipeByName = new Map(
  semiRecipes.flatMap((recipe) => [
    [normalizeKey(recipe.name), recipe],
    [normalizeKey(recipe.name.replace(/^decor\s+/i, "")), recipe],
  ])
);

function resolveSemiRecipe(name) {
  const normalized = normalizeKey(name);
  const direct = semiRecipeByName.get(normalized);
  if (direct) return direct;

  if (normalized === "limoen mousse") return semiRecipeByName.get("limoenmousse");
  if (normalized === "limoen schuim") return semiRecipeByName.get("limoenschuim");
  if (normalized === "biscuit") return semiRecipeByName.get("biscuit kruimels");

  return null;
}

function parseFinalProductSheet() {
  const sheetName = "Compleet product citroen taart";
  const rows = readSheetRows(sheetName);
  const recipeId = "recipe-jacobs-taart-citroen";
  const existing = recipeById.get(recipeId);
  const title =
    cleanText(rows[2]?.[1]) ||
    cleanText(rows.find((row) => row.some((cell) => cleanText(cell)))?.[1]) ||
    "lemon pie";
  const salesPrice = parseNumber(rows[3]?.[5]) || 19.95;
  const ingredientLines = [];
  const semiFinishedItems = [];

  for (const row of rows) {
    const indexLabel = cleanText(row[11]);
    const name = cleanText(row[12]);
    const quantityGram = parseNumber(row[18]);
    const pricePerKg = parseNumber(row[19]);
    const excelCost = parseNumber(row[20]);

    if (!/^\d+\.?$/.test(indexLabel)) continue;
    if (!name || quantityGram <= 0) continue;

    const semiRecipe = resolveSemiRecipe(name);
    if (semiRecipe) {
      const costContribution = semiFinishedCostForQuantity(
        semiRecipe,
        quantityGram,
        "gram"
      );
      semiFinishedItems.push({
        semiFinishedRecipeId: semiRecipe.id,
        quantity: roundQuantity(quantityGram),
        unit: "gram",
        costContribution,
      });
      continue;
    }

    const ingredient = resolveIngredient(name, pricePerKg);
    ingredientLines.push({
      ingredientId: ingredient.id,
      quantity: roundQuantity(quantityGram),
      unit: "gram",
      costContribution: ingredientCostForQuantity(
        ingredient,
        quantityGram,
        "gram"
      ),
      excelCost: roundMoney(excelCost),
    });
  }

  const directCost = ingredientLines.reduce(
    (total, line) => total + line.costContribution,
    0
  );
  const semiCost = semiFinishedItems.reduce(
    (total, line) => total + line.costContribution,
    0
  );
  const costPrice = roundMoney(directCost + semiCost);

  const recipe = {
    id: recipeId,
    name: "Taart Citroen (Jacobs)",
    type: "finalProduct",
    productGroup: "Taarten",
    standardBatchQuantity: 1,
    standardBatchUnit: "stuk",
    salesPrice,
    costPrice,
    previousCostPrice: existing?.costPrice || 0,
    targetMargin: 80,
    currentMargin: calculateMargin(salesPrice, costPrice),
    status: "active",
    ingredients: ingredientLines.map(({ ingredientId, quantity, unit, costContribution }) => ({
      ingredientId,
      quantity,
      unit,
      costContribution,
    })),
    semiFinishedItems,
    packagingItems: [],
    workInstructions: [
      "Opbouw volgens Excel: tartelette deeg, biscuit kruimels, limoenschuim, limoenmousse, citroen appereille, spuitchocolade puur, decor chocolade groen en Jelfix spuitgelei.",
      "Werkvolgorde en afwerking stonden niet verder uitgewerkt in het Excel-bestand.",
    ],
    preparationSteps: [
      "Opbouw volgens Excel: tartelette deeg, biscuit kruimels, limoenschuim, limoenmousse, citroen appereille, spuitchocolade puur, decor chocolade groen en Jelfix spuitgelei.",
      "Werkvolgorde en afwerking stonden niet verder uitgewerkt in het Excel-bestand.",
    ],
    finishingSteps: [],
    equipment: [],
    allergens: ["Melk", "Ei", "Gluten"],
    internalNotes: `Geimporteerd uit ${sourceLabel}, tabblad ${sheetName}. Originele Excelnaam: ${title}.`,
    isWorkModeVisible: true,
    workCategories: [],
    version: "Jacobs Excel",
    lastUpdated: today,
    portionLabel: "per stuk",
    batchSize: "1 stuk",
    photoHint: "Taart Citroen Jacobs",
    photoPreviewDataUrl: existing?.photoPreviewDataUrl || "",
    photoFileName: existing?.photoFileName || "",
    photoUpdatedAt: existing?.photoUpdatedAt || "",
    notes: `Verkoopprijs volgens Excel: EUR ${roundMoney(salesPrice)} incl. btw. Bron: ${sourceLabel}.`,
    linkedFinalProductIds: [],
    packagingCost: 0,
    decorationCost: 0,
    decorationMargin: 0,
    averageSalesQuantity: existing?.averageSalesQuantity || 0,
    averageSalesPeriod: existing?.averageSalesPeriod || "week",
    canProduceAhead: true,
    desiredProductionFrequencyDays: existing?.desiredProductionFrequencyDays || 7,
    desiredProductionBatchQuantity: existing?.desiredProductionBatchQuantity || 1,
    lastProducedAt: existing?.lastProducedAt || "",
    lastProducedQuantity: existing?.lastProducedQuantity || 0,
    productionLog: existing?.productionLog || [],
    productionRequests: existing?.productionRequests || [],
  };

  report.parsedSheets.push({
    sheetName,
    recipeId: recipe.id,
    recipeName: recipe.name,
    type: recipe.type,
    ingredients: recipe.ingredients.length,
    semiFinishedItems: recipe.semiFinishedItems.length,
    appCostPrice: recipe.costPrice,
    salesPrice: recipe.salesPrice,
    currentMargin: recipe.currentMargin,
  });

  return recipe;
}

const finalRecipe = parseFinalProductSheet();
const importedRecipes = [...semiRecipes, finalRecipe];

for (const recipe of semiRecipes) {
  const existing = recipeById.get(recipe.id);
  recipeById.set(recipe.id, {
    ...existing,
    ...recipe,
    productionLog: existing?.productionLog || recipe.productionLog || [],
    productionRequests: existing?.productionRequests || recipe.productionRequests || [],
  });
  report.recipeUpserts.push({
    id: recipe.id,
    name: recipe.name,
    action: existing ? "updated" : "created",
  });
}

const existingFinal = recipeById.get(finalRecipe.id);
recipeById.set(finalRecipe.id, {
  ...existingFinal,
  ...finalRecipe,
  productionLog: existingFinal?.productionLog || finalRecipe.productionLog || [],
  productionRequests:
    existingFinal?.productionRequests || finalRecipe.productionRequests || [],
});
report.recipeUpserts.push({
  id: finalRecipe.id,
  name: finalRecipe.name,
  action: existingFinal ? "updated" : "created",
});

const existingOrder = recipes.map((recipe) => recipe.id);
const appendedImportedIds = importedRecipes
  .map((recipe) => recipe.id)
  .filter((id) => !existingOrder.includes(id));
const orderedIds = [...existingOrder, ...appendedImportedIds];
const orderedRecipeIds = new Set();
const nextRecipes = [];

for (const id of orderedIds) {
  if (orderedRecipeIds.has(id)) continue;
  const recipe = recipeById.get(id);
  if (!recipe) continue;
  nextRecipes.push(recipe);
  orderedRecipeIds.add(id);
}

for (const [id, recipe] of recipeById.entries()) {
  if (orderedRecipeIds.has(id)) continue;
  nextRecipes.push(recipe);
}

const nextData = {
  ...baseData,
  ingredients,
  recipes: nextRecipes,
  updatedAt: now,
};

report.after = {
  ingredients: nextData.ingredients.length,
  recipes: nextData.recipes.length,
  createdIngredients: report.createdIngredients.length,
  importedRecipes: importedRecipes.length,
  priceDifferences: report.priceDifferences.length,
};

fs.writeFileSync(outputJsonPath, `${JSON.stringify(nextData, null, 2)}\n`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      outputJson: path.resolve(outputJsonPath),
      reportJson: path.resolve(reportPath),
      before: report.before,
      after: report.after,
      importedRecipes: report.recipeUpserts,
    },
    null,
    2
  )
);
