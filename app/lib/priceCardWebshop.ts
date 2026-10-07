import "server-only";

import {
  type AllergenKey,
  type PriceCardCategory,
  type WebshopProductDetail,
  type WebshopProductSummary,
} from "../management/prijskaartjes/priceCardTypes";

const BASE_URL = "https://webshop.strik-patisserie.nl";
const CACHE_MS = 30 * 60 * 1000;
const MAX_CRAWL_DEPTH = 3;

let catalogCache: { expiresAt: number; products: WebshopProductSummary[] } | null = null;
let pendingCatalog: Promise<WebshopProductSummary[]> | null = null;

function decodeHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&euro;|&#8364;/gi, "€")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function absolutePath(value: string) {
  try {
    const url = new URL(decodeHtml(value), BASE_URL);
    return url.origin === BASE_URL ? `${url.pathname}${url.search}` : "";
  } catch {
    return "";
  }
}

function categoryFromPath(path: string, name = ""): PriceCardCategory {
  const normalized = `${path} ${name}`.toLowerCase();
  if (/sint|speculaas|chocoladeletter/.test(normalized)) return "sint";
  if (/kerst|stol|kransjes|sneeuwster/.test(normalized)) return "kerst";
  if (/gebak/.test(normalized)) return "gebak";
  if (/taart|slof|vlaai/.test(normalized)) return "taart";
  if (/stukwerk|brood|koek|cake|hartig|zoutjes/.test(normalized)) return "stukwerk";
  return "overig";
}

