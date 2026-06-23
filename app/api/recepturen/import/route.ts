import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type {
  Ingredient,
  InvoiceImport,
  InvoiceLine,
} from "@/app/bakkerij/recepturen/types";
import {
  ingredientPackagePrice,
  normalizeSearch,
} from "@/app/bakkerij/recepturen/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type ColumnMap = {
  articleNumber?: number;
  description?: number;
  quantity?: number;
  unit?: number;
  totalPrice?: number;
  pricePerUnit?: number;
  pricePerUnitKind?: PricePerUnitKind;
};

type PricePerUnitKind = "base" | "package";

type LooseNumberMatch = {
  raw: string;
  value: number;
  index: number;
  end: number;
};

type BekoRawLine = {
  articleNumber: string;
  priceUnit: string;
  description: string;
  totalPrice: number;
  bekoPrice: number;
  contentAmount: number;
  quantity: number;
  quantityUnit: string;
};

type SupplierLineInput = {
  articleNumber: string;
  description: string;
  quantity: number;
  unit: string;
  totalPrice: number;
  unitPrice: number;
  priceKind?: PricePerUnitKind;
  packageSizeHint?: string;
};

type ExtractedInvoice = {
  invoice: InvoiceImport;
  warnings: string[];
};

type UploadedFile = File & {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
};

type CanvasPolyfillModule = typeof import("@napi-rs/canvas") & {
  default?: Partial<typeof import("@napi-rs/canvas")>;
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_OCR_PDF_PAGES = 3;
const MAX_INVOICE_LINES = 600;
const TESSERACT_CACHE_PATH = path.join(tmpdir(), "strik-tesseract");

function resolveTesseractWorkerPath() {
  const relativePath = "node_modules/tesseract.js/src/worker-script/node/index.js";
  const candidates = [
    path.join(process.cwd(), relativePath),
    path.join(process.cwd(), "..", relativePath),
  ];

  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}

const TESSERACT_WORKER_PATH = resolveTesseractWorkerPath();

const ARTICLE_HEADERS = [
  "artikelnummer",
  "artikel nr",
  "artikelnr",
  "artikelcode",
  "art nr",
  "art",
  "nummer",
  "productcode",
  "product code",
  "code",
  "item",
];
const DESCRIPTION_HEADERS = [
  "omschrijving",
  "artikelomschrijving",
  "artikel",
  "product",
  "productnaam",
  "naam",
  "description",
];
const QUANTITY_HEADERS = [
  "aantal",
  "hoeveelheid",
  "besteld",
  "geleverd",
  "qty",
  "quantity",
];
const UNIT_HEADERS = ["eenheid", "eh", "unit", "verpakking", "verp"];
const TOTAL_HEADERS = [
  "totaalprijs",
  "totaal prijs",
  "totaal",
  "bedrag",
  "regelbedrag",
  "regel bedrag",
  "netto bedrag",
  "bedrag excl",
  "excl btw",
  "waarde",
];
const BASE_UNIT_PRICE_HEADERS = [
  "prijs per kg",
  "prijs/kg",
  "euro per kg",
  "eur per kg",
  "eur/kg",
  "prijs per kilo",
  "prijs per liter",
  "prijs/l",
  "eur/l",
  "kg prijs",
  "kiloprijs",
  "literprijs",
];
const PACKAGE_UNIT_PRICE_HEADERS = [
  "prijs per eenheid",
  "prijs per stuk",
  "eenheidsprijs",
  "nettoprijs",
  "netto prijs",
  "stuksprijs",
  "prijs",
];
const UNIT_PATTERN =
  /\b(kg|kilo|kilogram|g|gr|gram|l|li|ltr|liter|ml|st|stuks|stuk|doos|zak|pak|tray|emmer)\b/i;

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

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function isImageUpload(file: UploadedFile) {
  const extension = getExtension(file.name);

  return (
    file.type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "tif", "tiff"].includes(extension)
  );
}

function parseIngredients(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as Ingredient[]) : [];
  } catch {
    return [];
  }
}

function parseDutchNumber(value: unknown) {
  let trimmed = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/€|\u00a0/g, "");

  if (!trimmed) return 0;

  if (trimmed.endsWith("-") && !trimmed.startsWith("-")) {
    trimmed = `-${trimmed.slice(0, -1)}`;
  }

  const normalized =
    trimmed.includes(",") && trimmed.includes(".")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(",", ".");
  const number = Number.parseFloat(normalized.replace(/[^\d.-]/g, ""));

  return Number.isFinite(number) ? number : 0;
}

