import "server-only";

import { NextResponse } from "next/server";
import { canAccessPath, canAccessSinterklaas } from "../lib/auth/access";
import { getCurrentProfile } from "../lib/auth/session";
import { canViewStoreLetterOrder, getLetterStoreScope, letterOrderShop, letterShopName } from "./letterStoreAccess";
import { randomUUID } from "node:crypto";
import { normalizeB2BOrder, normalizeLetterOrder } from "./sinterklaasApi";

const WORDPRESS_SINTERKLAAS_API_BASE =
  process.env.WORDPRESS_SINTERKLAAS_API_BASE ||
  "https://strik-patisserie.nl/wp-json/strik/v1";
const SINTERKLAAS_API_KEY =
  process.env.WORDPRESS_SINTERKLAAS_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

function getWordPressUrl(endpoint: string, requestUrl: string) {
  const sourceUrl = new URL(requestUrl);
  const url = new URL(`${WORDPRESS_SINTERKLAAS_API_BASE}/${endpoint}`);
  url.searchParams.set("key", SINTERKLAAS_API_KEY);

  for (const [key, value] of sourceUrl.searchParams.entries()) {
    if (key !== "key") url.searchParams.set(key, value);
  }

  return url;
}

async function readWordPressResponse(response: Response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json") && text) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }

  return text ? { message: text.slice(0, 400) } : null;
}

function getWordPressErrorMessage(endpoint: string, status: number) {
  if (status === 403) {
    return "Geen toegang vanuit WordPress. Controleer de Sinterklaas API sleutel.";
  }

  if (status === 404) {
    return `WordPress route ${endpoint} is nog niet beschikbaar. Activeer de Sinterklaas snippet.`;
  }

  if (status >= 500) {
    return "WordPress Sinterklaas-opslag geeft een serverfout.";
  }

  return "WordPress Sinterklaas-opslag is tijdelijk niet bereikbaar.";
}

function createWordPressErrorResponse(endpoint: string, status: number) {
  return NextResponse.json(
    {
      message: getWordPressErrorMessage(endpoint, status),
      wordpressStatus: status,
    },
    { status: status === 403 ? 403 : 502 }
  );
}

async function getAuthorizedSinterklaasProfile(endpoint: string) {
  const profile = await getCurrentProfile();
  return canAccessSinterklaas(profile) || (["sinterklaas-mailing", "sinterklaas-b2b-orders"].includes(endpoint) && canAccessPath(profile, "/kerst")) ? profile : null;
}

// Called only behind the production-page access check. Production must include
// every shop; the ordinary store-order proxy intentionally applies shop scope.
export async function loadProductionWordPressOrders(season: string) {
  async function read(endpoint: string) {
    const url = getWordPressUrl(endpoint, `https://app.strik-patisserie.nl/?year=${encodeURIComponent(season)}`);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const data = await readWordPressResponse(response);
    if (!response.ok || !data || typeof data !== "object" || !("orders" in data) || !Array.isArray(data.orders)) {
      throw new Error("Niet alle bestellingen konden worden opgehaald. De productielijst is niet vastgezet.");
    }
    return data.orders;
  }
  const [letters, b2b] = await Promise.all([read("sinterklaas-letter-orders"), read("sinterklaas-b2b-orders")]);
  return {
    letters: letters.flatMap(value => { const order = normalizeLetterOrder(value); return order ? [order] : []; }),
    b2b: b2b.flatMap(value => { const order = normalizeB2BOrder(value); return order ? [order] : []; }),
  };
}

