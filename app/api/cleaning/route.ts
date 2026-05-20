import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORDPRESS_CLEANING_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/cleaning";
const CLEANING_API_KEY =
  process.env.WORDPRESS_CLEANING_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

function getWordPressCleaningUrl() {
  const url = new URL(WORDPRESS_CLEANING_API_URL);
  url.searchParams.set("key", CLEANING_API_KEY);

  return url;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWordPressCleaning() {
  const requestInit = {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  } as const;

  try {
    const response = await fetch(getWordPressCleaningUrl(), requestInit);
    if (response.status < 500) return response;
  } catch {
    // Retry below for short WordPress/network hiccups.
  }

  await wait(300);

  return fetch(getWordPressCleaningUrl(), requestInit);
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

function getWordPressErrorMessage(status: number) {
  if (status === 403) {
    return "Geen toegang vanuit WordPress. Controleer de API sleutel.";
  }

  if (status === 404) {
    return "WordPress schoonmaakroute is niet beschikbaar.";
  }

  if (status >= 500) {
    return "WordPress schoonmaakopslag geeft een serverfout.";
  }

  return "WordPress schoonmaakopslag is tijdelijk niet beschikbaar.";
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

export async function GET() {
  try {
    const response = await fetchWordPressCleaning();
    const data = await readWordPressResponse(response);

    if (!response.ok) {
      return createWordPressErrorResponse(response.status);
    }

    if (!Array.isArray(data)) {
      return NextResponse.json(
        {
          message: "WordPress schoonmaakroute geeft geen geldige data terug.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        message: "Kan geen verbinding maken met WordPress schoonmaakopslag.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  let body = "";

  try {
    body = await request.text();
  } catch {
    return NextResponse.json(
      { message: "Schoonmaakregistratie kon niet gelezen worden." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(getWordPressCleaningUrl(), {
      method: "POST",
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
        message: "Kan geen verbinding maken met WordPress schoonmaakopslag.",
      },
      { status: 502 }
    );
  }
}