function numbersAreClose(left: number, right: number) {
  return Math.abs(left - right) < 0.01;
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

function findHeaderIndex(
  headers: string[],
  options: string[],
  excludedIndexes: number[] = []
) {
  const normalizedOptions = options.map(normalizeHeader);

  return headers.findIndex(
    (header, index) =>
      !excludedIndexes.includes(index) &&
      normalizedOptions.some((option) => headerMatches(header, option))
  );
}

function getColumnMap(headers: string[]): ColumnMap {
  const normalizedHeaders = headers.map(normalizeHeader);
  const totalPrice = findHeaderIndex(normalizedHeaders, TOTAL_HEADERS);
  const baseUnitPrice = findHeaderIndex(
    normalizedHeaders,
    BASE_UNIT_PRICE_HEADERS,
    totalPrice >= 0 ? [totalPrice] : []
  );
  const packageUnitPrice =
    baseUnitPrice >= 0
      ? -1
      : findHeaderIndex(
          normalizedHeaders,
          PACKAGE_UNIT_PRICE_HEADERS,
          totalPrice >= 0 ? [totalPrice] : []
        );
  const pricePerUnit = baseUnitPrice >= 0 ? baseUnitPrice : packageUnitPrice;
  const map: ColumnMap = {
    articleNumber: findHeaderIndex(normalizedHeaders, ARTICLE_HEADERS),
    description: findHeaderIndex(normalizedHeaders, DESCRIPTION_HEADERS),
    quantity: findHeaderIndex(normalizedHeaders, QUANTITY_HEADERS),
    unit: findHeaderIndex(normalizedHeaders, UNIT_HEADERS),
    totalPrice,
    pricePerUnit,
    pricePerUnitKind: baseUnitPrice >= 0 ? "base" : "package",
  };

  Object.entries(map).forEach(([key, value]) => {
    if (value === -1) delete map[key as keyof ColumnMap];
  });

  if (map.pricePerUnit === undefined) delete map.pricePerUnitKind;

  return map;
}

function hasUsefulColumns(map: ColumnMap) {
  return (
    map.description !== undefined &&
    (map.articleNumber !== undefined ||
      map.totalPrice !== undefined ||
      map.pricePerUnit !== undefined)
  );
}

function getCell(row: string[], index?: number) {
  return index === undefined ? "" : row[index] || "";
}

function cleanCell(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeUnit(unit: string, description = "") {
  const value = `${unit} ${description}`.toLowerCase();
  const match = value.match(UNIT_PATTERN);

  if (!match) return cleanCell(unit) || "kg";

  const found = match[1].toLowerCase();
  if (["kilo", "kilogram"].includes(found)) return "kg";
  if (["gr", "gram"].includes(found)) return "g";
  if (["li", "ltr", "liter"].includes(found)) return "l";
  if (["stuks", "stuk"].includes(found)) return "st";

  return found;
}

function normalizeBekoUnit(unit: string) {
  const upperUnit = unit.toUpperCase();

  if (upperUnit === "LT") return "l";
  if (upperUnit === "ST") return "st";
  if (upperUnit === "KG" || upperUnit === "HK") return "kg";

  return upperUnit.toLowerCase();
}

function isWeightIngredient(ingredient?: Ingredient) {
  return ingredient?.recipeUnit === "gram" || ingredient?.recipeUnit === "kg";
}

function isVolumeIngredient(ingredient?: Ingredient) {
  return ingredient?.recipeUnit === "ml" || ingredient?.recipeUnit === "liter";
}

function parsePackageSize(packageSize = "") {
  const normalized = packageSize.toLowerCase().replace(",", ".");
  const multiPack = normalized.match(
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|kilo|kilogram|g|gr|gram|l|li|ltr|liter|ml|st|stuks|stuk)\b/i
  );
  const direct =
    multiPack ||
    normalized.match(
      /(\d+(?:\.\d+)?)\s*(kg|kilo|kilogram|g|gr|gram|l|li|ltr|liter|ml|st|stuks|stuk)\b/i
    );

  if (!direct) return null;

  const amount = multiPack
    ? parseDutchNumber(direct[1]) * parseDutchNumber(direct[2])
    : parseDutchNumber(direct[1]);
  const unit = normalizeUnit(multiPack ? direct[3] : direct[2]);

  if (!amount) return null;
  if (unit === "g") return { amount: amount / 1000, unit: "kg" };
  if (unit === "ml") return { amount: amount / 1000, unit: "l" };

  return { amount, unit };
}

function normalizeArticleNumber(value: string) {
  return normalizeSearch(value).replace(/[^a-z0-9]/g, "").replace(/^0+/, "");
}

const MATCH_STOP_WORDS = new Set([
  "a",
  "bak",
  "beker",
  "blik",
  "bl",
  "can",
  "doos",
  "ds",
  "emmer",
  "fles",
  "g",
  "gr",
  "gram",
  "hk",
  "kg",
  "kilo",
  "kilogram",
  "l",
  "li",
  "liter",
  "ltr",
  "ml",
  "pak",
  "per",
  "st",
  "stuk",
  "stuks",
  "tray",
  "verpakt",
  "verse",
  "zak",
]);

const BROAD_SINGLE_MATCH_WORDS = new Set([
  "appel",
  "boter",
  "brood",
  "choco",
  "kaas",
  "melk",
  "room",
  "suiker",
]);

function matchTokens(value: string) {
  return normalizeSearch(value)
    .replace(/(\d+)(kg|g|gr|gram|l|li|ltr|liter|ml|st|stuk|stuks)\b/g, " ")
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !MATCH_STOP_WORDS.has(token));
}

function uniqueTokens(value: string) {
  return Array.from(new Set(matchTokens(value)));
}

function ingredientNameMatchScore(description: string, alias: string) {
  const descriptionTokens = uniqueTokens(description);
  const aliasTokens = uniqueTokens(alias);

  if (!descriptionTokens.length || !aliasTokens.length) return 0;

  const descriptionSet = new Set(descriptionTokens);
  const sharedTokens = aliasTokens.filter((token) => descriptionSet.has(token));
  if (!sharedTokens.length) return 0;

  if (aliasTokens.length === 1) {
    const [token] = aliasTokens;
    const exactDescription =
      descriptionTokens.length === 1 && descriptionTokens[0] === token;
    const distinctiveToken =
      token.length >= 6 && !BROAD_SINGLE_MATCH_WORDS.has(token);

    return exactDescription || distinctiveToken ? sharedTokens.length : 0;
  }

  const aliasCoverage = sharedTokens.length / aliasTokens.length;
  const descriptionCoverage = sharedTokens.length / descriptionTokens.length;

  if (
    sharedTokens.length >= 2 &&
    aliasCoverage >= 0.6 &&
    descriptionCoverage >= 0.45
  ) {
    return sharedTokens.length + aliasCoverage + descriptionCoverage;
  }

  return 0;
}

function findMatchingIngredient(
  articleNumber: string,
  description: string,
  ingredients: Ingredient[]
) {
  const normalizedArticleNumber = normalizeArticleNumber(articleNumber);
  const articleMatches = normalizedArticleNumber
    ? ingredients.filter(
        (ingredient) =>
          normalizeArticleNumber(ingredient.supplierArticleNumber) ===
          normalizedArticleNumber
      )
    : [];

  if (articleMatches.length === 1) return articleMatches[0];

  const candidates = (articleMatches.length ? articleMatches : ingredients)
    .map((ingredient) => {
      const bestNameScore = [ingredient.name, ...ingredient.aliases].reduce(
        (bestScore, alias) =>
          Math.max(bestScore, ingredientNameMatchScore(description, alias)),
        0
      );
      const articleScore = articleMatches.includes(ingredient) ? 100 : 0;

      return {
        ingredient,
        nameScore: bestNameScore,
        score: articleScore + bestNameScore,
      };
    })
    .filter((candidate) =>
      articleMatches.length > 1 ? candidate.nameScore > 0 : candidate.score > 0
    )
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) return undefined;

  return best.ingredient;
}

function getPercentageChange(oldPrice: number, newPrice: number) {
  if (!oldPrice) return 0;

  return ((newPrice - oldPrice) / oldPrice) * 100;
}

function hasMeaningfulPriceChange(oldPrice: number, newPrice: number) {
  if (!oldPrice) return true;

  const absoluteChange = Math.abs(newPrice - oldPrice);
  const percentageChange = Math.abs(getPercentageChange(oldPrice, newPrice));

  return absoluteChange >= 0.005 && percentageChange >= 0.1;
}

function reviewStatusForPrice(
  oldPrice: number,
  newPrice: number,
  isMatched: boolean
) {
  if (!isMatched) return "pending" as const;

  return hasMeaningfulPriceChange(oldPrice, newPrice) ? "pending" as const : "ignored" as const;
}

