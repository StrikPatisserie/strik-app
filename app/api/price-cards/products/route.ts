import { NextResponse } from "next/server";
import { hasFullAccess } from "../../../lib/auth/access";
import { getCurrentProfile } from "../../../lib/auth/session";
import {
  getWebshopProductDetail,
  searchWebshopProducts,
} from "../../../lib/priceCardWebshop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasFullAccess(await getCurrentProfile())) {
    return NextResponse.json({ message: "Geen toegang tot webshopproducten." }, { status: 403 });
  }

  const url = new URL(request.url);
  const path = String(url.searchParams.get("path") || "").trim();
  const query = String(url.searchParams.get("q") || "").trim().slice(0, 120);

  try {
    if (path) {
      return NextResponse.json(
        { product: await getWebshopProductDetail(path) },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    if (query.length < 2) {
      return NextResponse.json({ products: [] });
    }
    return NextResponse.json(
      { products: await searchWebshopProducts(query) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Webshop doorzoeken is mislukt." },
      { status: 502 }
    );
  }
}
