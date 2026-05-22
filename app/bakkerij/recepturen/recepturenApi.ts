import type { Ingredient, InvoiceImport, InvoiceLine, Recipe } from "./types";

export type RecepturenData = {
  ingredients: Ingredient[];
  recipes: Recipe[];
  invoiceImports: InvoiceImport[];
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

  return {
    ingredients: Array.isArray(record.ingredients) ? record.ingredients : [],
    recipes: Array.isArray(record.recipes) ? record.recipes : [],
    invoiceImports: pruneInvoiceImports(
      Array.isArray(record.invoiceImports) ? record.invoiceImports : []
    ),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
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
