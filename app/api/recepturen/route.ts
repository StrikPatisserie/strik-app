import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORDPRESS_RECEPTUREN_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/recepturen";
const RECEPTUREN_API_KEY =
  process.env.WORDPRESS_RECEPTUREN_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

function getWordPressRecepturenUrl() {
  const url = new URL(WORDPRESS_RECEPTUREN_API_URL);
  url.searchParams.set("key", RECEPTUREN_API_KEY);

  return url;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  return null;
}

async function fetchWordPressRecepturen() {
  const requestInit = {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  } as const;

  try {
    const response = await fetch(getWordPressRecepturenUrl(), requestInit);
    if (response.status < 500) return response;
  } catch {
    // Retry below for short WordPress/network hiccups.
  }

  await wait(300);

  return fetch(getWordPressRecepturenUrl(), requestInit);
}

function getWordPressErrorMessage(status: number) {
  if (status === 403) {
    return "Geen toegang vanuit WordPress. Controleer de API sleutel.";
  }

  if (status === 404) {
    return "WordPress recepturenroute is niet beschikbaar.";
  }

  if (status >= 500) {
    return "WordPress recepturenopslag geeft een serverfout.";
  }

  return "WordPress recepturenopslag is tijdelijk niet beschikbaar.";
}

function createWordPressErrorResponse(status: number) {
  return NextResponse.json(
    {
      message: getWordPressErrorMessage(status),
      wordpressStatus: status,
    },
    { status: status === 403 ? 403 : 502 }
  );
}

function isRecepturenData(data: unknown) {
  return Boolean(
    data &&
      typeof data === "object" &&
      Array.isArray((data as { ingredients?: unknown }).ingredients) &&
      Array.isArray((data as { recipes?: unknown }).recipes) &&
      Array.isArray((data as { invoiceImports?: unknown }).invoiceImports)
  );
}

function listCount(data: unknown, key: "recipes" | "ingredients" | "packagingItems") {
  if (!data || typeof data !== "object") return 0;

  const value = (data as Record<string, unknown>)[key];

  return Array.isArray(value) ? value.length : 0;
}

function isDangerousShrink(incoming: unknown, current: unknown) {
  const incomingRecipes = listCount(incoming, "recipes");
  const currentRecipes = listCount(current, "recipes");
  const incomingIngredients = listCount(incoming, "ingredients");
  const currentIngredients = listCount(current, "ingredients");

  return (
    (currentRecipes >= 50 &&
      incomingRecipes <= currentRecipes - 10 &&
      incomingRecipes < currentRecipes * 0.85) ||
    (currentIngredients >= 100 &&
      incomingIngredients <= currentIngredients - 25 &&
      incomingIngredients < currentIngredients * 0.85)
  );
}

async function createShrinkProtectionResponse(incomingData: unknown) {
  const response = await fetchWordPressRecepturen();
  const currentData = await readWordPressResponse(response);

  if (!response.ok || !isRecepturenData(currentData)) {
    return null;
  }

  if (!isDangerousShrink(incomingData, currentData)) {
    return null;
  }

  return NextResponse.json(
    {
      message:
        "Opslaan geblokkeerd: deze tab heeft minder recepturen dan de live opslag. Ververs de pagina om de nieuwste recepturen te laden.",
      liveCounts: {
        recipes: listCount(currentData, "recipes"),
        ingredients: listCount(currentData, "ingredients"),
        packagingItems: listCount(currentData, "packagingItems"),
      },
      incomingCounts: {
        recipes: listCount(incomingData, "recipes"),
        ingredients: listCount(incomingData, "ingredients"),
        packagingItems: listCount(incomingData, "packagingItems"),
      },
    },
    { status: 409 }
  );
}

export async function GET() {
  try {
    const response = await fetchWordPressRecepturen();
    const data = await readWordPressResponse(response);

    if (!response.ok) {
      return createWordPressErrorResponse(response.status);
    }

    if (!isRecepturenData(data)) {
      return NextResponse.json(
        {
          message: "WordPress recepturenroute geeft geen geldige data terug.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        message: "Kan geen verbinding maken met WordPress recepturenopslag.",
      },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request) {
  let body = "";
  let incomingData: unknown = null;

  try {
    body = await request.text();
    incomingData = JSON.parse(body) as unknown;
  } catch {
    return NextResponse.json(
      { message: "Recepturendata kon niet gelezen worden." },
      { status: 400 }
    );
  }

  try {
    if (new URL(request.url).searchParams.get("force") !== "1") {
      const shrinkProtectionResponse =
        await createShrinkProtectionResponse(incomingData);

      if (shrinkProtectionResponse) {
        return shrinkProtectionResponse;
      }
    }

    const response = await fetch(getWordPressRecepturenUrl(), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body,
    });
    const data = await readWordPressResponse(response);

    if (!response.ok) {
      return createWordPressErrorResponse(response.status);
    }

    return NextResponse.json(data || { ok: true }, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      {
        message: "Kan geen verbinding maken met WordPress recepturenopslag.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  return PUT(request);
}
