import type {
  BakeryHomeData,
  HefeOrderHistoryEntry,
  HefeOrderHistoryLine,
  Ingredient,
  InvoiceImport,
  InvoiceLine,
  ManualProductionPlanningItem,
  PackagingItem,
  Recipe,
} from "./types";

export type RecepturenData = {
  ingredients: Ingredient[];
  recipes: Recipe[];
  packagingItems?: PackagingItem[];
  invoiceImports: InvoiceImport[];
  hefeOrderHistory?: HefeOrderHistoryEntry[];
  bakeryHome?: BakeryHomeData;
  manualProductionPlanningItems?: ManualProductionPlanningItem[];
  updatedAt?: string;
};

type RecepturenApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status?: number };

const APP_RECEPTUREN_API_URL = "/api/recepturen";
const WORDPRESS_RECEPTUREN_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/recepturen";
const WORDPRESS_RECEPTUREN_API_KEY = "schoonmaak-ijs-strik";
const MAX_STORED_INVOICE_IMPORTS = 32;
const MAX_REVIEW_INVOICE_IMPORTS = 8;
const MAX_PROCESSED_INVOICE_IMPORTS = 14;
const MAX_REVERTED_INVOICE_IMPORTS = 6;
const MAX_IGNORED_INVOICE_IMPORTS = 4;
const MAX_OTHER_INVOICE_IMPORTS = 4;
const MAX_STORED_LINES_PER_INVOICE = 600;
const MAX_MANUAL_PLANNING_ITEMS = 500;
const MAX_HEFE_ORDER_HISTORY = 26;
const MAX_HEFE_ORDER_LINES = 160;

export const emptyBakeryHomeData: BakeryHomeData = {
  notes: [],
  offers: [],
};

function getWordPressRecepturenUrl() {
  const url = new URL(WORDPRESS_RECEPTUREN_API_URL);
  url.searchParams.set("key", WORDPRESS_RECEPTUREN_API_KEY);

  return url.toString();
}

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

function getErrorMessage(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string" &&
    data.message.trim()
  ) {
    return data.message;
  }

  return fallback;
}

function normalizeRecepturenData(data: unknown): RecepturenData | null {
  if (!data || typeof data !== "object") return null;

  const record = data as Partial<RecepturenData>;
  const bakeryHome =
    record.bakeryHome && typeof record.bakeryHome === "object"
      ? record.bakeryHome
      : emptyBakeryHomeData;

  return {
    ingredients: Array.isArray(record.ingredients) ? record.ingredients : [],
    recipes: Array.isArray(record.recipes) ? record.recipes : [],
    packagingItems: Array.isArray(record.packagingItems)
      ? record.packagingItems
      : [],
    invoiceImports: pruneInvoiceImports(
      Array.isArray(record.invoiceImports) ? record.invoiceImports : []
    ),
    hefeOrderHistory: normalizeHefeOrderHistory(record.hefeOrderHistory),
    bakeryHome: {
      notes: Array.isArray(bakeryHome.notes) ? bakeryHome.notes : [],
      offers: Array.isArray(bakeryHome.offers) ? bakeryHome.offers : [],
    },
    manualProductionPlanningItems: normalizeManualProductionPlanningItems(
      record.manualProductionPlanningItems
    ),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

function normalizeHefeOrderHistoryLine(
  value: unknown,
  index: number
): HefeOrderHistoryLine | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Partial<HefeOrderHistoryLine>;
  const name = cleanStoredText(record.name, 180).trim();
  const quantity = Number(record.quantity);

  if (!name || !Number.isFinite(quantity) || quantity <= 0) return null;

  return {
    id: cleanStoredText(record.id, 80) || `hefe-line-${index + 1}`,
    articleNumber: cleanStoredText(record.articleNumber, 80).trim(),
    name,
    packageSize: cleanStoredText(record.packageSize, 120).trim(),
    quantity: Math.max(0, quantity),
    note: cleanStoredText(record.note, 180).trim(),
  };
}

function normalizeHefeOrderHistory(value: unknown): HefeOrderHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_HEFE_ORDER_HISTORY)
    .flatMap((entry, index): HefeOrderHistoryEntry[] => {
      if (!entry || typeof entry !== "object") return [];

      const record = entry as Partial<HefeOrderHistoryEntry>;
      const orderedAt = cleanStoredText(record.orderedAt, 120).trim();
      const lines = Array.isArray(record.lines)
        ? record.lines
            .slice(0, MAX_HEFE_ORDER_LINES)
            .map(normalizeHefeOrderHistoryLine)
            .filter((line): line is HefeOrderHistoryLine => Boolean(line))
        : [];

      if (!orderedAt || !lines.length) return [];

      return [{
        id: cleanStoredText(record.id, 80) || `hefe-order-${index + 1}`,
        orderedAt,
        subject: cleanStoredText(record.subject, 180).trim(),
        recipient: cleanStoredText(record.recipient, 180).trim(),
        lines,
      }];
    });
}

function cleanStoredText(value: unknown, maxLength = 600) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function cleanStoredDate(value: unknown) {
  if (typeof value !== "string") return "";

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function normalizeManualProductionPlanningItems(
  value: unknown
): ManualProductionPlanningItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_MANUAL_PLANNING_ITEMS)
    .flatMap((item, index): ManualProductionPlanningItem[] => {
      if (!item || typeof item !== "object") return [];

      const record = item as Partial<ManualProductionPlanningItem>;
      const title = cleanStoredText(record.title, 160).trim();
      const date = cleanStoredDate(record.date);
      const quantity = Number(record.quantity);

      if (!title || !date) return [];

      return [{
        id: cleanStoredText(record.id, 80) || `manual-planning-${index + 1}`,
        date,
        title,
        quantity: Number.isFinite(quantity) ? Math.max(0, quantity) : 1,
        unit: cleanStoredText(record.unit, 40).trim() || "stuks",
        note: cleanStoredText(record.note, 400).trim(),
        status: record.status === "done" ? "done" : "open",
        createdAt: cleanStoredText(record.createdAt, 120),
        completedAt: cleanStoredDate(record.completedAt),
      }];
    });
}

