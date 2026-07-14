import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORDPRESS_VIERDAAGSE_ORDERS_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/vierdaagse-orders";
const VIERDAAGSE_ORDERS_API_KEY =
  process.env.WORDPRESS_VIERDAAGSE_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

function getWordPressVierdaagseOrdersUrl() {
  const url = new URL(WORDPRESS_VIERDAAGSE_ORDERS_API_URL);
  url.searchParams.set("key", VIERDAAGSE_ORDERS_API_KEY);

  return url;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWordPressVierdaagseOrders() {
  const requestInit = {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  } as const;

  try {
    const response = await fetch(getWordPressVierdaagseOrdersUrl(), requestInit);
    if (response.status < 500) return response;
  } catch {
    // Retry below for short WordPress/network hiccups.
  }

  await wait(300);

  return fetch(getWordPressVierdaagseOrdersUrl(), requestInit);
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
    return "WordPress Vierdaagse-route is nog niet beschikbaar. Activeer de Vierdaagse snippet.";
  }

  if (status >= 500) {
    return "WordPress Vierdaagse-opslag geeft een serverfout.";
  }

  return "WordPress Vierdaagse-opslag is tijdelijk niet bereikbaar.";
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
    const response = await fetchWordPressVierdaagseOrders();
    const data = await readWordPressResponse(response);

    if (!response.ok) {
      return createWordPressErrorResponse(response.status);
    }

    if (!Array.isArray(data)) {
      return NextResponse.json(
        {
          message: "WordPress Vierdaagse-route geeft geen geldige data terug.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        message: "Kan geen verbinding maken met WordPress Vierdaagse-opslag.",
      },
      { status: 502 }
    );
  }
}

async function saveVierdaagseOrder(request: Request, method: "POST" | "PUT") {
  let body = "";

  try {
    body = await request.text();
  } catch {
    return NextResponse.json(
      { message: "Vierdaagse order kon niet gelezen worden." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(getWordPressVierdaagseOrdersUrl(), {
      method,
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
        message: "Kan geen verbinding maken met WordPress Vierdaagse-opslag.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  return saveVierdaagseOrder(request, "POST");
}

export async function PUT(request: Request) {
  return saveVierdaagseOrder(request, "PUT");
}
