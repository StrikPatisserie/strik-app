import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORDPRESS_RECEPTUREN_HOME_PHOTO_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/recepturen-home-photo";
const RECEPTUREN_API_KEY =
  process.env.WORDPRESS_RECEPTUREN_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

function getWordPressHomePhotoUrl() {
  const url = new URL(WORDPRESS_RECEPTUREN_HOME_PHOTO_URL);
  url.searchParams.set("key", RECEPTUREN_API_KEY);

  return url;
}

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

function getMessage(data: unknown, fallback: string) {
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

export async function POST(request: Request) {
  const incoming = await request.formData().catch(() => null);

  if (!incoming) {
    return NextResponse.json(
      { message: "Aanbiedingfoto kon niet gelezen worden." },
      { status: 400 }
    );
  }

  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "Geen aanbiedingfoto ontvangen." },
      { status: 400 }
    );
  }

  const formData = new FormData();
  formData.set("file", file);

  const weekStart = incoming.get("weekStart");
  if (typeof weekStart === "string") formData.set("weekStart", weekStart);

  const label = incoming.get("label");
  if (typeof label === "string") formData.set("label", label);

  try {
    const response = await fetch(getWordPressHomePhotoUrl(), {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    });
    const data = await readJson(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          message: getMessage(
            data,
            "Aanbiedingfoto uploaden naar WordPress mislukt."
          ),
          wordpressStatus: response.status,
        },
        { status: response.status === 403 ? 403 : 502 }
      );
    }

    return NextResponse.json(data || { ok: true });
  } catch {
    return NextResponse.json(
      { message: "Kan geen verbinding maken met WordPress media-opslag." },
      { status: 502 }
    );
  }
}