function priceForIngredientUnit(
  pricePerUnit: number,
  unit: string,
  ingredient?: Ingredient,
  priceKind: PricePerUnitKind = "package",
  fallbackPackageSize = ""
) {
  if (!pricePerUnit) return 0;

  const normalizedUnit = normalizeUnit(unit);
  const recipeUnit = ingredient?.recipeUnit;
  const hasWeightIngredient = recipeUnit === "gram" || recipeUnit === "kg";
  const hasVolumeIngredient = recipeUnit === "ml" || recipeUnit === "liter";
  const packageSize =
    parsePackageSize(fallbackPackageSize) ||
    (ingredient ? parsePackageSize(ingredient.packageSize) : null);

  if (priceKind === "base") return pricePerUnit;

  if (
    packageSize &&
    [
      "st",
      "doos",
      "zak",
      "pak",
      "tray",
      "emmer",
      "ds",
      "bl",
      "bs",
      "rl",
      "fl",
      "cn",
      "pk",
      "em",
      "kt",
      "ka",
      "ei",
      "pg",
    ].includes(normalizedUnit)
  ) {
    if (hasWeightIngredient && packageSize.unit === "kg") {
      return pricePerUnit / packageSize.amount;
    }

    if (hasVolumeIngredient && packageSize.unit === "l") {
      return pricePerUnit / packageSize.amount;
    }

    if (recipeUnit === "stuk" && packageSize.unit === "st") {
      return pricePerUnit / packageSize.amount;
    }
  }

  if (normalizedUnit === "g" && hasWeightIngredient) return pricePerUnit * 1000;
  if (normalizedUnit === "ml" && hasVolumeIngredient) return pricePerUnit * 1000;

  return pricePerUnit;
}

function createSupplierInvoiceLine(
  input: SupplierLineInput,
  ingredients: Ingredient[]
): InvoiceLine | null {
  if (!input.articleNumber && !input.description) return null;
  if (!input.unitPrice && !input.totalPrice) return null;

  const matchedIngredient = findMatchingIngredient(
    input.articleNumber,
    input.description,
    ingredients
  );
  const priceKind = input.priceKind || "package";
  const packageSizeHint = input.packageSizeHint || input.description;
  const packageSize =
    parsePackageSize(packageSizeHint) ||
    (matchedIngredient ? parsePackageSize(matchedIngredient.packageSize) : null);
  const normalizedUnit = normalizeUnit(input.unit, input.description);
  const wantsWeight = isWeightIngredient(matchedIngredient);
  const wantsVolume = isVolumeIngredient(matchedIngredient);
  const desiredPackageUnit = wantsVolume ? "l" : wantsWeight ? "kg" : "";

  let quantity = input.quantity || 1;
  let unit = normalizedUnit;
  let pricePerUnit = input.unitPrice || (quantity ? input.totalPrice / quantity : 0);
  let totalPrice = input.totalPrice || pricePerUnit * quantity;

  if (priceKind === "base") {
    unit = desiredPackageUnit || normalizedUnit;
  } else if (
    matchedIngredient &&
    packageSize &&
    desiredPackageUnit &&
    packageSize.unit === desiredPackageUnit &&
    !["kg", "g", "l", "ml"].includes(normalizedUnit)
  ) {
    pricePerUnit = pricePerUnit / packageSize.amount;
    quantity = quantity * packageSize.amount;
    unit = desiredPackageUnit;
    totalPrice = input.totalPrice || pricePerUnit * quantity;
  } else {
    pricePerUnit = priceForIngredientUnit(
      pricePerUnit,
      input.unit,
      matchedIngredient,
      priceKind,
      packageSizeHint
    );

    if (wantsWeight && normalizedUnit === "g") unit = "kg";
    if (wantsVolume && normalizedUnit === "ml") unit = "l";
  }

  if (!pricePerUnit) return null;

  const oldPrice = matchedIngredient ? ingredientPackagePrice(matchedIngredient) : 0;

  return {
    articleNumber: input.articleNumber,
    description: cleanCell(input.description),
    quantity,
    unit,
    totalPrice,
    pricePerUnit,
    matchedIngredientId: matchedIngredient?.id,
    oldPrice,
    newPrice: pricePerUnit,
    percentageChange: getPercentageChange(oldPrice, pricePerUnit),
    reviewStatus: reviewStatusForPrice(
      oldPrice,
      pricePerUnit,
      Boolean(matchedIngredient)
    ),
  };
}

function createInvoiceLine(
  row: string[],
  map: ColumnMap,
  ingredients: Ingredient[]
): InvoiceLine | null {
  const articleNumber = cleanCell(getCell(row, map.articleNumber));
  const description = cleanCell(getCell(row, map.description));
  if (!articleNumber && !description) return null;

  const quantity = parseDutchNumber(getCell(row, map.quantity)) || 1;
  const unit = normalizeUnit(getCell(row, map.unit), description);
  const totalPrice = parseDutchNumber(getCell(row, map.totalPrice));
  const explicitUnitPrice = parseDutchNumber(getCell(row, map.pricePerUnit));
  const rawPricePerUnit =
    explicitUnitPrice || (quantity && totalPrice ? totalPrice / quantity : 0);
  const matchedIngredient = findMatchingIngredient(
    articleNumber,
    description,
    ingredients
  );
  const pricePerUnit = priceForIngredientUnit(
    rawPricePerUnit || totalPrice,
    unit,
    matchedIngredient,
    explicitUnitPrice ? map.pricePerUnitKind || "package" : "package",
    description
  );
  const oldPrice = matchedIngredient ? ingredientPackagePrice(matchedIngredient) : 0;

  if (!pricePerUnit) return null;

  return {
    articleNumber,
    description,
    quantity,
    unit,
    totalPrice: totalPrice || pricePerUnit * quantity,
    pricePerUnit,
    matchedIngredientId: matchedIngredient?.id,
    oldPrice,
    newPrice: pricePerUnit,
    percentageChange: getPercentageChange(oldPrice, pricePerUnit),
    reviewStatus: reviewStatusForPrice(
      oldPrice,
      pricePerUnit,
      Boolean(matchedIngredient)
    ),
  };
}

function parseTabularRows(
  rows: string[][],
  ingredients: Ingredient[]
): InvoiceLine[] {
  const cleanRows = rows
    .map((row) => row.map(cleanCell))
    .filter((row) => row.some(Boolean));
  const headerIndex = cleanRows.findIndex((row) =>
    hasUsefulColumns(getColumnMap(row))
  );

  if (headerIndex === -1) return [];

  const map = getColumnMap(cleanRows[headerIndex]);

  return cleanRows
    .slice(headerIndex + 1)
    .map((row) => createInvoiceLine(row, map, ingredients))
    .filter((line): line is InvoiceLine => Boolean(line));
}

