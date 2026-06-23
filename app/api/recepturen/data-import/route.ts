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

type ParsedSheet = {
  name: string;
  rows: string[][];
  text: string;
};

type FileTextRows = {
  rows: string[][];
  text: string;
  sheets: ParsedSheet[];
  warnings: string[];
};

type RecipeSection =
  | "unknown"
  | "ingredients"
  | "steps"
  | "finishing"
  | "allergens"
  | "notes";

type LooseIngredientCandidate = {
  name: string;
  quantity: number;
  unit: RecipeUnit;
  rawLine: string;
};

type MissingIngredientContext = {
  availableIngredients: Ingredient[];
  createdIngredients: Ingredient[];
  existingIds: Set<string>;
  warnings: string[];
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_IMPORT_ROWS = 3500;
const MAX_IMPORT_TEXT_CHARS = 260000;
const MAX_IMPORT_RECIPES = 25;
const MAX_IMPORT_WARNINGS = 40;
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
const UNIT_WORDS =
  "kg|kilo|kilogram|g|gr|gram|l|ltr|liter|ml|st|stuk|stuks";
const AMOUNT_WITH_UNIT_PATTERN = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_WORDS})\\b`,
  "i"
);
const LOOSE_INGREDIENT_NOISE =
  /\b(kostprijs|verkoop|marge|prijs|totaal|btw|factuur|advies|batch totaal|per stuk)\b/i;

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

function looksLikeUnitCell(value: string) {
  return new RegExp(`^\\s*(?:${UNIT_WORDS})\\s*$`, "i").test(value);
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

function normalizedWords(value: string) {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function compactNormalized(value: string) {
  return normalizedWords(value).join("");
}

function ingredientMatchScore(candidateName: string, ingredient: Ingredient) {
  const candidateWords = normalizedWords(candidateName);
  const candidateCompact = compactNormalized(candidateName);
  if (!candidateWords.length || !candidateCompact) return 0;

  return [ingredient.name, ...ingredient.aliases].reduce((best, alias) => {
    const aliasWords = normalizedWords(alias);
    const aliasCompact = compactNormalized(alias);
    if (!aliasWords.length || !aliasCompact) return best;

    if (candidateCompact === aliasCompact) return Math.max(best, 120);

    const allAliasWordsArePresent = aliasWords.every((word) =>
      candidateWords.includes(word)
    );
    if (allAliasWordsArePresent) {
      return Math.max(best, aliasWords.length > 1 ? 95 : 72);
    }

    const allCandidateWordsArePresent = candidateWords.every((word) =>
      aliasWords.includes(word)
    );
    if (allCandidateWordsArePresent && candidateWords.length > 1) {
      return Math.max(best, 82);
    }

    if (
      aliasWords.length > 1 &&
      candidateWords.length > 1 &&
      (candidateCompact.includes(aliasCompact) ||
        aliasCompact.includes(candidateCompact))
    ) {
      return Math.max(best, 68);
    }

    return best;
  }, 0);
}

function findMatchingIngredient(name: string, ingredients: Ingredient[]) {
  const scored = ingredients
    .map((ingredient) => ({
      ingredient,
      score: ingredientMatchScore(name, ingredient),
    }))
    .filter((item) => item.score >= 68)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.ingredient;
}

function importIngredientUnitFromRecipeLine(unit: RecipeUnit): RecipeUnit {
  if (unit === "kg" || unit === "gram") return "gram";
  if (unit === "liter" || unit === "ml") return "ml";

  return "stuk";
}

function averageImportPriceForUnit(ingredients: Ingredient[], unit: RecipeUnit) {
  const sameUnitPrices = ingredients
    .filter((ingredient) => ingredient.recipeUnit === unit)
    .map((ingredient) => ingredient.lastPrice || ingredient.pricePerBaseUnit)
    .filter((price) => Number.isFinite(price) && price > 0);
  const fallbackPrices = ingredients
    .map((ingredient) => ingredient.lastPrice || ingredient.pricePerBaseUnit)
    .filter((price) => Number.isFinite(price) && price > 0);
  const prices = sameUnitPrices.length ? sameUnitPrices : fallbackPrices;

  if (!prices.length) {
    return unit === "stuk" ? 1 : 5;
  }

  return Math.round((prices.reduce((total, price) => total + price, 0) / prices.length) * 100) / 100;
}

function packageSizeForImportUnit(unit: RecipeUnit) {
  if (unit === "ml") return "1 liter";
  if (unit === "stuk") return "1 stuk";

  return "1 kg";
}

function getOrCreateMissingIngredient(
  name: string,
  lineUnit: RecipeUnit,
  context: MissingIngredientContext
) {
  const allIngredients = [
    ...context.createdIngredients,
    ...context.availableIngredients,
  ];
  const existing = findMatchingIngredient(name, allIngredients);
  if (existing) return existing;

  const recipeUnit = importIngredientUnitFromRecipeLine(lineUnit);
  const lastPrice = averageImportPriceForUnit(context.availableIngredients, recipeUnit);
  const today = new Date().toISOString().slice(0, 10);
  const ingredient: Ingredient = {
    id: uniqueId("ing-auto", name, context.existingIds),
    name,
    supplier: "Receptimport",
    supplierArticleNumber: "-",
    packageSize: packageSizeForImportUnit(recipeUnit),
    recipeUnit,
    lastPrice,
    previousPrice: lastPrice,
    pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(lastPrice, recipeUnit),
    allergens: [],
    lastUpdated: today,
    status: "active",
    lastInvoice: "Gemiddelde importprijs",
    aliases: [name],
  };

  context.createdIngredients.push(ingredient);
  pushWarning(
    context.warnings,
    `Nieuwe grondstof "${name}" aangemaakt met gemiddelde inkoopprijs. Controleer later de echte prijs.`
  );

  return ingredient;
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

function limitRows(rows: string[][], warnings: string[]) {
  if (rows.length <= MAX_IMPORT_ROWS) return rows;

  warnings.push(
    `Bestand is ingekort naar ${MAX_IMPORT_ROWS} regels om de import licht te houden.`
  );

  return rows.slice(0, MAX_IMPORT_ROWS);
}

function limitText(text: string, warnings: string[]) {
  if (text.length <= MAX_IMPORT_TEXT_CHARS) return text;

  warnings.push(
    "Bestand bevat heel veel tekst; alleen het eerste deel is gelezen."
  );

  return text.slice(0, MAX_IMPORT_TEXT_CHARS);
}

function parseWorkbookSheets(buffer: Buffer, warnings: string[]) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
  });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const cleanRows = limitRows(
      rows.map((row) => row.map(cleanCell)),
      warnings
    );

    return {
      name: sheetName,
      rows: cleanRows,
      text: limitText(cleanRows.map((row) => row.join("\t")).join("\n"), warnings),
    };
  });
}

function compactTextLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function pushWarning(warnings: string[], message: string) {
  if (warnings.length >= MAX_IMPORT_WARNINGS || warnings.includes(message)) {
    return;
  }

  warnings.push(message);
}

function cleanRecipeLine(value: string) {
  return value
    .replace(/^\s*(?:\d+[\).:-]\s*)+/, "")
    .replace(/[•·]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isBoringSheetName(name: string) {
  return /^(sheet|blad|tabblad|recept|recipes?)\s*\d*$/i.test(name.trim());
}

function isLikelySectionHeading(line: string) {
  return Boolean(classifyRecipeSection(line) !== "unknown");
}

function isLikelyRecipeTitle(line: string) {
  const clean = cleanRecipeLine(line);

  return (
    clean.length >= 3 &&
    clean.length <= 80 &&
    /[a-z]/i.test(clean) &&
    !AMOUNT_WITH_UNIT_PATTERN.test(clean) &&
    !LOOSE_INGREDIENT_NOISE.test(clean) &&
    !isLikelySectionHeading(clean)
  );
}

function classifyRecipeSection(line: string): RecipeSection {
  if (AMOUNT_WITH_UNIT_PATTERN.test(line)) return "unknown";
  if (line.length > 90) return "unknown";

  const normalized = normalizeSearch(line);

  if (
    /\b(ingredienten|ingredient|grondstoffen|grondstof|receptuur|samenstelling|deeg|beslag|vulling|massa)\b/.test(
      normalized
    )
  ) {
    return "ingredients";
  }

  if (
    /\b(bereiding|bereidingswijze|werkwijze|methode|productie|instructie|stappen|maakwijze)\b/.test(
      normalized
    )
  ) {
    return "steps";
  }

  if (/\b(afwerking|decoratie|opmaak|garnering|finishing)\b/.test(normalized)) {
    return "finishing";
  }

  if (/\b(allergenen|allergeen|allergens)\b/.test(normalized)) {
    return "allergens";
  }

  if (/\b(opmerking|opmerkingen|notitie|notities|bewaren|let op)\b/.test(normalized)) {
    return "notes";
  }

  return "unknown";
}

function parseBatchFromLine(line: string) {
  const match = line.match(
    /\b(?:batch|opbrengst|recept\s*voor|aantal|porties?)\D{0,24}(\d+(?:[.,]\d+)?)\s*([a-z]+)?/i
  );
  const standaloneMatch = line.match(
    new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_WORDS})\\s*$`, "i")
  );
  const parsedMatch = match || standaloneMatch;

  if (!parsedMatch) return null;

  const quantity = parseDutchNumber(parsedMatch[1]);
  if (!quantity) return null;

  const unit = recipeLineUnitFromText(parsedMatch[2] || line, "stuk");

  return {
    quantity,
    unit,
  };
}

