import { NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type {
  Ingredient,
  Recipe,
  RecipeIngredient,
  RecipeUnit,
} from "@/app/bakkerij/recepturen/types";
import {
  normalizeSearch,
  pricePerBaseUnitFromPackagePrice,
} from "@/app/bakkerij/recepturen/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ImportKind = "recipes" | "ingredients";

type UploadedFile = File & {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
};

type CanvasPolyfillModule = typeof import("@napi-rs/canvas") & {
  default?: Partial<typeof import("@napi-rs/canvas")>;
};

type IngredientColumnMap = {
  name?: number;
  supplier?: number;
  articleNumber?: number;
  packageSize?: number;
  recipeUnit?: number;
  price?: number;
  allergens?: number;
  aliases?: number;
};

type RecipeColumnMap = {
  recipe?: number;
  group?: number;
  type?: number;
  batchQuantity?: number;
  batchUnit?: number;
  batchText?: number;
  ingredient?: number;
  quantity?: number;
  unit?: number;
  step?: number;
  finishingStep?: number;
  allergens?: number;
  internalNotes?: number;
};

type ParsedImport = {
  ingredients?: Ingredient[];
  recipes?: Recipe[];
  warnings: string[];
  message: string;
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const INGREDIENT_NAME_HEADERS = [
  "ingredient",
  "grondstof",
  "naam",
  "product",
  "omschrijving",
  "artikel",
];
const SUPPLIER_HEADERS = ["leverancier", "supplier", "fabrikant"];
const ARTICLE_HEADERS = [
  "artikelnummer",
  "artikelnr",
  "artikel nr",
  "artikelcode",
  "code",
  "nummer",
];
const PACKAGE_HEADERS = ["verpakking", "inhoud", "package", "eenheid"];
const RECIPE_UNIT_HEADERS = ["rekeneenheid", "recept eenheid", "basis eenheid"];
const PRICE_HEADERS = [
  "prijs per kg",
  "prijs/kg",
  "kg prijs",
  "kiloprijs",
  "prijs per liter",
  "prijs/l",
  "literprijs",
  "prijs per stuk",
  "stuksprijs",
  "prijs",
];
const ALLERGEN_HEADERS = ["allergenen", "allergeen", "allergens"];
const ALIAS_HEADERS = ["aliassen", "alias", "zoeknamen"];
const RECIPE_HEADERS = ["recept", "receptnaam", "naam", "product"];
const GROUP_HEADERS = ["productgroep", "groep", "categorie"];
const TYPE_HEADERS = ["type", "soort"];
const BATCH_QUANTITY_HEADERS = ["batch aantal", "standaard batch", "opbrengst"];
const BATCH_UNIT_HEADERS = ["batch eenheid", "batch unit", "eenheid batch"];
const BATCH_TEXT_HEADERS = ["batch", "batch tekst", "opbrengst tekst"];
const QUANTITY_HEADERS = ["hoeveelheid", "aantal", "qty", "gewicht"];
const UNIT_HEADERS = ["eenheid", "unit"];
const STEP_HEADERS = ["stap", "bereiding", "bereidingswijze", "werkwijze"];
const FINISHING_HEADERS = ["afwerking", "decoratie", "finishing"];
const NOTE_HEADERS = ["notitie", "opmerking", "interne opmerking"];

function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

function isUploadedFile(value: FormDataEntryValue | null): value is UploadedFile {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      "name" in value &&
      "size" in value
  );
}

function parseExistingIngredients(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as Ingredient[]) : [];
  } catch {
    return [];
  }
}

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function cleanCell(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: unknown) {
  return normalizeSearch(String(value ?? ""))
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headerMatches(header: string, option: string) {
  if (header === option) return true;
  if (header.startsWith(`${option} `)) return true;
  if (header.endsWith(` ${option}`)) return true;

  return option.length > 8 && header.includes(option);
}

function findHeaderIndex(headers: string[], options: string[]) {
  const normalizedOptions = options.map(normalizeHeader);

  return headers.findIndex((header) =>
    normalizedOptions.some((option) => headerMatches(header, option))
  );
}

function parseDutchNumber(value: unknown) {
  const number = Number.parseFloat(
    String(value ?? "")
      .trim()
      .replace(/\s/g, "")
      .replace(/€|\u00a0/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(number) ? Math.max(0, Math.round(number * 10000) / 10000) : 0;
}

function parseList(value: unknown) {
  return String(value ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unitLabel(unit: RecipeUnit) {
  if (unit === "gram") return "g";
  if (unit === "liter") return "l";

  return unit;
}

function unitFromText(value: string, fallback: RecipeUnit = "gram"): RecipeUnit {
  const normalized = normalizeSearch(value);

  if (/\b(kg|kilo|kilogram|g|gr|gram)\b/.test(normalized)) return "gram";
  if (/\b(l|ltr|liter|ml)\b/.test(normalized)) return "ml";
  if (/\b(st|stuk|stuks)\b/.test(normalized)) return "stuk";

  return fallback;
}

function recipeLineUnitFromText(value: string, fallback: RecipeUnit = "gram") {
  const normalized = normalizeSearch(value);

  if (/\b(kg|kilo|kilogram)\b/.test(normalized)) return "kg";
  if (/\b(g|gr|gram)\b/.test(normalized)) return "gram";
  if (/\b(l|ltr|liter)\b/.test(normalized)) return "liter";
  if (/\bml\b/.test(normalized)) return "ml";
  if (/\b(st|stuk|stuks)\b/.test(normalized)) return "stuk";

  return fallback;
}

function uniqueId(prefix: string, name: string, existingIds: Set<string>) {
  const base =
    normalizeSearch(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || prefix;
  let id = `${prefix}-${base}`;
  let counter = 1;

  while (existingIds.has(id)) {
    counter += 1;
    id = `${prefix}-${base}-${counter}`;
  }

  existingIds.add(id);

  return id;
}

function findMatchingIngredient(name: string, ingredients: Ingredient[]) {
  const normalizedName = normalizeSearch(name);

  return ingredients.find((ingredient) =>
    [ingredient.name, ...ingredient.aliases].some((alias) => {
      const normalizedAlias = normalizeSearch(alias);

      return (
        normalizedAlias &&
        normalizedName &&
        (normalizedName.includes(normalizedAlias) ||
          normalizedAlias.includes(normalizedName))
      );
    })
  );
}

function getCell(row: string[], index?: number) {
  return index === undefined ? "" : row[index] || "";
}

function parseCsvRows(text: string) {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
  });

  return result.data
    .filter((row): row is string[] => Array.isArray(row))
    .map((row) => row.map(cleanCell));
}

function parseWorkbookRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
  });

  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    return rows.map((row) => row.map(cleanCell));
  });
}

function compactTextLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function mapIngredientHeaders(row: string[]): IngredientColumnMap {
  const headers = row.map(normalizeHeader);
  const map: IngredientColumnMap = {
    name: findHeaderIndex(headers, INGREDIENT_NAME_HEADERS),
    supplier: findHeaderIndex(headers, SUPPLIER_HEADERS),
    articleNumber: findHeaderIndex(headers, ARTICLE_HEADERS),
    packageSize: findHeaderIndex(headers, PACKAGE_HEADERS),
    recipeUnit: findHeaderIndex(headers, RECIPE_UNIT_HEADERS),
    price: findHeaderIndex(headers, PRICE_HEADERS),
    allergens: findHeaderIndex(headers, ALLERGEN_HEADERS),
    aliases: findHeaderIndex(headers, ALIAS_HEADERS),
  };

  Object.entries(map).forEach(([key, value]) => {
    if (value === -1) delete map[key as keyof IngredientColumnMap];
  });

  return map;
}

function mapRecipeHeaders(row: string[]): RecipeColumnMap {
  const headers = row.map(normalizeHeader);
  const ingredientIndex = findHeaderIndex(headers, INGREDIENT_NAME_HEADERS);
  const map: RecipeColumnMap = {
    recipe: findHeaderIndex(headers, RECIPE_HEADERS),
    group: findHeaderIndex(headers, GROUP_HEADERS),
    type: findHeaderIndex(headers, TYPE_HEADERS),
    batchQuantity: findHeaderIndex(headers, BATCH_QUANTITY_HEADERS),
    batchUnit: findHeaderIndex(headers, BATCH_UNIT_HEADERS),
    batchText: findHeaderIndex(headers, BATCH_TEXT_HEADERS),
    ingredient:
      ingredientIndex === findHeaderIndex(headers, RECIPE_HEADERS)
        ? undefined
        : ingredientIndex,
    quantity: findHeaderIndex(headers, QUANTITY_HEADERS),
    unit: findHeaderIndex(headers, UNIT_HEADERS),
    step: findHeaderIndex(headers, STEP_HEADERS),
    finishingStep: findHeaderIndex(headers, FINISHING_HEADERS),
    allergens: findHeaderIndex(headers, ALLERGEN_HEADERS),
    internalNotes: findHeaderIndex(headers, NOTE_HEADERS),
  };

  Object.entries(map).forEach(([key, value]) => {
    if (value === -1) delete map[key as keyof RecipeColumnMap];
  });

  return map;
}

