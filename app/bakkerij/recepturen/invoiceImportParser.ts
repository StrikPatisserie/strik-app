import type { Ingredient, InvoiceImport, InvoiceLine } from "./types";
import { ingredientPackagePrice, normalizeSearch } from "./utils";

type ParsedInvoiceResult =
  | { ok: true; invoice: InvoiceImport }
  | { ok: false; message: string };

type ColumnMap = {
  articleNumber?: number;
  description?: number;
  quantity?: number;
  unit?: number;
  totalPrice?: number;
  pricePerUnit?: number;
};

const ARTICLE_HEADERS = [
  "artikelnummer",
  "artikel nr",
  "artikelnr",
  "art nr",
  "nummer",
  "productcode",
  "code",
];
const DESCRIPTION_HEADERS = [
  "omschrijving",
  "artikel",
  "product",
  "productnaam",
  "naam",
  "description",
];
const QUANTITY_HEADERS = ["aantal", "hoeveelheid", "qty", "quantity"];
const UNIT_HEADERS = ["eenheid", "eh", "unit", "verpakking"];
const TOTAL_HEADERS = [
  "totaal",
  "bedrag",
  "regelbedrag",
  "netto bedrag",
  "netto",
];
const UNIT_PRICE_HEADERS = [
  "prijs",
  "prijs per",
  "eenheidsprijs",
  "kg prijs",
  "kiloprijs",
  "nettoprijs",
  "stuksprijs",
];

function parseDutchNumber(value: string) {
  const trimmed = value
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

function splitDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());

  return cells;
}

function detectDelimiter(lines: string[]) {
  const candidates = [";", "\t", ","];
  const sample = lines.slice(0, 10).join("\n");

  return candidates
    .map((delimiter) => ({
      delimiter,
      count: sample.split(delimiter).length,
    }))
    .sort((first, second) => second.count - first.count)[0].delimiter;
}

function normalizeHeader(value: string) {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderIndex(headers: string[], options: string[]) {
  return headers.findIndex((header) =>
    options.some((option) => header === option || header.includes(option))
  );
}

function getColumnMap(headers: string[]): ColumnMap {
  const normalizedHeaders = headers.map(normalizeHeader);
  const map: ColumnMap = {
    articleNumber: findHeaderIndex(normalizedHeaders, ARTICLE_HEADERS),
    description: findHeaderIndex(normalizedHeaders, DESCRIPTION_HEADERS),
    quantity: findHeaderIndex(normalizedHeaders, QUANTITY_HEADERS),
    unit: findHeaderIndex(normalizedHeaders, UNIT_HEADERS),
    totalPrice: findHeaderIndex(normalizedHeaders, TOTAL_HEADERS),
    pricePerUnit: findHeaderIndex(normalizedHeaders, UNIT_PRICE_HEADERS),
  };

  Object.entries(map).forEach(([key, value]) => {
    if (value === -1) delete map[key as keyof ColumnMap];
  });

  return map;
}

function hasRequiredColumns(map: ColumnMap) {
  return map.articleNumber !== undefined && map.description !== undefined;
}

function getCell(row: string[], index?: number) {
  return index === undefined ? "" : row[index] || "";
}

function findMatchingIngredient(
  articleNumber: string,
  description: string,
  ingredients: Ingredient[]
) {
  const normalizedDescription = normalizeSearch(description);

  return ingredients.find((ingredient) => {
    if (
      articleNumber &&
      ingredient.supplierArticleNumber.trim() === articleNumber.trim()
    ) {
      return true;
    }

    return [ingredient.name, ...ingredient.aliases].some((alias) => {
      const normalizedAlias = normalizeSearch(alias);

      return (
        normalizedAlias &&
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

function createInvoiceLine(
  row: string[],
  map: ColumnMap,
  ingredients: Ingredient[]
): InvoiceLine | null {
  const articleNumber = getCell(row, map.articleNumber);
  const description = getCell(row, map.description);
  if (!articleNumber && !description) return null;

  const quantity = parseDutchNumber(getCell(row, map.quantity)) || 1;
  const unit = getCell(row, map.unit) || "kg";
  const totalPrice = parseDutchNumber(getCell(row, map.totalPrice));
  const explicitUnitPrice = parseDutchNumber(getCell(row, map.pricePerUnit));
  const pricePerUnit = explicitUnitPrice || (quantity ? totalPrice / quantity : 0);
  const matchedIngredient = findMatchingIngredient(
    articleNumber,
    description,
    ingredients
  );
  const oldPrice = matchedIngredient ? ingredientPackagePrice(matchedIngredient) : 0;
  const newPrice = pricePerUnit || totalPrice;

  if (!newPrice) return null;

  return {
    articleNumber,
    description,
    quantity,
    unit,
    totalPrice: totalPrice || newPrice * quantity,
    pricePerUnit: newPrice,
    matchedIngredientId: matchedIngredient?.id,
    oldPrice,
    newPrice,
    percentageChange: getPercentageChange(oldPrice, newPrice),
    reviewStatus: "pending",
  };
}

function createInvoiceNumber(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getUploadedAt() {
  return new Date().toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createInvoice(lines: InvoiceLine[], fileName: string): InvoiceImport {
  const invoiceNumber = createInvoiceNumber(fileName);

  return {
    id: `beko-${Date.now()}`,
    supplier: "Beko",
    invoiceNumber,
    invoiceDate: getToday(),
    uploadedAt: getUploadedAt(),
    status: "review",
    lines,
  };
}

function parseDelimitedInvoice(
  text: string,
  fileName: string,
  ingredients: Ingredient[]
): ParsedInvoiceResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { ok: false, message: "Het bestand bevat geen leesbare regels." };
  }

  const delimiter = detectDelimiter(lines);
  const rows = lines.map((line) => splitDelimitedLine(line, delimiter));
  const headerIndex = rows.findIndex((row) =>
    hasRequiredColumns(getColumnMap(row))
  );

  if (headerIndex === -1) {
    return {
      ok: false,
      message:
        "Geen Beko-kolommen herkend. Gebruik een CSV met artikelnummer, omschrijving en prijs.",
    };
  }

  const map = getColumnMap(rows[headerIndex]);
  const invoiceLines = rows
    .slice(headerIndex + 1)
    .map((row) => createInvoiceLine(row, map, ingredients))
    .filter((line): line is InvoiceLine => Boolean(line));

  if (!invoiceLines.length) {
    return {
      ok: false,
      message:
        "Geen prijsregels gevonden. Controleer of de Beko-export artikelregels en prijzen bevat.",
    };
  }

  return { ok: true, invoice: createInvoice(invoiceLines, fileName) };
}

export async function parseBekoInvoiceFile(
  file: File,
  ingredients: Ingredient[]
): Promise<ParsedInvoiceResult> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";

  if (["xlsx", "xls"].includes(extension)) {
    return {
      ok: false,
      message:
        "Excel-bestanden kunnen zonder extra parser nog niet rechtstreeks worden gelezen. Exporteer de Beko-factuur als CSV en laad die in.",
    };
  }

  if (extension === "pdf") {
    return {
      ok: false,
      message:
        "PDF-facturen hebben een aparte PDF-parser nodig. De recepturenopslag is klaar; laad voorlopig een Beko CSV-export in.",
    };
  }

  const text = await file.text();

  return parseDelimitedInvoice(text, file.name, ingredients);
}