function parsePrice(block: string) {
  const large = decodeHtml(
    block.match(/<div\s+class=["']large["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || ""
  ).replace(/[^0-9,-]/g, "");
  const small = decodeHtml(
    block.match(/<div\s+class=["']small["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || ""
  ).replace(/\D/g, "");
  const euros = Number.parseInt(large.replace(/\D/g, ""), 10);
  if (!Number.isFinite(euros)) return 0;
  return euros * 100 + (Number.parseInt(small.padEnd(2, "0").slice(0, 2), 10) || 0);
}

async function fetchText(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(new URL(path, BASE_URL), {
      headers: {
        "User-Agent": "Strik-Team-App/1.0 (productkaartjes)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Webshop antwoordde met ${response.status}.`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseGroupLinks(html: string) {
  const links = new Set<string>();
  const pattern = /<a\b[^>]*class=["'][^"']*productGroupBlock[^"']*["'][^>]*href=["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const path = absolutePath(match[1]);
    if (path.startsWith("/assortiment/")) links.add(path);
  }
  return [...links];
}

function parseProducts(html: string) {
  const products: WebshopProductSummary[] = [];
  const pattern = /<a\b[^>]*class=["']product["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const path = absolutePath(match[1]);
    const block = match[2];
    const name = decodeHtml(
      block.match(/class=["']productButtonProductName["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || ""
    );
    const priceCents = parsePrice(block);
    if (!path.startsWith("/assortiment/") || !name || priceCents <= 0) continue;
    products.push({ name, path, priceCents, category: categoryFromPath(path, name) });
  }
  return products;
}

async function crawlCatalog() {
  const root = await fetchText("/");
  let queue = parseGroupLinks(root).map((path) => ({ path, depth: 1 }));
  const visited = new Set<string>();
  const products = new Map<string, WebshopProductSummary>();

  while (queue.length > 0) {
    const batch = queue.splice(0, 8).filter(({ path }) => !visited.has(path));
    batch.forEach(({ path }) => visited.add(path));
    const pages = await Promise.allSettled(
      batch.map(async (item) => ({ ...item, html: await fetchText(item.path) }))
    );

    for (const page of pages) {
      if (page.status !== "fulfilled") continue;
      const foundProducts = parseProducts(page.value.html);
      if (foundProducts.length > 0) {
        foundProducts.forEach((product) => products.set(product.path, product));
        continue;
      }
      if (page.value.depth >= MAX_CRAWL_DEPTH) continue;
      const childLinks = parseGroupLinks(page.value.html);
      queue = [
        ...queue,
        ...childLinks.map((path) => ({ path, depth: page.value.depth + 1 })),
      ];
    }
  }

  return [...products.values()].sort((left, right) => left.name.localeCompare(right.name, "nl"));
}

async function getCatalog() {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.products;
  if (!pendingCatalog) {
    pendingCatalog = crawlCatalog()
      .then((products) => {
        catalogCache = { products, expiresAt: Date.now() + CACHE_MS };
        return products;
      })
      .finally(() => {
        pendingCatalog = null;
      });
  }
  return pendingCatalog;
}

export async function searchWebshopProducts(query: string) {
  const normalizedQuery = normalizeForSearch(query);
  if (normalizedQuery.length < 2) return [];
  const terms = normalizedQuery.split(" ").filter(Boolean);
  const catalog = await getCatalog();

  return catalog
    .map((product) => {
      const haystack = normalizeForSearch(product.name);
      const allTerms = terms.every((term) => haystack.includes(term));
      if (!allTerms) return null;
      const score = haystack === normalizedQuery ? 0 : haystack.startsWith(normalizedQuery) ? 1 : 2;
      return { product, score };
    })
    .filter((entry): entry is { product: WebshopProductSummary; score: number } => Boolean(entry))
    .sort((left, right) => left.score - right.score || left.product.name.localeCompare(right.product.name, "nl"))
    .slice(0, 12)
    .map(({ product }) => product);
}

const ALLERGEN_MAP: Record<string, AllergenKey> = {
  ei: "ei",
  gluten: "gluten",
  lactose: "lactose",
  melk: "lactose",
  noten: "noten",
  pinda: "pinda",
  sesam: "sesam",
  soja: "soja",
  lupine: "lupine",
  mosterd: "mosterd",
  selderij: "selderij",
  vis: "vis",
  schaaldier: "schaaldier",
  schaaldieren: "schaaldier",
  weekdier: "weekdier",
  weekdieren: "weekdier",
  sulfiet: "sulfiet",
  zwaveldioxide: "sulfiet",
  alcohol: "alcohol",
  vegetarisch: "vegetarisch",
};

function oneSentence(value: string) {
  const text = decodeHtml(value);
  if (!text) return "";
  const sentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || text;
  if (sentence.length <= 125) return sentence;
  const shortened = sentence.slice(0, 122).replace(/\s+\S*$/, "").trim();
  return `${shortened}…`;
}

export async function getWebshopProductDetail(path: string): Promise<WebshopProductDetail> {
  const safePath = absolutePath(path);
  if (!safePath.startsWith("/assortiment/")) throw new Error("Ongeldig webshopproduct.");
  const html = await fetchText(safePath);
  const rightPanel = html.match(/<div\s+id=["']rightpanel["'][^>]*>([\s\S]*?)<div\s+id=["']loadingOverlay["']/i)?.[1] || html;
  const name = decodeHtml(
    rightPanel.match(/class=["']productButtonProductName["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || ""
  );
  const summary = html.match(/id=["'][^"']*lblProductSummary["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || "";
  const allergens = new Set<AllergenKey>();
  const allergenSection = html.match(/<div\s+id=["']allergenen["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  for (const match of allergenSection.matchAll(/<img\b[^>]*alt=["']([^"']+)["'][^>]*>/gi)) {
    const key = ALLERGEN_MAP[normalizeForSearch(decodeHtml(match[1])).replace(/\s/g, "")];
    if (key) allergens.add(key);
  }
  const priceCents = parsePrice(rightPanel);
  if (!name || priceCents <= 0) throw new Error("Productgegevens konden niet worden gelezen.");

  return {
    name,
    path: safePath,
    priceCents,
    category: categoryFromPath(safePath, name),
    description: oneSentence(summary),
    allergens: [...allergens],
    sourceUrl: new URL(safePath, BASE_URL).toString(),
  };
}