function usefulIngredientMap(map: IngredientColumnMap) {
  return map.name !== undefined && map.price !== undefined;
}

function usefulRecipeMap(map: RecipeColumnMap) {
  return map.recipe !== undefined || map.ingredient !== undefined || map.step !== undefined;
}

function parseIngredientRows(rows: string[][]) {
  const cleanRows = rows
    .map((row) => row.map(cleanCell))
    .filter((row) => row.some(Boolean));
  const headerIndex = cleanRows.findIndex((row) => usefulIngredientMap(mapIngredientHeaders(row)));
  const warnings: string[] = [];

  if (headerIndex === -1) {
    return { ingredients: [] as Ingredient[], warnings: ["Geen grondstofkolommen herkend."] };
  }

  const map = mapIngredientHeaders(cleanRows[headerIndex]);
  const ids = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  const parsedIngredients = cleanRows
    .slice(headerIndex + 1)
    .map((row) => {
      const name = getCell(row, map.name);
      const price = parseDutchNumber(getCell(row, map.price));
      if (!name || !price) return null;

      const packageSize = getCell(row, map.packageSize) || "1 kg";
      const recipeUnit = unitFromText(
        `${getCell(row, map.recipeUnit)} ${packageSize} ${name}`
      );
      const lastPrice = price;

      const ingredient: Ingredient = {
        id: uniqueId("ing-import", name, ids),
        name,
        supplier: getCell(row, map.supplier) || "Bestandsimport",
        supplierArticleNumber: getCell(row, map.articleNumber) || "-",
        packageSize,
        recipeUnit,
        lastPrice,
        previousPrice: lastPrice,
        pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(lastPrice, recipeUnit),
        allergens: parseList(getCell(row, map.allergens)),
        lastUpdated: today,
        status: "active" as const,
        lastInvoice: "Bestandsimport",
        aliases: Array.from(new Set([name, ...parseList(getCell(row, map.aliases))])),
      };

      return ingredient;
    })
    .filter((ingredient): ingredient is Ingredient => Boolean(ingredient));

  if (!parsedIngredients.length) {
    warnings.push("Er zijn kolommen gevonden, maar geen regels met naam en prijs.");
  }

  return { ingredients: parsedIngredients, warnings };
}

function parseRecipeRows(rows: string[][], ingredients: Ingredient[], fileName: string) {
  const cleanRows = rows
    .map((row) => row.map(cleanCell))
    .filter((row) => row.some(Boolean));
  const headerIndex = cleanRows.findIndex((row) => usefulRecipeMap(mapRecipeHeaders(row)));
  const warnings: string[] = [];

  if (headerIndex === -1) {
    return { recipes: [] as Recipe[], warnings: ["Geen receptkolommen herkend."] };
  }

  const map = mapRecipeHeaders(cleanRows[headerIndex]);
  const ids = new Set<string>();
  const grouped = new Map<string, Recipe>();
  const today = new Date().toISOString().slice(0, 10);
  let currentRecipeName = "";

  cleanRows.slice(headerIndex + 1).forEach((row) => {
    const rowRecipeName = getCell(row, map.recipe);
    if (rowRecipeName) currentRecipeName = rowRecipeName;
    if (!currentRecipeName) return;

    const recipe = getOrCreateImportedRecipe(
      grouped,
      currentRecipeName,
      ids,
      today,
      fileName
    );
    const group = getCell(row, map.group);
    const type = getCell(row, map.type);
    const batchQuantity = parseDutchNumber(getCell(row, map.batchQuantity));
    const batchUnitText = getCell(row, map.batchUnit);
    const batchText = getCell(row, map.batchText);
    const ingredientName = getCell(row, map.ingredient);
    const quantity = parseDutchNumber(getCell(row, map.quantity));
    const unit = recipeLineUnitFromText(getCell(row, map.unit));
    const step = getCell(row, map.step);
    const finishingStep = getCell(row, map.finishingStep);
    const notes = getCell(row, map.internalNotes);
    const allergens = parseList(getCell(row, map.allergens));

    if (group) recipe.productGroup = group;
    if (type) recipe.type = /half|basis|vulling|mousse/i.test(type)
      ? "semiFinished"
      : "finalProduct";
    if (batchQuantity) {
      recipe.standardBatchQuantity = batchQuantity;
      recipe.standardBatchUnit = recipeLineUnitFromText(batchUnitText, unit);
      recipe.batchSize = `${batchQuantity} ${unitLabel(recipe.standardBatchUnit)}`;
    } else if (batchText) {
      const parsedBatch = batchText.match(
        /(\d+(?:[.,]\d+)?)\s*(kg|g|gram|l|liter|ml|st|stuk|stuks)\b/i
      );

      if (parsedBatch) {
        recipe.standardBatchQuantity = parseDutchNumber(parsedBatch[1]);
        recipe.standardBatchUnit = recipeLineUnitFromText(parsedBatch[2], unit);
        recipe.batchSize = `${recipe.standardBatchQuantity} ${unitLabel(recipe.standardBatchUnit)}`;
      }
    }

    if (ingredientName && quantity) {
      const matchedIngredient = findMatchingIngredient(ingredientName, ingredients);
      if (matchedIngredient) {
        const line: RecipeIngredient = {
          ingredientId: matchedIngredient.id,
          quantity,
          unit,
          costContribution: 0,
        };

        recipe.ingredients.push(line);
      } else {
        warnings.push(`Geen grondstofmatch voor "${ingredientName}" in ${recipe.name}.`);
      }
    }

    if (step && !recipe.preparationSteps.includes(step)) {
      recipe.preparationSteps.push(step);
    }

    if (finishingStep && !recipe.finishingSteps?.includes(finishingStep)) {
      recipe.finishingSteps = [...(recipe.finishingSteps || []), finishingStep];
    }

    if (notes) recipe.internalNotes = notes;
    recipe.allergens = Array.from(new Set([...recipe.allergens, ...allergens]));
  });

  return { recipes: Array.from(grouped.values()), warnings };
}

