"use client";

import {
  VierdaagseProduct,
  ensureRequiredVierdaagseProducts,
  normalizeVierdaagseProducts,
  vierdaagseProducts,
} from "./vierdaagseData";

const productsStorageKey = "strik-vierdaagse-kassa-products-v1";
const vierdaagseProductsApiUrl = "/api/vierdaagse-products";
const minimumUsableProductCount = 20;

function isBrowser() {
  return typeof window !== "undefined";
}

function getDefaultProducts() {
  return ensureRequiredVierdaagseProducts(vierdaagseProducts);
}

function isUsableProductList(products: VierdaagseProduct[]) {
  return products.length >= minimumUsableProductCount;
}

function mergeProducts(
  baseProducts: VierdaagseProduct[],
  extraProducts: VierdaagseProduct[]
) {
  const usedIds = new Set(baseProducts.map((product) => product.id));
  const usedNames = new Set(
    baseProducts.map((product) => product.name.trim().toLowerCase())
  );
  const extras = extraProducts.filter((product) => {
    const name = product.name.trim().toLowerCase();
    return !usedIds.has(product.id) && !usedNames.has(name);
  });

  return ensureRequiredVierdaagseProducts([...baseProducts, ...extras]);
}

function repairProductList(products: VierdaagseProduct[]) {
  const withRequiredProducts = ensureRequiredVierdaagseProducts(products);

  return isUsableProductList(withRequiredProducts)
    ? withRequiredProducts
    : mergeProducts(getDefaultProducts(), withRequiredProducts);
}

function readProductsFromStorage() {
  if (!isBrowser()) return getDefaultProducts();

  try {
    const raw = window.localStorage.getItem(productsStorageKey);
    if (!raw) return getDefaultProducts();

    return repairProductList(normalizeVierdaagseProducts(JSON.parse(raw)));
  } catch {
    return getDefaultProducts();
  }
}

function writeProductsToStorage(products: VierdaagseProduct[]) {
  if (!isBrowser()) return;

  window.localStorage.setItem(
    productsStorageKey,
    JSON.stringify(repairProductList(products))
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
      const cleanProducts = normalizeVierdaagseProducts(data);
      const products = repairProductList(cleanProducts);

      if (products.length) {
        writeProductsToStorage(products);
        if (JSON.stringify(products) !== JSON.stringify(cleanProducts)) {
          void saveVierdaagseProductsToWordPress(products);
        }
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
  const cleanProducts = repairProductList(normalizeVierdaagseProducts(products));
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
      const savedProducts = repairProductList(normalizeVierdaagseProducts(data));
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