function findRecipeTitle(rows: string[][], sheetName: string, fileName: string) {
  const explicitTitle = rows
    .map((row) => row.join(" ").trim())
    .find((line) => /\b(receptnaam|recept|product)\b\s*[:=-]\s*.+/i.test(line));

  if (explicitTitle) {
    const [, title] =
      explicitTitle.match(/\b(?:receptnaam|recept|product)\b\s*[:=-]\s*(.+)/i) ||
      [];
    if (title) return cleanRecipeLine(title);
  }

  if (sheetName && !isBoringSheetName(sheetName)) {
    return cleanRecipeLine(sheetName);
  }

  const titleLine = rows
    .slice(0, 18)
    .map((row) => row.filter(Boolean).join(" ").trim())
    .find(isLikelyRecipeTitle);

  return titleLine
    ? cleanRecipeLine(titleLine)
    : fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function findRecipeBatch(rows: string[][]) {
  for (const row of rows.slice(0, 32)) {
    const line = row.join(" ").trim();
    const batch = parseBatchFromLine(line);

    if (batch) return batch;
  }

  return null;
}

function parseLooseIngredientLine(line: string): LooseIngredientCandidate | null {
  const clean = cleanRecipeLine(line);
  if (!clean || LOOSE_INGREDIENT_NOISE.test(clean)) return null;

  const amountFirst = clean.match(
    new RegExp(
      `^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_WORDS})\\b\\s+(.+)$`,
      "i"
    )
  );
  if (amountFirst) {
    return {
      quantity: parseDutchNumber(amountFirst[1]),
      unit: recipeLineUnitFromText(amountFirst[2]),
      name: cleanRecipeLine(amountFirst[3].replace(/[.;:]$/, "")),
      rawLine: clean,
    };
  }

  const amountLast = clean.match(
    new RegExp(
      `^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_WORDS})\\b.*$`,
      "i"
    )
  );
  if (amountLast) {
    return {
      name: cleanRecipeLine(amountLast[1].replace(/[.;:]$/, "")),
      quantity: parseDutchNumber(amountLast[2]),
      unit: recipeLineUnitFromText(amountLast[3]),
      rawLine: clean,
    };
  }

  return null;
}

function parseLooseIngredientRow(
  row: string[],
  section: RecipeSection
): LooseIngredientCandidate | null {
  const cells = row.map(cleanCell).filter(Boolean);
  if (!cells.length) return null;

  const lineCandidate = parseLooseIngredientLine(cells.join(" "));
  if (lineCandidate) return lineCandidate;

  const amountCellIndexWithUnit = cells.findIndex((cell, index) => {
    if (!parseDutchNumber(cell)) return false;

    return looksLikeUnitCell(cells[index + 1] || "") ||
      looksLikeUnitCell(cells[index - 1] || "");
  });
  const amountCellIndex =
    amountCellIndexWithUnit >= 0
      ? amountCellIndexWithUnit
      : cells.findIndex((cell) => {
          if (!parseDutchNumber(cell)) return false;

          return !/[a-z]/i.test(cell);
        });
  if (amountCellIndex === -1) return null;

  const amount = parseDutchNumber(cells[amountCellIndex]);
  if (!amount) return null;

  const unitCell =
    cells[amountCellIndex + 1] || cells[amountCellIndex - 1] || cells.join(" ");
  const unit = recipeLineUnitFromText(unitCell, "gram");
  const nameCell = cells.find((cell, index) => {
    if (index === amountCellIndex) return false;
    if (cell === unitCell && /\b(kg|g|gram|l|liter|ml|st|stuk|stuks)\b/i.test(cell)) {
      return false;
    }

    return (
      /[a-z]/i.test(cell) &&
      !AMOUNT_WITH_UNIT_PATTERN.test(cell) &&
      !LOOSE_INGREDIENT_NOISE.test(cell) &&
      !isLikelySectionHeading(cell)
    );
  });

  if (!nameCell) return null;
  if (section === "unknown" && cells.length < 2) return null;

  return {
    name: cleanRecipeLine(nameCell),
    quantity: amount,
    unit,
    rawLine: cells.join(" "),
  };
}

function isLikelyInstructionLine(line: string) {
  const clean = cleanRecipeLine(line);
  if (clean.length < 8 || clean.length > 220) return false;
  if (AMOUNT_WITH_UNIT_PATTERN.test(clean)) return false;
  if (LOOSE_INGREDIENT_NOISE.test(clean)) return false;

  return /\b(meng|mix|klop|spatel|verwarm|bak|koel|vries|laat|doe|voeg|giet|snijd|weeg|roer|smelt|kneed|rol|vul|garneer|bewaar)\b/i.test(
    clean
  );
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

function parseRecipeRows(
  rows: string[][],
  ingredients: Ingredient[],
  fileName: string,
  missingIngredientContext?: MissingIngredientContext
) {
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
      const matchedIngredient =
        findMatchingIngredient(ingredientName, ingredients) ||
        (missingIngredientContext
          ? getOrCreateMissingIngredient(
              ingredientName,
              unit,
              missingIngredientContext
            )
          : undefined);
      if (matchedIngredient) {
        const line: RecipeIngredient = {
          ingredientId: matchedIngredient.id,
          quantity,
          unit,
          costContribution: 0,
        };

        recipe.ingredients.push(line);
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
    targetMargin: 80,
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

function addLooseIngredientCandidate(
  recipe: Recipe,
  candidate: LooseIngredientCandidate,
  ingredients: Ingredient[],
  warnings: string[],
  unmatched: string[],
  missingIngredientContext?: MissingIngredientContext
) {
  if (!candidate.name || !candidate.quantity) return;

  const matchedIngredient =
    findMatchingIngredient(candidate.name, ingredients) ||
    (missingIngredientContext
      ? getOrCreateMissingIngredient(
          candidate.name,
          candidate.unit,
          missingIngredientContext
        )
      : undefined);

  if (!matchedIngredient) {
    unmatched.push(
      `${candidate.quantity} ${unitLabel(candidate.unit)} ${candidate.name}`
    );
    pushWarning(
      warnings,
      `Controleer grondstof "${candidate.name}": niet automatisch gekoppeld.`
    );
    return;
  }

  recipe.ingredients.push({
    ingredientId: matchedIngredient.id,
    quantity: candidate.quantity,
    unit: candidate.unit,
    costContribution: 0,
  });
}

function applyLooseNotes(recipe: Recipe, unmatched: string[]) {
  if (!unmatched.length) return;

  const noteLines = [
    "Niet automatisch gekoppeld uit import:",
    ...unmatched.slice(0, 30).map((line) => `- ${line}`),
  ];
  const importNote = noteLines.join("\n");

  recipe.internalNotes = recipe.internalNotes
    ? `${recipe.internalNotes}\n\n${importNote}`
    : importNote;
  recipe.notes = recipe.notes ? `${recipe.notes}\n\n${importNote}` : importNote;
}

function parseLooseRecipeSheet(
  sheet: ParsedSheet,
  ingredients: Ingredient[],
  fileName: string,
  ids: Set<string>,
  missingIngredientContext?: MissingIngredientContext
) {
  const warnings: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const name = findRecipeTitle(sheet.rows, sheet.name, fileName);
  const recipe = getOrCreateImportedRecipe(
    new Map<string, Recipe>(),
    name,
    ids,
    today,
    fileName
  );
  const batch = findRecipeBatch(sheet.rows);
  const unmatched: string[] = [];
  let section: RecipeSection = "unknown";
  let sawLikelyRecipeData = false;

  if (batch) {
    recipe.standardBatchQuantity = batch.quantity;
    recipe.standardBatchUnit = batch.unit;
    recipe.batchSize = `${batch.quantity} ${unitLabel(batch.unit)}`;
    recipe.portionLabel =
      batch.unit === "stuk" ? "per stuk" : `per ${unitLabel(batch.unit)}`;
  }

  sheet.rows.forEach((row) => {
    const cells = row.map(cleanCell).filter(Boolean);
    if (!cells.length) return;

    const line = cells.join(" ");
    const nextSection = classifyRecipeSection(line);

    if (nextSection !== "unknown") {
      section = nextSection;

      const afterColon = line.split(/[:=-]/).slice(1).join(" ").trim();
      if (afterColon && section === "allergens") {
        recipe.allergens = Array.from(
          new Set([...recipe.allergens, ...parseList(afterColon)])
        );
      } else if (afterColon && section === "notes") {
        recipe.internalNotes = recipe.internalNotes
          ? `${recipe.internalNotes}\n${afterColon}`
          : afterColon;
      }

      return;
    }

    if (section === "allergens") {
      recipe.allergens = Array.from(
        new Set([...recipe.allergens, ...parseList(line)])
      );
      sawLikelyRecipeData = true;
      return;
    }

    if (section === "notes") {
      const note = cleanRecipeLine(line);
      if (note && !LOOSE_INGREDIENT_NOISE.test(note)) {
        recipe.internalNotes = recipe.internalNotes
          ? `${recipe.internalNotes}\n${note}`
          : note;
        sawLikelyRecipeData = true;
      }
      return;
    }

    const ingredientCandidate = parseLooseIngredientRow(row, section);
    const matchedLooseIngredient = ingredientCandidate
      ? findMatchingIngredient(ingredientCandidate.name, ingredients)
      : undefined;
    if (
      ingredientCandidate &&
      (section === "ingredients" || matchedLooseIngredient)
    ) {
      addLooseIngredientCandidate(
        recipe,
        ingredientCandidate,
        ingredients,
        warnings,
        unmatched,
        missingIngredientContext
      );
      sawLikelyRecipeData = true;
      return;
    }

    const instruction = cleanRecipeLine(line);
    if (section === "steps" && instruction && !isLikelySectionHeading(instruction)) {
      recipe.preparationSteps.push(instruction);
      sawLikelyRecipeData = true;
      return;
    }

    if (
      section === "finishing" &&
      instruction &&
      !isLikelySectionHeading(instruction)
    ) {
      recipe.finishingSteps = [...(recipe.finishingSteps || []), instruction];
      sawLikelyRecipeData = true;
      return;
    }

    if (section === "unknown" && isLikelyInstructionLine(instruction)) {
      recipe.preparationSteps.push(instruction);
      sawLikelyRecipeData = true;
    }
  });

  recipe.preparationSteps = Array.from(new Set(recipe.preparationSteps));
  recipe.finishingSteps = Array.from(new Set(recipe.finishingSteps || []));
  applyLooseNotes(recipe, unmatched);

  if (
    !sawLikelyRecipeData &&
    !recipe.ingredients.length &&
    !recipe.preparationSteps.length &&
    !recipe.internalNotes
  ) {
    return { recipe: null, warnings };
  }

  if (!recipe.ingredients.length && unmatched.length) {
    pushWarning(
      warnings,
      "Ik zag wel grondstofregels, maar kon ze nog niet koppelen aan de grondstoffenlijst."
    );
  }

  return { recipe, warnings };
}

function parseLooseRecipeSheets(
  sheets: ParsedSheet[],
  ingredients: Ingredient[],
  fileName: string,
  missingIngredientContext?: MissingIngredientContext
) {
  const ids = new Set<string>();
  const recipes: Recipe[] = [];
  const warnings: string[] = [];

  sheets.forEach((sheet) => {
    const parsed = parseLooseRecipeSheet(
      sheet,
      ingredients,
      fileName,
      ids,
      missingIngredientContext
    );
    parsed.warnings.forEach((warning) => pushWarning(warnings, warning));

    if (parsed.recipe) {
      recipes.push(parsed.recipe);
    }
  });

  return {
    recipes: recipes.slice(0, MAX_IMPORT_RECIPES),
    warnings,
  };
}

function recipeHasImportContent(recipe: Recipe) {
  return Boolean(
    recipe.ingredients.length ||
      recipe.preparationSteps.length ||
      recipe.finishingSteps?.length ||
      recipe.internalNotes
  );
}

function parseTextRecipe(
  text: string,
  ingredients: Ingredient[],
  fileName: string,
  missingIngredientContext?: MissingIngredientContext
) {
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
      const matchedIngredient =
        findMatchingIngredient(ingredientName, ingredients) ||
        (missingIngredientContext
          ? getOrCreateMissingIngredient(
              ingredientName,
              unit,
              missingIngredientContext
            )
          : undefined);

      if (matchedIngredient) {
        recipe.ingredients.push({
          ingredientId: matchedIngredient.id,
          quantity,
          unit,
          costContribution: 0,
        });
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

async function rowsAndTextFromFile(
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<FileTextRows> {
  const extension = getExtension(fileName);
  const warnings: string[] = [];

  if (["xlsx", "xls"].includes(extension)) {
    const sheets = parseWorkbookSheets(buffer, warnings);
    const rows = limitRows(
      sheets.flatMap((sheet) => sheet.rows),
      warnings
    );
    const text = limitText(sheets.map((sheet) => sheet.text).join("\n"), warnings);

    return { rows, text, sheets, warnings };
  }

  if (["csv", "txt", "tsv"].includes(extension) || mimeType.includes("csv")) {
    const text = limitText(buffer.toString("utf8"), warnings);
    const rows = limitRows(parseCsvRows(text), warnings);

    return {
      rows,
      text,
      sheets: [
        {
          name: fileName.replace(/\.[^.]+$/, ""),
          rows,
          text,
        },
      ],
      warnings,
    };
  }

  if (extension === "pdf" || mimeType.includes("pdf")) {
    const text = limitText(await extractPdfText(buffer), warnings);
    const rows = limitRows(
      compactTextLines(text).map((line) => line.split(/\t|;|\s{2,}/)),
      warnings
    );

    return {
      rows,
      text,
      sheets: [
        {
          name: fileName.replace(/\.[^.]+$/, ""),
          rows,
          text,
        },
      ],
      warnings,
    };
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
  const { rows, text, sheets, warnings: fileWarnings } =
    await rowsAndTextFromFile(fileName, mimeType, buffer);

  if (kind === "ingredients") {
    const parsed = parseIngredientRows(rows);
    if (!parsed.ingredients.length) {
      throw new Error("Geen grondstoffen herkend. Controleer de kolomnamen.");
    }

    return {
      ingredients: parsed.ingredients,
      warnings: [...fileWarnings, ...parsed.warnings],
      message: `${parsed.ingredients.length} grondstoffen herkend.`,
    };
  }

  const createdIngredients: Ingredient[] = [];
  const missingIngredientContext: MissingIngredientContext = {
    availableIngredients: ingredients,
    createdIngredients,
    existingIds: new Set(ingredients.map((ingredient) => ingredient.id)),
    warnings: [],
  };
  const parsedRows = parseRecipeRows(
    rows,
    ingredients,
    fileName,
    missingIngredientContext
  );
  const parsedLoose = parsedRows.recipes.some(recipeHasImportContent)
    ? parsedRows
    : parseLooseRecipeSheets(
        sheets,
        ingredients,
        fileName,
        missingIngredientContext
      );
  const parsedText = parsedLoose.recipes.some(recipeHasImportContent)
    ? parsedLoose
    : parseTextRecipe(text, ingredients, fileName, missingIngredientContext);
  const recipes = parsedText.recipes.filter(recipeHasImportContent);

  if (!recipes.length) {
    throw new Error(
      "Geen recepten herkend. Probeer een Excel/PDF met receptnaam, grondstoffen of bereidingsregels."
    );
  }

  return {
    ingredients: createdIngredients,
    recipes: recipes.slice(0, MAX_IMPORT_RECIPES),
    warnings: [
      ...fileWarnings,
      ...missingIngredientContext.warnings,
      ...parsedText.warnings,
    ].slice(0, MAX_IMPORT_WARNINGS),
    message: `${Math.min(recipes.length, MAX_IMPORT_RECIPES)} recept${
      Math.min(recipes.length, MAX_IMPORT_RECIPES) === 1 ? "" : "en"
    } herkend${
      createdIngredients.length
        ? ` en ${createdIngredients.length} nieuwe grondstof${
            createdIngredients.length === 1 ? "" : "fen"
          } aangemaakt`
        : ""
    }. Het originele bestand is niet opgeslagen.`,
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