function getOrCreateImportedRecipe(
  grouped: Map<string, Recipe>,
  name: string,
  ids: Set<string>,
  today: string,
  fileName: string
) {
  const key = normalizeSearch(name);
  const existing = grouped.get(key);
  if (existing) return existing;

  const recipe: Recipe = {
    id: uniqueId("recipe-import", name, ids),
    name,
    type: "finalProduct",
    productGroup: "Import",
    standardBatchQuantity: 1,
    standardBatchUnit: "stuk",
    salesPrice: 0,
    costPrice: 0,
    previousCostPrice: 0,
    targetMargin: 75,
    currentMargin: 0,
    status: "draft",
    ingredients: [],
    semiFinishedItems: [],
    workInstructions: [],
    preparationSteps: [],
    finishingSteps: [],
    equipment: [],
    allergens: [],
    internalNotes: "",
    isWorkModeVisible: true,
    version: "import",
    lastUpdated: today,
    portionLabel: "1 stuk",
    batchSize: "1 stuk",
    photoHint: fileName.replace(/\.[^.]+$/, ""),
    photoPreviewDataUrl: "",
    photoFileName: "",
    photoUpdatedAt: "",
    notes: "",
    linkedFinalProductIds: [],
    packagingCost: 0,
    decorationCost: 0,
    decorationMargin: 30,
  };

  grouped.set(key, recipe);

  return recipe;
}

function parseTextRecipe(text: string, ingredients: Ingredient[], fileName: string) {
  const lines = compactTextLines(text);
  const warnings: string[] = [];
  if (!lines.length) return { recipes: [] as Recipe[], warnings };

  const today = new Date().toISOString().slice(0, 10);
  const ids = new Set<string>();
  const name =
    lines.find((line) => !/^(recept|ingredienten|bereiding|werkwijze)\b/i.test(line)) ||
    fileName.replace(/\.[^.]+$/, "");
  const recipe = getOrCreateImportedRecipe(new Map(), name, ids, today, fileName);
  const batchLine = lines.find((line) => /batch|opbrengst|porties|stuks/i.test(line));
  const batchMatch = batchLine?.match(
    /(\d+(?:[.,]\d+)?)\s*(kg|g|gram|l|liter|ml|st|stuk|stuks)\b/i
  );

  if (batchMatch) {
    recipe.standardBatchQuantity = parseDutchNumber(batchMatch[1]);
    recipe.standardBatchUnit = recipeLineUnitFromText(batchMatch[2]);
    recipe.batchSize = `${recipe.standardBatchQuantity} ${unitLabel(recipe.standardBatchUnit)}`;
  }

  lines.forEach((line) => {
    const ingredientMatch = line.match(
      /^(\d+(?:[.,]\d+)?)\s*(kg|g|gram|l|liter|ml|st|stuk|stuks)\s+(.+)$/i
    );

    if (ingredientMatch) {
      const quantity = parseDutchNumber(ingredientMatch[1]);
      const unit = recipeLineUnitFromText(ingredientMatch[2]);
      const ingredientName = ingredientMatch[3].replace(/[.;:]$/, "").trim();
      const matchedIngredient = findMatchingIngredient(ingredientName, ingredients);

      if (matchedIngredient) {
        recipe.ingredients.push({
          ingredientId: matchedIngredient.id,
          quantity,
          unit,
          costContribution: 0,
        });
      } else {
        warnings.push(`Geen grondstofmatch voor "${ingredientName}".`);
      }

      return;
    }

    if (
      !line.includes(":") &&
      !/^ingredienten|bereiding|werkwijze|recept$/i.test(line) &&
      line !== recipe.name
    ) {
      recipe.preparationSteps.push(line);
    }
  });

  return { recipes: [recipe], warnings };
}