function isBekoInvoiceText(fileName: string, text: string) {
  return (
    detectSupplier(fileName, text) === "Beko" &&
    /Art\.nr\.\s+KG/i.test(text) &&
    /Bruto\s+Prijs/i.test(text)
  );
}

function parseBekoArticleCell(cell: string) {
  const match = cleanCell(cell).match(/^(\d{5,8})\s+([A-Z]{2})\s+(.+)$/);
  if (!match) return null;

  return {
    articleNumber: match[1],
    priceUnit: match[2].toUpperCase(),
    description: cleanCell(match[3]),
  };
}

function parseBekoQuantityCell(cell = "") {
  const match = cleanCell(cell).match(/(-?\d+(?:[.,]\d+)?-?)\s*([A-Z]{1,3})\b/i);

  return {
    quantity: match ? parseDutchNumber(match[1]) : 0,
    quantityUnit: match ? match[2].toUpperCase() : "",
  };
}

function bekoQuantityCellIndex(cells: string[]) {
  for (let index = cells.length - 2; index >= 4; index -= 1) {
    if (/\d/.test(cells[index]) && /\b[A-Z]{1,3}\b/i.test(cells[index])) {
      return index;
    }
  }

  return -1;
}

function isBekoContinuationLine(line: string) {
  return (
    line !== "" &&
    !line.includes("\t") &&
    !line.includes(":") &&
    !/^(-{3}|DC Beko|Weeknr|Beko Groothandel|BONNUMMER|Aantal\b|Totaal\b|BTW\b|Bedrag\b)/i.test(line) &&
    !/^\d{5,8}\s+[A-Z]{2}\b/.test(line)
  );
}

function parseBekoRawLines(text: string) {
  const rows: BekoRawLine[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const cells = line.split("\t").map(cleanCell);
    const article = parseBekoArticleCell(cells[0] || "");

    if (!article) {
      if (rows.length && isBekoContinuationLine(line)) {
        rows[rows.length - 1].description = cleanCell(
          `${rows[rows.length - 1].description} ${line}`
        );
      }

      continue;
    }

    const quantityIndex = bekoQuantityCellIndex(cells);
    const quantityInfo =
      quantityIndex >= 0 ? parseBekoQuantityCell(cells[quantityIndex]) : null;
    const contentAmount =
      quantityIndex > 0 ? parseDutchNumber(cells[quantityIndex - 1]) : 0;
    const totalPrice = parseDutchNumber(cells[2]);
    const bekoPrice = parseDutchNumber(cells[3]);

    if (totalPrice <= 0 || bekoPrice <= 0) continue;

    rows.push({
      ...article,
      totalPrice,
      bekoPrice,
      contentAmount,
      quantity: Math.abs(quantityInfo?.quantity || 1),
      quantityUnit: quantityInfo?.quantityUnit || article.priceUnit,
    });
  }

  return rows;
}

function createBekoInvoiceLine(
  row: BekoRawLine,
  ingredients: Ingredient[]
): InvoiceLine | null {
  const matchedIngredient = findMatchingIngredient(
    row.articleNumber,
    row.description,
    ingredients
  );
  let unit = normalizeBekoUnit(row.quantityUnit || row.priceUnit);
  let quantity = row.quantity || 1;
  let pricePerUnit = row.bekoPrice;

  if (
    matchedIngredient &&
    row.contentAmount > 0 &&
    (isWeightIngredient(matchedIngredient) || isVolumeIngredient(matchedIngredient))
  ) {
    pricePerUnit = row.totalPrice / row.contentAmount;
    quantity = row.contentAmount;
    unit = isVolumeIngredient(matchedIngredient) ? "l" : "kg";
  } else if (row.priceUnit === "HK") {
    pricePerUnit = row.bekoPrice / 100;
    quantity = row.quantity * 100;
    unit = "kg";
  } else if (["KG", "LT", "ST"].includes(row.priceUnit)) {
    unit = normalizeBekoUnit(row.priceUnit);
  } else {
    pricePerUnit = priceForIngredientUnit(
      row.bekoPrice,
      normalizeBekoUnit(row.priceUnit),
      matchedIngredient,
      "package",
      row.description
    );
  }

  if (!pricePerUnit) return null;

  const oldPrice = matchedIngredient ? ingredientPackagePrice(matchedIngredient) : 0;

  return {
    articleNumber: row.articleNumber,
    description: row.description,
    quantity,
    unit,
    totalPrice: row.totalPrice,
    pricePerUnit,
    matchedIngredientId: matchedIngredient?.id,
    oldPrice,
    newPrice: pricePerUnit,
    percentageChange: getPercentageChange(oldPrice, pricePerUnit),
    reviewStatus: reviewStatusForPrice(
      oldPrice,
      pricePerUnit,
      Boolean(matchedIngredient)
    ),
  };
}

function parseBekoPdfLines(text: string, ingredients: Ingredient[]) {
  return parseBekoRawLines(text)
    .map((row) => createBekoInvoiceLine(row, ingredients))
    .filter((line): line is InvoiceLine => Boolean(line));
}

function isZeelandiaInvoiceText(fileName: string, text: string) {
  return (
    detectSupplier(fileName, text) === "Zeelandia" &&
    /Artikelnr\.\s+Artikelnaam/i.test(text) &&
    /Prijs\/\s*eenheid/i.test(text)
  );
}

function parseZeelandiaPdfLines(text: string, ingredients: Ingredient[]) {
  return compactTextLines(text)
    .map((line) => {
      const match = line.match(
        /^(\d{6,})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Z]+)\s+(\d+(?:[.,]\d+)?)\s+(KG|L|LI|ST)\s+(\d+(?:[.,]\d+)?)\s+(KG|L|LI|ST)\s+(\d+(?:[.,]\d+)?)\s+p\/(KG|L|LI|ST)\s+(-?\d+(?:[.,]\d+)?)\s+(-?\d+(?:[.,]\d+)?)\s+\d+%$/i
      );

      if (!match) return null;

      const totalQuantity = parseDutchNumber(match[7]);
      const unit = normalizeUnit(match[8]);
      const unitPrice = parseDutchNumber(match[9]);
      const totalPrice = parseDutchNumber(match[12]);

      if (totalQuantity <= 0 || unitPrice <= 0 || totalPrice <= 0) {
        return null;
      }

      return createSupplierInvoiceLine(
        {
          articleNumber: match[1],
          description: match[2],
          quantity: totalQuantity,
          unit,
          totalPrice,
          unitPrice,
          priceKind: "base",
          packageSizeHint: `${match[5]} ${match[6]}`,
        },
        ingredients
      );
    })
    .filter((line): line is InvoiceLine => Boolean(line));
}

