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

type ColumnMap = {
  articleNumber?: number;
  description?: number;
  quantity?: number;
  unit?: number;
  totalPrice?: number;
  pricePerUnit?: number;
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

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_OCR_PDF_PAGES = 3;

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
const UNIT_PRICE_HEADERS = [
  "prijs per eenheid",
  "prijs per kg",
  "prijs per kilo",
  "prijs per stuk",
  "eenheidsprijs",
  "kg prijs",
  "kiloprijs",
  "nettoprijs",
  "netto prijs",
  "stuksprijs",
  "prijs",
];
const UNIT_PATTERN =
  /\b(kg|kilo|kilogram|g|gr|gram|l|ltr|liter|ml|st|stuks|stuk|doos|zak|pak|tray|emmer)\b/i;

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
  const trimmed = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/€|\u00a0/g, "");

  if (!trimmed) return 0;

  const normalized =
    trimmed.includes(",") && trimmed.includes(".")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(",", ".");
  const number = Number.parseFloat(normalized.replace(/[^\d.-]/g, ""));

  return Number.isFinite(number) ? number : 0;
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
  const pricePerUnit = findHeaderIndex(
    normalizedHeaders,
    UNIT_PRICE_HEADERS,
    totalPrice >= 0 ? [totalPrice] : []
  );
  const map: ColumnMap = {
    articleNumber: findHeaderIndex(normalizedHeaders, ARTICLE_HEADERS),
    description: findHeaderIndex(normalizedHeaders, DESCRIPTION_HEADERS),
    quantity: findHeaderIndex(normalizedHeaders, QUANTITY_HEADERS),
    unit: findHeaderIndex(normalizedHeaders, UNIT_HEADERS),
    totalPrice,
    pricePerUnit,
  };

  Object.entries(map).forEach(([key, value]) => {
    if (value === -1) delete map[key as keyof ColumnMap];
  });

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
  if (["ltr", "liter"].includes(found)) return "l";
  if (["stuks", "stuk"].includes(found)) return "st";

  return found;
}

function findMatchingIngredient(
  articleNumber: string,
  description: string,
  ingredients: Ingredient[]
) {
  const normalizedDescription = normalizeSearch(description);
  const normalizedArticleNumber = articleNumber.replace(/^0+/, "").trim();

  return ingredients.find((ingredient) => {
    const ingredientArticle = ingredient.supplierArticleNumber.trim();

    if (
      normalizedArticleNumber &&
      ingredientArticle.replace(/^0+/, "") === normalizedArticleNumber
    ) {
      return true;
    }

    return [ingredient.name, ...ingredient.aliases].some((alias) => {
      const normalizedAlias = normalizeSearch(alias);

      return (
        normalizedAlias &&
        normalizedDescription &&
        (normalizedDescription.includes(normalizedAlias) ||
          normalizedAlias.includes(normalizedDescription))
      );
    });
  });
}

function getPercentageChange(oldPrice: number, newPrice: number) {
  if (!oldPrice) return 0;

  return ((newPrice - oldPrice) / oldPrice) * 100;
}

function priceForIngredientUnit(
  pricePerUnit: number,
  unit: string,
  ingredient?: Ingredient
) {
  if (!pricePerUnit) return 0;

  const normalizedUnit = normalizeUnit(unit);
  const recipeUnit = ingredient?.recipeUnit;
  const isWeightIngredient = recipeUnit === "gram" || recipeUnit === "kg";
  const isVolumeIngredient = recipeUnit === "ml" || recipeUnit === "liter";

  if (normalizedUnit === "g" && isWeightIngredient) return pricePerUnit * 1000;
  if (normalizedUnit === "ml" && isVolumeIngredient) return pricePerUnit * 1000;

  return pricePerUnit;
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
    matchedIngredient
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
    reviewStatus: "pending",
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

  return "Onbekend";
}

function findLooseArticleNumber(line: string) {
  const match = line.match(/\b[A-Z]?\d{4,}[A-Z0-9-]*\b/i);
  return match ? match[0] : "";
}

function parseLooseInvoiceLines(text: string, ingredients: Ingredient[]) {
  return compactTextLines(text)
    .map((line) => {
      const articleNumber = findLooseArticleNumber(line);
      const numbers = Array.from(
        line.matchAll(/-?\d+(?:[.,]\d{1,4})?/g),
        (match) => match[0]
      );

      if (!articleNumber || numbers.length < 2) return null;

      const totalPrice = parseDutchNumber(numbers[numbers.length - 1]);
      const previousNumber = parseDutchNumber(numbers[numbers.length - 2]);
      const quantity =
        numbers.length >= 3 ? parseDutchNumber(numbers[numbers.length - 3]) || 1 : 1;
      const unitMatch = line.match(UNIT_PATTERN);
      const unit = normalizeUnit(unitMatch?.[1] || "kg", line);
      const pricePerUnit =
        previousNumber || (quantity && totalPrice ? totalPrice / quantity : 0);
      const descriptionStart = line.indexOf(articleNumber) + articleNumber.length;
      const firstNumberIndex = line.search(/-?\d+(?:[.,]\d{1,4})?/);
      const description =
        line
          .slice(descriptionStart, firstNumberIndex > descriptionStart ? firstNumberIndex : undefined)
          .replace(UNIT_PATTERN, "")
          .trim() || line.replace(articleNumber, "").trim();
      const row = [
        articleNumber,
        description,
        String(quantity),
        unit,
        String(totalPrice),
        String(pricePerUnit),
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
        },
        ingredients
      );
    })
    .filter((line): line is InvoiceLine => Boolean(line));
}

async function extractPdfText(buffer: Buffer) {
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
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("nld+eng");

  try {
    const result = await worker.recognize(image);
    return result.data.text || "";
  } finally {
    await worker.terminate();
  }
}

async function extractScannedPdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const pages: string[] = [];

  try {
    const screenshots = await parser.getScreenshot({
      first: MAX_OCR_PDF_PAGES,
      desiredWidth: 1800,
      imageBuffer: true,
      imageDataUrl: false,
    });

    for (const page of screenshots.pages) {
      pages.push(await extractTextWithOcr(Buffer.from(page.data)));
    }
  } finally {
    await parser.destroy();
  }

  return pages.join("\n");
}

function createInvoice(
  lines: InvoiceLine[],
  fileName: string,
  text: string
): InvoiceImport {
  return {
    id: `invoice-${Date.now()}`,
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
    lines,
  };
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
    lines = maybeParseDelimitedText(text, ingredients);

    if (!lines.length) {
      warnings.push(
        "Deze PDF bevat weinig tekst. Ik heb OCR op de eerste pagina's geprobeerd."
      );
      text = await extractScannedPdfText(buffer);
      lines = maybeParseDelimitedText(text, ingredients);
    }
  } else if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "tif", "tiff"].includes(extension)) {
    warnings.push("Afbeelding gelezen met OCR. Controleer de herkende regels extra goed.");
    text = await extractTextWithOcr(buffer);
    lines = maybeParseDelimitedText(text, ingredients);
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

  const file = formData.get("file");
  if (!isUploadedFile(file)) {
    return jsonError("Geen bestand ontvangen.");
  }

  if (file.size > MAX_FILE_BYTES) {
    return jsonError("Bestand is te groot. Upload maximaal 20 MB.", 413);
  }

  const ingredients = parseIngredients(formData.get("ingredients"));
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await parseInvoiceFile(
      file.name,
      file.type || "",
      buffer,
      ingredients
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Factuur kon niet gelezen worden."
    );
  }
}
