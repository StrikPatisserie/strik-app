import "server-only";

import type { Recipe } from "@/app/bakkerij/recepturen/types";
import type { EvaluationRecipeOption } from "./recipeLinkTypes";

const WORDPRESS_RECEPTUREN_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/recepturen";
const RECEPTUREN_API_KEY =
  process.env.WORDPRESS_RECEPTUREN_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

function cleanNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toOption(recipe: Recipe): EvaluationRecipeOption | null {
  const id = cleanText(recipe.id);
  const name = cleanText(recipe.name);
  if (!id || !name || recipe.type !== "finalProduct") return null;

  return {
    id,
    name,
    articleNumber: cleanText(recipe.strikArticleNumber),
    costPrice: cleanNumber(recipe.costPrice),
    salesPrice: cleanNumber(recipe.salesPrice),
    currentMargin: cleanNumber(recipe.currentMargin),
    lastUpdated: cleanText(recipe.lastUpdated),
  };
}

export async function getEvaluationRecipeOptions(): Promise<
  EvaluationRecipeOption[]
> {
  try {
    const url = new URL(WORDPRESS_RECEPTUREN_API_URL);
    url.searchParams.set("key", RECEPTUREN_API_KEY);

    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const data = (await response.json().catch(() => null)) as {
      recipes?: Recipe[];
    } | null;

    if (!response.ok || !Array.isArray(data?.recipes)) return [];

    return data.recipes
      .map(toOption)
      .filter((recipe): recipe is EvaluationRecipeOption => Boolean(recipe))
      .sort((first, second) =>
        first.name.localeCompare(second.name, "nl-NL", {
          sensitivity: "base",
        })
      );
  } catch {
    return [];
  }
}