function isRoelofsenInvoiceText(fileName: string, text: string) {
  return (
    detectSupplier(fileName, text) === "Roelofsen" &&
    /Roelofsen\s+AGF/i.test(text) &&
    /Artikelnr\.\s+Omschrijving\s+Eenheid/i.test(text)
  );
}

function shouldSkipSupplierDescription(description: string) {
  return /\b(backorder|emballage|ret\.?-?emb|klapkrat|statiegeld)\b/i.test(
    description
  );
}

function parseRoelofsenPdfLines(text: string, ingredients: Ingredient[]) {
  return compactTextLines(text)
    .map((line) => {
      const match = line.match(
        /^(\d{3,})\s+(.+?)\s+(kg|stuk)\s+(-?\d+(?:[.,]\d+)?)\s+(-?\d+(?:[.,]\d+)?)\s+(-?\d+(?:[.,]\d+)?-?)\s+\d+(?:[.,]\d+)?%$/i
      );

      if (!match) return null;

      const description = cleanCell(match[2]);
      const quantity = parseDutchNumber(match[4]);
      const unitPrice = parseDutchNumber(match[5]);
      const totalPrice = parseDutchNumber(match[6]);

      if (
        shouldSkipSupplierDescription(description) ||
        quantity <= 0 ||
        unitPrice <= 0 ||
        totalPrice <= 0
      ) {
        return null;
      }

      return createSupplierInvoiceLine(
        {
          articleNumber: match[1],
          description,
          quantity,
          unit: match[3],
          totalPrice,
          unitPrice,
          priceKind: "package",
          packageSizeHint: description,
        },
        ingredients
      );
    })
    .filter((line): line is InvoiceLine => Boolean(line));
}

function isFruitOpMaatInvoiceText(fileName: string, text: string) {
  return (
    detectSupplier(fileName, text) === "Roelofs Fruit op Maat" &&
    /FRUIT\s+OP\s+MAAT/i.test(text) &&
    /Datum\s+Artikel\s+nr\.\s+Artikel/i.test(text)
  );
}

function parseFruitOpMaatPdfLines(text: string, ingredients: Ingredient[]) {
  return text
    .split(/\r?\n/)
    .map((rawLine) => rawLine.trim())
    .map((line) => {
      const cells = line.split("\t").map(cleanCell);
      if (cells.length < 4) return null;

      const dateAndPackages = cells[0].match(
        /^\d{1,2}-\d{1,2}-\d{4}\s+(-?\d+(?:[.,]\d+)?)$/
      );
      const descriptionAndPrices = cells[1].match(
        /^(.+?)\s+€\s*(-?\d[\d.,]*)\s+€\s*(-?\d[\d.,-]*)$/
      );
      const article = cells[2].match(/^(\d{2,})\b/);
      const weight = cells[3].match(/(-?\d+(?:[.,]\d+)?)\s*(KG|L|LI|ST)\b/i);

      if (!dateAndPackages || !descriptionAndPrices || !article || !weight) {
        return null;
      }

      const description = cleanCell(descriptionAndPrices[1]);
      const quantity = parseDutchNumber(weight[1]);
      const unit = normalizeUnit(weight[2]);
      const totalPrice = parseDutchNumber(descriptionAndPrices[3]);

      if (
        shouldSkipSupplierDescription(description) ||
        quantity <= 0 ||
        totalPrice <= 0
      ) {
        return null;
      }

      return createSupplierInvoiceLine(
        {
          articleNumber: article[1],
          description,
          quantity,
          unit,
          totalPrice,
          unitPrice: totalPrice / quantity,
          priceKind: "base",
          packageSizeHint: description,
        },
        ingredients
      );
    })
    .filter((line): line is InvoiceLine => Boolean(line));
}

function isHefeInvoiceText(fileName: string, text: string) {
  if (detectSupplier(fileName, text) !== "Hefe van Haag") return false;

  return /RECHNUNG\s+R-|Rechnungsnummer|Artikel-Nr|Bezeichnung|LS-Nummer|Warentarif-Nr/i.test(
    text
  );
}

function normalizeHefeUnit(unit: string) {
  const normalized = cleanCell(unit).toUpperCase().replace(/\s+/g, " ");

  if (/^(LI|L|UL|UI)$/.test(normalized) || /\b(LI|L|UL|UI)\b/.test(normalized)) {
    return "l";
  }
  if (/\bKG\b/.test(normalized)) return "kg";
  if (/^(ST|U)$/.test(normalized) || /\bST\b/.test(normalized)) return "st";

  return normalized.toLowerCase();
}

function parseHefeNumber(value: string) {
  const normalized = cleanCell(value).replace(/^S$/i, "5");

  return parseDutchNumber(normalized);
}

function parseHefeUnitPrice(value: string) {
  const normalized = cleanCell(value);

  if (!normalized) return 0;
  if (/[,.]/.test(normalized)) return parseDutchNumber(normalized);
  if (/^\d{5,7}$/.test(normalized)) return Number(normalized) / 10000;

  return parseDutchNumber(normalized);
}

function parseHefeTotalPrice(value: string) {
  const normalized = cleanCell(value);

  if (!normalized) return 0;
  if (/[,.]/.test(normalized)) return parseDutchNumber(normalized);
  if (/^-?\d{3,}$/.test(normalized)) return Number(normalized) / 100;

  return parseDutchNumber(normalized);
}

function hefeUnitSegmentHasPackageAmount(unitSegment: string) {
  const normalized = cleanCell(unitSegment).toUpperCase();

  return /\d/.test(normalized) || /S\s*(KG|LI|L|UL|UI|ST|U)\b/.test(normalized);
}

function parseHefeTrailingMeasure(value: string) {
  const match = value.match(
    /\s(\d+(?:[.,]\d+)?|S)\s*(KG|LI|L|UL|UI|ST|U|KT|PG)$/i
  );
  if (!match || match.index === undefined) return null;

  return {
    quantity: parseHefeNumber(match[1]),
    unit: normalizeHefeUnit(match[2]),
    start: match.index,
    raw: match[0],
  };
}

