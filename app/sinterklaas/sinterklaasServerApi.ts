import "server-only";

import { NextResponse } from "next/server";
import { canAccessSinterklaas } from "../lib/auth/access";
import { getCurrentProfile } from "../lib/auth/session";

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

async function ensureSinterklaasAccess() {
  const profile = await getCurrentProfile();
  return canAccessSinterklaas(profile);
}

export async function proxySinterklaasGet(request: Request, endpoint: string) {
  if (!(await ensureSinterklaasAccess())) {
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
  if (!(await ensureSinterklaasAccess())) {
    return jsonError("Geen toegang tot Sinterklaas.", 403);
  }

  let body = "";

  if (method !== "DELETE") {
    try {
      body = await request.text();
    } catch {
      return jsonError("Sinterklaas bestelling kon niet gelezen worden.");
    }
  }

  try {
    const response = await fetch(getWordPressUrl(endpoint, request.url), {
      method,
      headers: {
        Accept: "application/json",
        ...(method !== "DELETE" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method !== "DELETE" ? { body } : {}),
    });
    const data = await readWordPressResponse(response);

    if (!response.ok) {
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
