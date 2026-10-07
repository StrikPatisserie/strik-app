import { NextResponse } from "next/server";
import { hasFullAccess } from "../../../lib/auth/access";
import { getCurrentProfile } from "../../../lib/auth/session";
import {
  getRecipeProductDetail,
  searchRecipeProducts,
} from "../../../lib/priceCardRecipes";
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
  const recipeId = String(url.searchParams.get("recipe") || "").trim().slice(0, 180);
  const query = String(url.searchParams.get("q") || "").trim().slice(0, 120);

  try {
    if (path) {
      return NextResponse.json(
        { product: await getWebshopProductDetail(path) },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    if (recipeId) {
      const recipe = await getRecipeProductDetail(recipeId);
      if (!recipe) {
        return NextResponse.json({ message: "Recept is niet gevonden." }, { status: 404 });
      }
      return NextResponse.json(
        { recipe },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    if (query.length < 2) {
      return NextResponse.json({ products: [], recipes: [] });
    }
    const [productsResult, recipesResult] = await Promise.allSettled([
      searchWebshopProducts(query),
      searchRecipeProducts(query),
    ]);
    if (productsResult.status === "rejected" && recipesResult.status === "rejected") {
      throw new Error("Webshop en receptenarchief konden niet worden doorzocht.");
    }
    return NextResponse.json(
      {
        products: productsResult.status === "fulfilled" ? productsResult.value : [],
        recipes: recipesResult.status === "fulfilled" ? recipesResult.value : [],
        partial: productsResult.status === "rejected" || recipesResult.status === "rejected",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Zoeken is mislukt." },
      { status: 502 }
    );
  }
}