function parseHefeCountAndUnit(value: string) {
  const compactWithTrailingQuantity = value.match(
    /\s(\d+(?:[.,]\d+)?)\s*([A-Z]{1,4}\s*\d+(?:[.,]\d+)?\s*(?:KG|LI|L|UL|UI|ST|U))\s+(\d+(?:[.,]\d+)?)$/i
  );

  if (compactWithTrailingQuantity?.index !== undefined) {
    return {
      quantity:
        parseDutchNumber(compactWithTrailingQuantity[3]) ||
        parseDutchNumber(compactWithTrailingQuantity[1]),
      unitSegment: cleanCell(compactWithTrailingQuantity[2]),
      description: cleanCell(value.slice(0, compactWithTrailingQuantity.index)),
    };
  }

  const match = value.match(
    /\s(\d+(?:[.,]\d+)?)\s*([A-Z]{1,4}\s*\d*(?:[.,]\d+)?\s*(?:KG|LI|L|UL|UI|ST|U)?(?:\s*\*)?(?:\s+\d+(?:[.,]\d+)?\s*(?:KG|LI|L|UL|UI|ST|U))?)$/i
  );

  if (!match || match.index === undefined) return null;

  return {
    quantity: parseDutchNumber(match[1]),
    unitSegment: cleanCell(match[2]),
    description: cleanCell(value.slice(0, match.index)),
  };
}

function correctedOcrTotal(totalPrice: number, expectedTotal: number) {
  if (!expectedTotal) return totalPrice;
  if (numbersAreClose(totalPrice, expectedTotal)) return totalPrice;

  return Math.round(expectedTotal * 100) / 100;
}

function hefeLineUsesBasePrice(unit: string) {
  return unit === "kg" || unit === "l";
}

function parseHefePdfLines(text: string, ingredients: Ingredient[]) {
  return compactTextLines(text)
    .map((line) => {
      if (!/^\d{4,7}\s/.test(line)) return null;

      const priceMatch = line.match(
        /\s(\d+(?:[.,]\d{2,4})|\d{5,7})\s+(-?\d[\d.,]*)(?:\s+[O0©\[\]]+)?$/i
      );
      if (!priceMatch || priceMatch.index === undefined) return null;

      const beforePrice = line.slice(0, priceMatch.index).trim();
      const article = beforePrice.match(/^(\d{4,7})\s+(.+)$/);
      if (!article) return null;

      let productPart = article[2];
      let content = parseHefeTrailingMeasure(productPart);
      let contentQuantity = 0;
      let contentUnit = "";
      let countInfo = content
        ? parseHefeCountAndUnit(productPart.slice(0, content.start))
        : null;

      if (content && countInfo) {
        contentQuantity = hefeUnitSegmentHasPackageAmount(countInfo.unitSegment)
          ? content.quantity
          : content.quantity * countInfo.quantity;
        contentUnit = content.unit;
        productPart = productPart.slice(0, content.start).trim();
      } else {
        content = null;
        countInfo = parseHefeCountAndUnit(productPart);
      }

      if (!countInfo) return null;

      const description = countInfo.description;
      const unitPrice = parseHefeUnitPrice(priceMatch[1]);
      const rawTotalPrice = parseHefeTotalPrice(priceMatch[2]);
      const quantity = contentQuantity || countInfo.quantity;
      const unit = contentUnit || normalizeHefeUnit(countInfo.unitSegment);
      const priceKind = hefeLineUsesBasePrice(unit) ? "base" : "package";
      const totalPrice = correctedOcrTotal(
        rawTotalPrice,
        unitPrice * (quantity || countInfo.quantity || 1)
      );

      if (
        shouldSkipSupplierDescription(description) ||
        quantity <= 0 ||
        unitPrice <= 0 ||
        totalPrice <= 0
      ) {
        return null;
      }

      return createSupplierInvoiceLine(
        {
          articleNumber: article[1],
          description,
          quantity,
          unit,
          totalPrice,
          unitPrice,
          priceKind,
          packageSizeHint: `${countInfo.unitSegment} ${description}`,
        },
        ingredients
      );
    })
    .filter((line): line is InvoiceLine => Boolean(line));
}

