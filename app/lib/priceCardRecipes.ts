import "server-only";

import type {
  Ingredient,
  Recipe,
} from "../bakkerij/recepturen/types";
import type {
  AllergenKey,
  PriceCardCategory,
  RecipeProductDetail,
  RecipeProductSummary,
} from "../management/prijskaartjes/priceCardTypes";

const WORDPRESS_RECEPTUREN_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/recepturen";
const RECEPTUREN_API_KEY =
  process.env.WORDPRESS_RECEPTUREN_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";
const CACHE_MS = 5 * 60 * 1000;

type RecipeArchive = {
  recipes: Recipe[];
  ingredients: Ingredient[];
};

let archiveCache: { expiresAt: number; data: RecipeArchive } | null = null;
let pendingArchive: Promise<RecipeArchive> | null = null;

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl-NL")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchRecipeArchive(): Promise<RecipeArchive> {
  if (archiveCache && archiveCache.expiresAt > Date.now()) return archiveCache.data;
  if (!pendingArchive) {
    pendingArchive = (async () => {
      const url = new URL(WORDPRESS_RECEPTUREN_API_URL);
      url.searchParams.set("key", RECEPTUREN_API_KEY);
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await response.json().catch(() => null)) as Partial<RecipeArchive> | null;
      if (!response.ok || !Array.isArray(data?.recipes) || !Array.isArray(data.ingredients)) {
        throw new Error("Receptenarchief kon niet worden geladen.");
      }
      const archive = { recipes: data.recipes, ingredients: data.ingredients };
      archiveCache = { data: archive, expiresAt: Date.now() + CACHE_MS };
      return archive;
    })().finally(() => {
      pendingArchive = null;
    });
  }
  return pendingArchive;
}

function categoryFromRecipe(recipe: Recipe): PriceCardCategory {
  const value = normalize(`${recipe.productGroup} ${recipe.name}`);
  if (/petit four|petit gateau|macaron/.test(value)) return "petit_fours";
  if (/hartig|quiche|saucij|worstenbrood|kaasstengel/.test(value)) return "hartig";
  if (/brood|baguette|pistolet|bolletje|croissant|krentenbol/.test(value)) return "brood";
  if (/chocol|bonbon|praline|truffel|chocoladeletter/.test(value)) return "chocolade";
  if (/taart|slof|vlaai/.test(value)) return "taart";
  if (/gebak|tompouce|moorkop|soes|gateau/.test(value)) return "gebak";
  if (/koek|cake|brownie|speculaas|stol|krans|zout|muffin|cupcake/.test(value)) {
    return "koek_cake_zout";
  }
  return "overig";
}

function recipeSummary(recipe: Recipe): RecipeProductSummary {
  return {
    id: cleanText(recipe.id, 180),
    name: cleanText(recipe.name, 120),
    priceCents: recipe.salesPrice > 0 ? Math.round(recipe.salesPrice * 100) : 0,
    category: categoryFromRecipe(recipe),
    portionLabel: cleanText(recipe.portionLabel, 50),
  };
}

function recipeScore(query: string, recipe: Recipe) {
  const search = normalize(query);
  const name = normalize(recipe.name);
  const group = normalize(recipe.productGroup);
  if (!search || !name) return -1;
  if (name === search) return 0;
  if (name.startsWith(search)) return 1;
  const terms = search.split(" ").filter(Boolean);
  const haystack = `${name} ${group}`;
  if (!terms.every((term) => haystack.includes(term))) return -1;
  return name.includes(search) ? 2 : 3;
}

function availableRecipes(recipes: Recipe[]) {
  return recipes.filter((recipe) =>
    recipe.type === "finalProduct" && recipe.status !== "old" && recipe.id && recipe.name
  );
}

function preferredSearchRecipes(recipes: Recipe[]) {
  const unique = new Map<string, Recipe>();
  for (const recipe of availableRecipes(recipes)) {
    const key = normalize(`${recipe.name} ${recipe.portionLabel || ""}`);
    const current = unique.get(key);
    if (!current) {
      unique.set(key, recipe);
      continue;
    }
    const recipeRank = (recipe.status === "active" ? 2 : 0) + (recipe.salesPrice > 0 ? 1 : 0);
    const currentRank = (current.status === "active" ? 2 : 0) + (current.salesPrice > 0 ? 1 : 0);
    if (
      recipeRank > currentRank ||
      (recipeRank === currentRank && recipe.lastUpdated > current.lastUpdated)
    ) {
      unique.set(key, recipe);
    }
  }
  return [...unique.values()];
}