export async function proxySinterklaasGet(request: Request, endpoint: string) {
  const profile = await getAuthorizedSinterklaasProfile(endpoint);
  if (!profile) {
    return jsonError("Geen toegang tot Sinterklaas.", 403);
  }

  try {
    const response = await fetch(getWordPressUrl(endpoint, request.url), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const data = await readWordPressResponse(response);

    if (!response.ok) {
      return createWordPressErrorResponse(endpoint, response.status);
    }

    if (endpoint === "sinterklaas-letter-orders") {
      const scope = getLetterStoreScope(profile);
      if (scope !== null) {
        if (!data || typeof data !== "object" || !("orders" in data) || !Array.isArray(data.orders)) {
          return jsonError("Winkelbestellingen konden niet worden gecontroleerd.", 502);
        }
        const orders = data.orders.filter((order) => order && typeof order === "object" && canViewStoreLetterOrder(scope, order));
        return NextResponse.json({ orders, total: orders.length, generatedAt: "generatedAt" in data ? data.generatedAt : undefined });
      }
    }
    return NextResponse.json(data || { orders: [] });
  } catch {
    return NextResponse.json(
      { message: "Kan geen verbinding maken met WordPress Sinterklaas-opslag." },
      { status: 502 }
    );
  }
}

export async function proxySinterklaasMutation(
  request: Request,
  endpoint: string,
  method: "POST" | "PATCH" | "DELETE"
) {
  const profile = await getAuthorizedSinterklaasProfile(endpoint);
  if (!profile) {
    return jsonError("Geen toegang tot Sinterklaas.", 403);
  }

  let body = "";
  let mutationRequestUrl = request.url;

  try {
    body = await request.text();
  } catch {
    return jsonError("Sinterklaas bestelling kon niet gelezen worden.");
  }

  try {
    if (endpoint === "sinterklaas-letter-orders") {
      const scope = getLetterStoreScope(profile);
      if (scope !== null) {
        if (!scope.length) return jsonError("Aan dit winkelaccount is nog geen winkel gekoppeld. Vraag beheer om dit in te stellen.", 403);
        let params: Record<string, unknown>;
        try { params = body ? JSON.parse(body) : {}; }
        catch { return jsonError("Geen geldige bestelling ontvangen."); }
        if (!params || typeof params !== "object" || Array.isArray(params)) return jsonError("Geen geldige bestelling ontvangen.");
        const queryIds = new URL(request.url).searchParams.getAll("id");
        if (queryIds.length > 1) return jsonError("Controleer het ordernummer.");
        const queryId = queryIds[0] || "";
        const bodyId = params.id ?? "";
        if (typeof bodyId !== "string" || (queryId && bodyId && queryId.toLowerCase() !== bodyId.toLowerCase())) return jsonError("Controleer het ordernummer.");
        const id = bodyId || queryId;
        if (id && !/^[a-z0-9_-]{1,120}$/i.test(id)) return jsonError("Controleer het ordernummer.");
        if (method !== "POST" && !id) return jsonError("Ordernummer ontbreekt.");

        // Check ownership against all stored orders, independent of any year,
        // search or shop filter supplied by the browser. POST is an upsert too.
        const lookupUrl = new URL(request.url);
        lookupUrl.search = "";
        const lookup = await fetch(getWordPressUrl(endpoint, lookupUrl.toString()), { cache: "no-store", headers: { Accept: "application/json" } });
        if (!lookup.ok) return createWordPressErrorResponse(endpoint, lookup.status);
        const stored = await readWordPressResponse(lookup);
        if (!stored || typeof stored !== "object" || !("orders" in stored) || !Array.isArray(stored.orders)) return jsonError("De bestelling kon niet worden gecontroleerd. Probeer opnieuw.", 502);
        const existing = id ? stored.orders.find((order) => order && typeof order === "object" && typeof order.id === "string" && order.id.toLowerCase() === id.toLowerCase()) : undefined;
        if ((existing && !canViewStoreLetterOrder(scope, existing)) || (!existing && method !== "POST")) return jsonError("Deze bestelling is niet beschikbaar voor deze winkel.", 403);
        const targetUrl = new URL(request.url);
        targetUrl.search = "";
        if (id) targetUrl.searchParams.set("id", id);
        mutationRequestUrl = targetUrl.toString();
        if (method !== "DELETE") {
          const destination = letterOrderShop({ ...(existing || {}), ...params });
          if (!destination) return jsonError("Kies een geldige afhaalwinkel.");
          params.source = "winkel";
          params.id = existing?.id || id || `winkel-${randomUUID()}`;
          params.shop = letterShopName(destination);
          params.pickupLocation = params.shop;
          body = JSON.stringify(params);
        } else {
          body = "";
        }
      }
    }
    const response = await fetch(getWordPressUrl(endpoint, mutationRequestUrl), {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
    });
    const data = await readWordPressResponse(response);

    if (!response.ok) {
      if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
        return NextResponse.json({ message: data.message }, { status: response.status });
      }
      return createWordPressErrorResponse(endpoint, response.status);
    }

    return NextResponse.json(data || { ok: true }, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "Kan geen verbinding maken met WordPress Sinterklaas-opslag." },
      { status: 502 }
    );
  }
}