function parseKnownSupplierPdfLines(
  fileName: string,
  text: string,
  ingredients: Ingredient[]
) {
  if (isBekoInvoiceText(fileName, text)) return parseBekoPdfLines(text, ingredients);
  if (isZeelandiaInvoiceText(fileName, text)) {
    return parseZeelandiaPdfLines(text, ingredients);
  }
  if (isRoelofsenInvoiceText(fileName, text)) {
    return parseRoelofsenPdfLines(text, ingredients);
  }
  if (isFruitOpMaatInvoiceText(fileName, text)) {
    return parseFruitOpMaatPdfLines(text, ingredients);
  }
  if (isHefeInvoiceText(fileName, text)) return parseHefePdfLines(text, ingredients);

  return [];
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

function maybeParseDelimitedText(text: string, ingredients: Ingredient[]) {
  const delimiterRows = compactTextLines(text)
    .filter((line) => /[;\t|]/.test(line))
    .map((line) => line.split(/[;\t|]/).map(cleanCell));
  const delimiterLines = parseTabularRows(delimiterRows, ingredients);
  if (delimiterLines.length) return delimiterLines;

  const rows = parseCsvRows(text);
  const tabularLines = parseTabularRows(rows, ingredients);
  if (tabularLines.length) return tabularLines;

  const whitespaceRows = compactTextLines(text).map((line) => line.split(/\s{2,}|\t/));
  return parseTabularRows(whitespaceRows, ingredients);
}

function extractDate(text: string) {
  const match = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (!match) return new Date().toISOString().slice(0, 10);

  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;

  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractInvoiceNumber(text: string, fileName: string) {
  const bekoHeaderMatch = text.match(
    /\b\d{1,2}\s+\d{5,}\s+\d{2}[-/.]\d{2}[-/.]\d{4}\s+(\d{5,})\s+EUR\b/i
  );
  if (bekoHeaderMatch) return bekoHeaderMatch[1];

  const bekoFileMatch = fileName.match(/Factuur_Beko_(\d{5,})/i);
  if (bekoFileMatch) return bekoFileMatch[1];

  const roelofsenMatch = text.match(
    /Factuurnr\.\s+Factuurdatum\s+Debiteurennr\.\s+(\d{5,})/i
  );
  if (roelofsenMatch) return roelofsenMatch[1];

  const germanInvoiceMatch = text.match(
    /\bRechnungsnummer\s*[:#-]?\s*([A-Z]?-?\d{5,})/i
  );
  if (germanInvoiceMatch) return germanInvoiceMatch[1];

  const invoiceNumberMatch = text.match(/\bFactuurnummer\s+(\d{5,})/i);
  if (invoiceNumberMatch) return invoiceNumberMatch[1];

  const match = text.match(
    /\b(?:factuur(?:nummer)?|invoice|bon|document)\s*(?:nr\.?|nummer|no\.?)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9./-]{3,})/i
  );

  if (match) return match[1].replace(/[.,;:]$/, "");

  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function detectSupplier(fileName: string, text: string) {
  const haystack = normalizeSearch(`${fileName} ${text}`);
  if (haystack.includes("beko")) return "Beko";
  if (haystack.includes("zeelandia")) return "Zeelandia";
  if (haystack.includes("sligro")) return "Sligro";
  if (haystack.includes("roelofsen")) return "Roelofsen";
  if (haystack.includes("roelofs fruit") || haystack.includes("fruit op maat")) {
    return "Roelofs Fruit op Maat";
  }
  if (haystack.includes("hefe van haag") || haystack.includes("hefe")) {
    return "Hefe van Haag";
  }

  return "Onbekend";
}

function findLooseArticleNumber(line: string) {
  const match = line.match(/\b[A-Z]?\d{4,}[A-Z0-9-]*\b/i);
  return match ? match[0] : "";
}

function findLooseQuantity(line: string, articleEnd: number) {
  const textAfterArticle = line.slice(articleEnd);
  const quantityMatch = Array.from(
    textAfterArticle.matchAll(
      /(^|\s)(\d+(?:[.,]\d{1,3})?)\s*(kg|kilo|kilogram|g|gr|gram|l|li|ltr|liter|ml|st|stuks|stuk|doos|zak|pak|tray|emmer)\b/gi
    )
  ).at(-1);

  if (quantityMatch?.index !== undefined) {
    return {
      quantity: parseDutchNumber(quantityMatch[2]) || 1,
      unit: normalizeUnit(quantityMatch[3]),
      index: articleEnd + quantityMatch.index + quantityMatch[0].indexOf(quantityMatch[2]),
      end: articleEnd + quantityMatch.index + quantityMatch[0].length,
    };
  }

  return { quantity: 1, unit: "kg", index: -1, end: -1 };
}

function findLooseMoneyMatches(line: string, articleEnd: number) {
  return Array.from(
    line.matchAll(/(?:€\s*)?-?\d{1,5}(?:[.,]\d{2,4})/g),
    (match): LooseNumberMatch => ({
      raw: match[0],
      value: parseDutchNumber(match[0]),
      index: match.index || 0,
      end: (match.index || 0) + match[0].length,
    })
  ).filter((match) => {
    if (match.index < articleEnd) return false;
    if (!match.value) return false;

    const next = line.slice(match.end, match.end + 2);
    return !next.includes("%");
  });
}

function inferLoosePrices(
  priceMatches: LooseNumberMatch[],
  quantity: number
) {
  if (!priceMatches.length) return null;

  if (priceMatches.length === 1) {
    const totalPrice = priceMatches[0].value;

    return {
      totalPrice,
      packagePrice: quantity ? totalPrice / quantity : totalPrice,
    };
  }

  const penultimate = priceMatches[priceMatches.length - 2].value;
  const last = priceMatches[priceMatches.length - 1].value;

  if (quantity > 1 && numbersAreClose(penultimate / quantity, last)) {
    return { totalPrice: penultimate, packagePrice: last };
  }

  if (quantity > 1 && numbersAreClose(last / quantity, penultimate)) {
    return { totalPrice: last, packagePrice: penultimate };
  }

  return { totalPrice: last, packagePrice: penultimate };
}

function parseLooseInvoiceLines(text: string, ingredients: Ingredient[]) {
  return compactTextLines(text)
    .map((line) => {
      const articleNumber = findLooseArticleNumber(line);
      const articleIndex = line.indexOf(articleNumber);
      const articleEnd = articleIndex + articleNumber.length;

      if (!articleNumber) return null;

      const quantityMatch = findLooseQuantity(line, articleEnd);
      const priceMatches = findLooseMoneyMatches(line, articleEnd).filter(
        (match) =>
          quantityMatch.index === -1 ||
          match.end <= quantityMatch.index ||
          match.index >= quantityMatch.end
      );
      const prices = inferLoosePrices(priceMatches, quantityMatch.quantity);

      if (!prices) return null;

      const descriptionStart = articleEnd;
      const firstPriceIndex = priceMatches[0]?.index ?? -1;
      const descriptionEnd =
        quantityMatch.index > descriptionStart
          ? quantityMatch.index
          : firstPriceIndex > descriptionStart
            ? firstPriceIndex
            : undefined;
      const description =
        line
          .slice(descriptionStart, descriptionEnd)
          .replace(UNIT_PATTERN, "")
          .trim() || line.replace(articleNumber, "").trim();
      const row = [
        articleNumber,
        description,
        String(quantityMatch.quantity),
        quantityMatch.unit,
        String(prices.totalPrice),
        String(prices.packagePrice),
      ];

      return createInvoiceLine(
        row,
        {
          articleNumber: 0,
          description: 1,
          quantity: 2,
          unit: 3,
          totalPrice: 4,
          pricePerUnit: 5,
          pricePerUnitKind: "package",
        },
        ingredients
      );
    })
    .filter((line): line is InvoiceLine => Boolean(line));
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

async function extractTextWithOcr(image: Buffer) {
  const [text = ""] = await extractTextsWithOcr([image]);

  return text;
}

async function extractTextsWithOcr(images: Buffer[]) {
  if (!images.length) return [];

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    cachePath: TESSERACT_CACHE_PATH,
    workerPath: TESSERACT_WORKER_PATH,
  });
  const texts: string[] = [];

  try {
    for (const image of images) {
      const result = await worker.recognize(image);
      texts.push(result.data.text || "");
    }

    return texts;
  } finally {
    await worker.terminate();
  }
}

async function extractPdfEmbeddedImageText(buffer: Buffer) {
  await ensurePdfCanvasGlobals();

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const imageBuffers: Buffer[] = [];

  try {
    const imageResult = await parser.getImage({
      first: MAX_OCR_PDF_PAGES,
      imageBuffer: true,
      imageDataUrl: false,
      imageThreshold: 100,
    });

    for (const page of imageResult.pages) {
      for (const image of page.images) {
        if (image.data) {
          imageBuffers.push(Buffer.from(image.data));
        }
      }
    }
  } finally {
    await parser.destroy();
  }

  return (await extractTextsWithOcr(imageBuffers)).join("\n");
}

function hasInvoiceLikeText(text: string) {
  return (
    text.trim().length > 80 &&
    /artikel|rechnung|factuur|invoice|omschrijving|bezeichnung|preis|betrag|aantal|totaal/i.test(
      text
    )
  );
}

async function extractScannedPdfText(buffer: Buffer) {
  const embeddedImageText = await extractPdfEmbeddedImageText(buffer);

  if (hasInvoiceLikeText(embeddedImageText)) {
    return embeddedImageText;
  }

  await ensurePdfCanvasGlobals();

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const screenshotBuffers: Buffer[] = [];

  try {
    const screenshots = await parser.getScreenshot({
      first: MAX_OCR_PDF_PAGES,
      desiredWidth: 1800,
      imageBuffer: true,
      imageDataUrl: false,
    });

    for (const page of screenshots.pages) {
      screenshotBuffers.push(Buffer.from(page.data));
    }
  } catch {
    // Some scanned PDFs contain full-page embedded images that pdf.js cannot
    // render through canvas. Those can still be OCR'ed via getImage().
  } finally {
    await parser.destroy();
  }

  const screenshotText = (await extractTextsWithOcr(screenshotBuffers)).join("\n");
  if (screenshotText.trim()) return screenshotText;

  return embeddedImageText;
}

function createInvoice(
  lines: InvoiceLine[],
  fileName: string,
  text: string
): InvoiceImport {
  const id = `invoice-${Date.now()}`;

  return {
    id,
    supplier: detectSupplier(fileName, text),
    invoiceNumber: extractInvoiceNumber(text, fileName),
    invoiceDate: extractDate(text),
    uploadedAt: new Date().toLocaleString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    status: "review",
    lines: lines.map((line, index) => ({
      ...line,
      id: line.id || `${id}-line-${index + 1}`,
    })),
  };
}

function limitInvoiceLines(lines: InvoiceLine[], warnings: string[]) {
  if (lines.length <= MAX_INVOICE_LINES) return lines;

  warnings.push(
    `Er zijn ${lines.length} regels herkend. Alleen de eerste ${MAX_INVOICE_LINES} regels zijn meegenomen zodat de opslag klein blijft.`
  );

  return lines.slice(0, MAX_INVOICE_LINES);
}

async function parseInvoiceFile(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  ingredients: Ingredient[]
): Promise<ExtractedInvoice> {
  const extension = getExtension(fileName);
  const warnings: string[] = [];
  let text = "";
  let lines: InvoiceLine[] = [];

  if (["csv", "txt", "tsv"].includes(extension) || mimeType.includes("csv")) {
    text = buffer.toString("utf8");
    lines = maybeParseDelimitedText(text, ingredients);
  } else if (["xlsx", "xls"].includes(extension)) {
    const rows = parseWorkbookRows(buffer);
    text = rows.map((row) => row.join("\t")).join("\n");
    lines = parseTabularRows(rows, ingredients);
  } else if (extension === "pdf" || mimeType.includes("pdf")) {
    text = await extractPdfText(buffer);
    lines = parseKnownSupplierPdfLines(fileName, text, ingredients);

    if (!lines.length) {
      lines = maybeParseDelimitedText(text, ingredients);
    }

    if (!lines.length && text.trim()) {
      lines = parseLooseInvoiceLines(text, ingredients);
      if (lines.length) {
        warnings.push(
          "Kolommen waren niet exact herkenbaar; regels zijn met tekstherkenning ingeschat."
        );
      }
    }

    if (!lines.length) {
      warnings.push(
        text.trim()
          ? "Deze PDF kon niet als tekstfactuur worden gelezen. Ik heb OCR op de eerste pagina's geprobeerd."
          : "Deze PDF bevat weinig tekst. Ik heb OCR op de eerste pagina's geprobeerd."
      );
      const ocrText = await extractScannedPdfText(buffer);

      if (ocrText.trim()) {
        text = ocrText;
        lines = parseKnownSupplierPdfLines(fileName, text, ingredients);
      }

      if (!lines.length && text.trim()) {
        lines = maybeParseDelimitedText(text, ingredients);
      }
    }
  } else if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "tif", "tiff"].includes(extension)) {
    warnings.push("Afbeelding gelezen met OCR. Controleer de herkende regels extra goed.");
    text = await extractTextWithOcr(buffer);
    lines = parseKnownSupplierPdfLines(fileName, text, ingredients);

    if (!lines.length) {
      lines = maybeParseDelimitedText(text, ingredients);
    }
  } else {
    throw new Error("Bestandstype wordt nog niet ondersteund.");
  }

  if (!lines.length && text) {
    lines = parseLooseInvoiceLines(text, ingredients);
    if (lines.length) {
      warnings.push("Kolommen waren niet exact herkenbaar; regels zijn met tekstherkenning ingeschat.");
    }
  }

  if (!lines.length) {
    throw new Error(
      "Geen factuurregels herkend. Gebruik een bestand met artikelnummer, omschrijving, aantal, eenheid en prijs."
    );
  }

  lines = limitInvoiceLines(lines, warnings);

  return {
    invoice: createInvoice(lines, fileName, text),
    warnings,
  };
}