export async function searchRecipeProducts(query: string) {
  const archive = await fetchRecipeArchive();
  return preferredSearchRecipes(archive.recipes)
    .map((recipe) => ({ recipe, score: recipeScore(query, recipe) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) =>
      left.score - right.score || left.recipe.name.localeCompare(right.recipe.name, "nl")
    )
    .slice(0, 12)
    .map(({ recipe }) => recipeSummary(recipe));
}

function collectIngredientNames(
  recipe: Recipe,
  recipes: Recipe[],
  ingredients: Ingredient[],
  visited = new Set<string>()
) {
  if (visited.has(recipe.id) || visited.size >= 8) return [];
  visited.add(recipe.id);
  const names = recipe.ingredients.flatMap((line) => {
    const ingredient = ingredients.find((entry) => entry.id === line.ingredientId);
    return ingredient?.name ? [ingredient.name] : [];
  });
  for (const usage of recipe.semiFinishedItems) {
    const semi = recipes.find((entry) => entry.id === usage.semiFinishedRecipeId);
    if (!semi) continue;
    names.push(semi.name, ...collectIngredientNames(semi, recipes, ingredients, visited));
  }
  return [...new Set(names.map((name) => cleanText(name, 120)).filter(Boolean))].slice(0, 24);
}

const ALLERGEN_ALIASES: Array<[RegExp, AllergenKey]> = [
  [/selderij/, "selderij"],
  [/schaaldier/, "schaaldier"],
  [/weekdier/, "weekdier"],
  [/mosterd/, "mosterd"],
  [/sulfiet|zwaveldioxide/, "sulfiet"],
  [/lupine/, "lupine"],
  [/pinda/, "pinda"],
  [/soja/, "soja"],
  [/noten|amandel|hazelnoot|walnoot|cashew|pistache|pecan/, "noten"],
  [/sesam/, "sesam"],
  [/lactose|melk/, "lactose"],
  [/gluten|tarwe|rogge|gerst|spelt/, "gluten"],
  [/alcohol/, "alcohol"],
  [/\bei\b|eieren/, "ei"],
  [/vegetar/, "vegetarisch"],
  [/\bvis\b/, "vis"],
];

function mappedAllergens(values: string[]) {
  const allergens = new Set<AllergenKey>();
  for (const value of values) {
    const normalized = normalize(value);
    for (const [pattern, allergen] of ALLERGEN_ALIASES) {
      if (pattern.test(normalized)) allergens.add(allergen);
    }
  }
  return [...allergens];
}

function collectAllergens(
  recipe: Recipe,
  recipes: Recipe[],
  ingredients: Ingredient[],
  visited = new Set<string>()
): AllergenKey[] {
  if (visited.has(recipe.id) || visited.size >= 8) return [];
  visited.add(recipe.id);
  const values = [...recipe.allergens];
  for (const line of recipe.ingredients) {
    const ingredient = ingredients.find((entry) => entry.id === line.ingredientId);
    if (ingredient) values.push(...ingredient.allergens);
  }
  const collected = new Set(mappedAllergens(values));
  for (const usage of recipe.semiFinishedItems) {
    const semi = recipes.find((entry) => entry.id === usage.semiFinishedRecipeId);
    if (!semi) continue;
    collectAllergens(semi, recipes, ingredients, visited).forEach((item) => collected.add(item));
  }
  return [...collected];
}

export async function getRecipeProductDetail(recipeId: string): Promise<RecipeProductDetail | null> {
  const archive = await fetchRecipeArchive();
  const recipe = availableRecipes(archive.recipes).find((entry) => entry.id === recipeId);
  if (!recipe) return null;
  return {
    ...recipeSummary(recipe),
    allergens: collectAllergens(recipe, archive.recipes, archive.ingredients),
    ingredientNames: collectIngredientNames(recipe, archive.recipes, archive.ingredients),
  };
}

function meaningfulTerms(value: string) {
  return normalize(value)
    .split(" ")
    .filter((term) => term.length > 2 && !["strik", "klein", "kleine", "groot", "grote"].includes(term));
}

function contextScore(productName: string, recipeName: string) {
  const product = normalize(productName);
  const recipe = normalize(recipeName);
  if (!product || !recipe) return 0;
  if (product === recipe) return 100;
  if (product.includes(recipe) || recipe.includes(product)) return 85;
  const productTerms = meaningfulTerms(product);
  const recipeTerms = new Set(meaningfulTerms(recipe));
  const overlap = productTerms.filter((term) => recipeTerms.has(term)).length;
  if (!overlap) return 0;
  return Math.round((overlap / Math.max(productTerms.length, recipeTerms.size)) * 70);
}

export async function getPriceCardRecipeContext(productName: string, recipeId = "") {
  try {
    const archive = await fetchRecipeArchive();
    const recipes = availableRecipes(archive.recipes);
    const exactRecipe = recipeId ? recipes.find((entry) => entry.id === recipeId) : undefined;
    const recipe = exactRecipe || recipes
      .map((entry) => ({ recipe: entry, score: contextScore(productName, entry.name) }))
      .filter((entry) => entry.score >= 40)
      .sort((left, right) => right.score - left.score)[0]?.recipe;
    if (!recipe) return { recipeName: "", ingredientNames: [] as string[] };
    return {
      recipeName: recipe.name,
      ingredientNames: collectIngredientNames(recipe, archive.recipes, archive.ingredients),
    };
  } catch {
    return { recipeName: "", ingredientNames: [] as string[] };
  }
}
