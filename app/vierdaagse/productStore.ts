"use client";

import {
  VierdaagseProduct,
  normalizeVierdaagseProducts,
  sortVierdaagseProducts,
  vierdaagseProducts,
} from "./vierdaagseData";

const productsStorageKey = "strik-vierdaagse-kassa-products-v1";
const vierdaagseProductsApiUrl = "/api/vierdaagse-products";

function isBrowser() {
  return typeof window !== "undefined";
}

function readProductsFromStorage() {
  if (!isBrowser()) return vierdaagseProducts;

  try {
    const raw = window.localStorage.getItem(productsStorageKey);
    if (!raw) return sortVierdaagseProducts(vierdaagseProducts);

    const products = normalizeVierdaagseProducts(JSON.parse(raw));
    return products.length ? products : sortVierdaagseProducts(vierdaagseProducts);
  } catch {
    return sortVierdaagseProducts(vierdaagseProducts);
  }
}

function writeProductsToStorage(products: VierdaagseProduct[]) {
  if (!isBrowser()) return;

  window.localStorage.setItem(
    productsStorageKey,
    JSON.stringify(sortVierdaagseProducts(products))
  );
}

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

function getApiMessage(data: unknown, fallback: string) {
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

export function getStoredVierdaagseProducts() {
  return readProductsFromStorage();
}

export async function fetchVierdaagseProductsFromWordPress() {
  try {
    const response = await fetch(vierdaagseProductsApiUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const data = await readJson(response);

    if (response.ok && Array.isArray(data)) {
      const products = normalizeVierdaagseProducts(data);

      if (products.length) {
        writeProductsToStorage(products);
        return { ok: true as const, data: products };
      }

      return { ok: true as const, data: readProductsFromStorage() };
    }

    return {
      ok: false as const,
      data: readProductsFromStorage(),
      status: response.status,
      message: getApiMessage(
        data,
        "WordPress Vierdaagse-producten zijn tijdelijk niet bereikbaar."
      ),
    };
  } catch {
    return {
      ok: false as const,
      data: readProductsFromStorage(),
      message: "Kan geen verbinding maken met WordPress Vierdaagse-producten.",
    };
  }
}

export async function saveVierdaagseProductsToWordPress(
  products: VierdaagseProduct[]
) {
  const cleanProducts = normalizeVierdaagseProducts(products);
  writeProductsToStorage(cleanProducts);

  try {
    const response = await fetch(vierdaagseProductsApiUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ products: cleanProducts }),
    });
    const data = await readJson(response);

    if (response.ok && Array.isArray(data)) {
      const savedProducts = normalizeVierdaagseProducts(data);
      if (savedProducts.length) writeProductsToStorage(savedProducts);

      return { ok: true as const, data: savedProducts };
    }

    return {
      ok: false as const,
      data: cleanProducts,
      status: response.status,
      message: getApiMessage(
        data,
        "WordPress Vierdaagse-producten zijn tijdelijk niet bereikbaar."
      ),
    };
  } catch {
    return {
      ok: false as const,
      data: cleanProducts,
      message: "Kan geen verbinding maken met WordPress Vierdaagse-producten.",
    };
  }
}