async function parseInvoiceImageFiles(
  files: UploadedFile[],
  buffers: Buffer[],
  ingredients: Ingredient[]
): Promise<ExtractedInvoice> {
  const warnings = [
    "Grote PDF is als losse pagina-afbeeldingen gelezen met OCR. Controleer de herkende regels extra goed.",
  ];
  const fileName = files[0]?.name || "factuur-afbeeldingen.jpg";
  let text = "";
  let lines: InvoiceLine[] = [];

  text = (await extractTextsWithOcr(buffers)).join("\n").trim();

  if (text.trim()) {
    lines = parseKnownSupplierPdfLines(fileName, text, ingredients);
  }

  if (!lines.length && text.trim()) {
    lines = maybeParseDelimitedText(text, ingredients);
  }

  if (!lines.length && text.trim()) {
    lines = parseLooseInvoiceLines(text, ingredients);
    if (lines.length) {
      warnings.push(
        "Kolommen waren niet exact herkenbaar; regels zijn met tekstherkenning ingeschat."
      );
    }
  }

  if (!lines.length) {
    throw new Error(
      "Geen factuurregels herkend. Gebruik een bestand met artikelnummer, omschrijving, aantal, eenheid en prijs."
    );
  }

  lines = limitInvoiceLines(lines, warnings);

  return {
    invoice: createInvoice(lines, fileName, text),
    warnings,
  };
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonError("Upload kon niet gelezen worden.");
  }

  let files = formData.getAll("files").filter(isUploadedFile);
  const legacyFile = formData.get("file");

  if (!files.length && isUploadedFile(legacyFile)) {
    files = [legacyFile];
  }

  if (!files.length) {
    return jsonError("Geen bestand ontvangen.");
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_FILE_BYTES) {
    return jsonError("Bestand is te groot. Upload maximaal 20 MB.", 413);
  }

  const ingredients = parseIngredients(formData.get("ingredients"));
  const buffers = await Promise.all(
    files.map(async (file) => Buffer.from(await file.arrayBuffer()))
  );

  try {
    const result =
      files.length > 1 && files.every(isImageUpload)
        ? await parseInvoiceImageFiles(files, buffers, ingredients)
        : await parseInvoiceFile(
            files[0].name,
            files[0].type || "",
            buffers[0],
            ingredients
          );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Factuur kon niet gelezen worden."
    );
  }
}
