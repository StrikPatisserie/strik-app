import { NextResponse } from "next/server";
import type { CustomerAllergenList } from "@/app/bakkerij/allergenen/types";

const WORDPRESS_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/recepturen-allergen-lists";
const API_KEY =
  process.env.WORDPRESS_RECEPTUREN_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

function wordpressUrl() {
  const url = new URL(WORDPRESS_URL);
  url.searchParams.set("key", API_KEY);
  return url;
}

async function relay(response: Response) {
  const data = await response.json().catch(() => null);
  return NextResponse.json(data ?? { message: "WordPress gaf geen geldig antwoord." }, {
    status: response.ok ? 200 : response.status === 404 ? 503 : response.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    return relay(await fetch(wordpressUrl(), { cache: "no-store" }));
  } catch {
    return NextResponse.json({ message: "Kan het allergenenarchief niet laden." }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as { lists?: CustomerAllergenList[] } | null;
  if (!Array.isArray(body?.lists)) {
    return NextResponse.json({ message: "Geen geldige allergenenlijsten ontvangen." }, { status: 400 });
  }
  try {
    return relay(await fetch(wordpressUrl(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lists: body.lists }),
      cache: "no-store",
    }));
  } catch {
    return NextResponse.json({ message: "Kan het allergenenarchief niet opslaan." }, { status: 502 });
  }
}
