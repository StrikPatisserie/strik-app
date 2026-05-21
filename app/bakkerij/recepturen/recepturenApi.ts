import type { Ingredient, InvoiceImport, Recipe } from "./types";

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
    invoiceImports: Array.isArray(record.invoiceImports)
      ? record.invoiceImports
      : [],
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
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
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
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