function hasReviewWork(invoice: InvoiceImport) {
  return (
    invoice.status === "review" ||
    invoice.lines.some((line) => line.reviewStatus === "pending")
  );
}

function stableInvoiceLineId(
  invoice: InvoiceImport,
  line: InvoiceLine,
  index: number
) {
  if (line.id) return line.id;

  const invoiceKey = invoice.id || invoice.invoiceNumber || "invoice";
  return `${invoiceKey}-line-${index + 1}`;
}

function ensureInvoiceLineIds(invoice: InvoiceImport) {
  return {
    ...invoice,
    lines: invoice.lines.map((line, index) => ({
      ...line,
      id: stableInvoiceLineId(invoice, line, index),
    })),
  };
}

function limitStoredInvoiceLines(invoice: InvoiceImport) {
  return {
    ...invoice,
    lines: invoice.lines.slice(0, MAX_STORED_LINES_PER_INVOICE),
  };
}

function compactIgnoredInvoice(invoice: InvoiceImport) {
  return {
    ...invoice,
    lines: [],
  };
}

export function pruneInvoiceImports(invoiceImports: InvoiceImport[]) {
  const counters = {
    review: 0,
    processed: 0,
    reverted: 0,
    ignored: 0,
    other: 0,
  };

  return invoiceImports
    .filter((invoice) => invoice && Array.isArray(invoice.lines))
    .map(ensureInvoiceLineIds)
    .filter((invoice) => {
      if (hasReviewWork(invoice)) {
        counters.review += 1;
        return counters.review <= MAX_REVIEW_INVOICE_IMPORTS;
      }

      if (invoice.status === "processed") {
        counters.processed += 1;
        return counters.processed <= MAX_PROCESSED_INVOICE_IMPORTS;
      }

      if (invoice.status === "reverted") {
        counters.reverted += 1;
        return counters.reverted <= MAX_REVERTED_INVOICE_IMPORTS;
      }

      if (invoice.status === "ignored") {
        counters.ignored += 1;
        return counters.ignored <= MAX_IGNORED_INVOICE_IMPORTS;
      }

      counters.other += 1;
      return counters.other <= MAX_OTHER_INVOICE_IMPORTS;
    })
    .slice(0, MAX_STORED_INVOICE_IMPORTS)
    .map((invoice) =>
      invoice.status === "ignored"
        ? compactIgnoredInvoice(invoice)
        : limitStoredInvoiceLines(invoice)
    );
}

function prepareRecepturenDataForStorage(data: RecepturenData) {
  return {
    ...data,
    invoiceImports: pruneInvoiceImports(data.invoiceImports),
    hefeOrderHistory: normalizeHefeOrderHistory(data.hefeOrderHistory),
    bakeryHome: data.bakeryHome ?? emptyBakeryHomeData,
    manualProductionPlanningItems: normalizeManualProductionPlanningItems(
      data.manualProductionPlanningItems
    ),
  };
}

async function fetchRecepturenDataFrom(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  const data = await readJson(response);
  const normalized = normalizeRecepturenData(data);

  if (response.ok && normalized) {
    return { ok: true as const, data: normalized };
  }

  return {
    ok: false as const,
    status: response.status,
    message: getErrorMessage(
      data,
      "Recepturen konden niet geladen worden."
    ),
  };
}

export async function fetchRecepturenData(): Promise<
  RecepturenApiResult<RecepturenData>
> {
  try {
    const appResult = await fetchRecepturenDataFrom(APP_RECEPTUREN_API_URL);
    if (appResult.ok) return appResult;
  } catch {
    // Probeer WordPress direct als de app-route tijdelijk hapert.
  }

  try {
    return await fetchRecepturenDataFrom(getWordPressRecepturenUrl());
  } catch {
    return {
      ok: false,
      message: "Kan geen verbinding maken met WordPress recepturenopslag.",
    };
  }
}

async function saveRecepturenDataTo(url: string, data: RecepturenData) {
  const storageData = prepareRecepturenDataForStorage(data);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(storageData),
  });
  const result = await readJson(response);
  const normalized = normalizeRecepturenData(result);

  if (response.ok && normalized) {
    return { ok: true as const, data: normalized };
  }

  return {
    ok: false as const,
    status: response.status,
    message: getErrorMessage(
      result,
      "Recepturen konden niet opgeslagen worden."
    ),
  };
}

export async function saveRecepturenData(
  data: RecepturenData
): Promise<RecepturenApiResult<RecepturenData>> {
  try {
    const appResult = await saveRecepturenDataTo(APP_RECEPTUREN_API_URL, data);
    if (appResult.ok) return appResult;
    if (appResult.status && appResult.status < 500) return appResult;
  } catch {
    // Probeer WordPress direct als de app-route tijdelijk hapert.
  }

  try {
    return await saveRecepturenDataTo(getWordPressRecepturenUrl(), data);
  } catch {
    return {
      ok: false,
      message: "Kan geen verbinding maken met WordPress recepturenopslag.",
    };
  }
}
