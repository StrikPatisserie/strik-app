import { NextResponse } from "next/server";
import { getCurrentProfile } from "../../lib/auth/session";
import {
  canAccessWinkelLocation,
  filterWinkelScopedItems,
  getWinkelStoreIdFromLocation,
} from "../../lib/winkelLocationAccess";
import type { UserProfile } from "../../lib/supabase/types";

export const dynamic = "force-dynamic";

const WORDPRESS_TEMPERATURE_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/temperature-registration";
const TEMPERATURE_API_KEY =
  process.env.WORDPRESS_TEMPERATURE_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

function getWordPressTemperatureUrl() {
  const url = new URL(WORDPRESS_TEMPERATURE_API_URL);
  url.searchParams.set("key", TEMPERATURE_API_KEY);

  return url;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWordPressTemperature() {
  const requestInit = {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  } as const;

  try {
    const response = await fetch(getWordPressTemperatureUrl(), requestInit);
    if (response.status < 500) return response;
  } catch {
    // Retry below for short WordPress/network hiccups.
  }

  await wait(300);

  return fetch(getWordPressTemperatureUrl(), requestInit);
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
    return "WordPress temperatuurroute is niet beschikbaar.";
  }

  if (status >= 500) {
    return "WordPress temperatuuropslag geeft een serverfout.";
  }

  return "WordPress temperatuuropslag is tijdelijk niet beschikbaar.";
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

function unauthenticatedResponse() {
  return NextResponse.json({ message: "Niet ingelogd." }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json(
    { message: "Deze winkel hoort niet bij je account." },
    { status: 403 }
  );
}

function hasTemperatureAccess(profile: UserProfile | null | undefined) {
  if (!profile?.active) return false;
  const role = String(profile.role || "").trim().toLowerCase();

  return (
    role === "winkel" ||
    role === "ijs" ||
    role === "ijssalon" ||
    role === "bakkerij" ||
    profile.permissions?.["winkel.view"] ||
    profile.permissions?.["ijs.view"] ||
    profile.permissions?.["bakkerij.view"] ||
    profile.permissions?.["app.all"]
  );
}

function getPayloadLocation(value: unknown) {
  if (!value || typeof value !== "object") return "";

  const payload = value as { winkel?: unknown };

  return typeof payload.winkel === "string" ? payload.winkel : "";
}

function shouldCheckWinkelScope(profile: UserProfile | null | undefined) {
  const role = String(profile?.role || "").trim().toLowerCase();

  return role === "winkel";
}

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile?.active || !hasTemperatureAccess(profile)) {
      return unauthenticatedResponse();
    }

    const response = await fetchWordPressTemperature();
    const data = await readWordPressResponse(response);

    if (!response.ok) {
      return createWordPressErrorResponse(response.status);
    }

    if (!Array.isArray(data)) {
      return NextResponse.json(
        {
          message: "WordPress temperatuurroute geeft geen geldige data terug.",
        },
        { status: 502 }
      );
    }

    if (shouldCheckWinkelScope(profile)) {
      return NextResponse.json(
        filterWinkelScopedItems(
          profile,
          data as { winkel?: string }[]
        )
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        message: "Kan geen verbinding maken met WordPress temperatuuropslag.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  let body = "";
  let parsedBody: unknown = null;

  try {
    body = await request.text();
    parsedBody = body ? JSON.parse(body) : null;
  } catch {
    return NextResponse.json(
      { message: "Temperatuurregistratie kon niet gelezen worden." },
      { status: 400 }
    );
  }

  try {
    const profile = await getCurrentProfile();
    if (!profile?.active || !hasTemperatureAccess(profile)) {
      return unauthenticatedResponse();
    }

    const payloadLocation = getPayloadLocation(parsedBody);
    if (
      shouldCheckWinkelScope(profile) &&
      getWinkelStoreIdFromLocation(payloadLocation) &&
      !canAccessWinkelLocation(profile, payloadLocation)
    ) {
      return forbiddenResponse();
    }

    const response = await fetch(getWordPressTemperatureUrl(), {
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
        message: "Kan geen verbinding maken met WordPress temperatuuropslag.",
      },
      { status: 502 }
    );
  }
}