async function ensurePdfCanvasGlobals() {
  const canvas = (await import("@napi-rs/canvas")) as CanvasPolyfillModule;
  const source = canvas.default || canvas;
  const globals = globalThis as unknown as Record<string, unknown>;

  globals.DOMMatrix ||= source.DOMMatrix;
  globals.ImageData ||= source.ImageData;
  globals.Path2D ||= source.Path2D;
}

async function extractPdfText(buffer: Buffer) {
  await ensurePdfCanvasGlobals();

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText({
      cellSeparator: "\t",
      pageJoiner: "\n",
    });

    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

async function rowsAndTextFromFile(fileName: string, mimeType: string, buffer: Buffer) {
  const extension = getExtension(fileName);

  if (["xlsx", "xls"].includes(extension)) {
    const rows = parseWorkbookRows(buffer);
    return { rows, text: rows.map((row) => row.join("\t")).join("\n") };
  }

  if (["csv", "txt", "tsv"].includes(extension) || mimeType.includes("csv")) {
    const text = buffer.toString("utf8");
    return { rows: parseCsvRows(text), text };
  }

  if (extension === "pdf" || mimeType.includes("pdf")) {
    const text = await extractPdfText(buffer);
    const rows = compactTextLines(text).map((line) => line.split(/\t|;|\s{2,}/));
    return { rows, text };
  }

  throw new Error("Bestandstype wordt nog niet ondersteund.");
}

async function parseImportFile(
  kind: ImportKind,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  ingredients: Ingredient[]
): Promise<ParsedImport> {
  const { rows, text } = await rowsAndTextFromFile(fileName, mimeType, buffer);

  if (kind === "ingredients") {
    const parsed = parseIngredientRows(rows);
    if (!parsed.ingredients.length) {
      throw new Error("Geen grondstoffen herkend. Controleer de kolomnamen.");
    }

    return {
      ingredients: parsed.ingredients,
      warnings: parsed.warnings,
      message: `${parsed.ingredients.length} grondstoffen herkend.`,
    };
  }

  const parsedRows = parseRecipeRows(rows, ingredients, fileName);
  const parsedText = parsedRows.recipes.length
    ? parsedRows
    : parseTextRecipe(text, ingredients, fileName);
  const recipes = parsedText.recipes.filter(
    (recipe) => recipe.ingredients.length || recipe.preparationSteps.length
  );

  if (!recipes.length) {
    throw new Error("Geen recepten herkend. Controleer of ingredienten en stappen leesbaar zijn.");
  }

  return {
    recipes,
    warnings: parsedText.warnings,
    message: `${recipes.length} recepten herkend.`,
  };
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonError("Upload kon niet gelezen worden.");
  }

  const file = formData.get("file");
  if (!isUploadedFile(file)) {
    return jsonError("Geen bestand ontvangen.");
  }

  if (file.size > MAX_FILE_BYTES) {
    return jsonError("Bestand is te groot. Upload maximaal 15 MB.", 413);
  }

  const kindValue = String(formData.get("kind") || "recipes");
  const kind: ImportKind = kindValue === "ingredients" ? "ingredients" : "recipes";
  const ingredients = parseExistingIngredients(formData.get("ingredients"));
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await parseImportFile(
      kind,
      file.name,
      file.type || "",
      buffer,
      ingredients
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Bestand kon niet gelezen worden."
    );
  }
}
