import type { Ingredient, Recipe } from "./types";
import { normalizeSearch } from "./utils";

export type RecipeReplacement = NonNullable<Ingredient["recipeReplacement"]>;

export function resolveRecipeReplacement(
  ingredient: Ingredient,
  ingredients: Ingredient[],
  recipes: Recipe[]
): { kind: "ingredient"; item: Ingredient } | { kind: "semiFinished"; item: Recipe } | undefined {
  const visited = new Set<string>();
  let current = ingredient;
  while (current.recipeReplacement) {
    if (visited.has(current.id)) return undefined;
    visited.add(current.id);
    const replacement = current.recipeReplacement;
    if (replacement.kind === "semiFinished") {
      const item = recipes.find((recipe) => recipe.id === replacement.id && recipe.type === "semiFinished");
      return item ? { kind: "semiFinished", item } : undefined;
    }
    const next = ingredients.find((item) => item.id === replacement.id);
    if (!next) return undefined;
    current = next;
  }
  return current.status === "inactive" ? undefined : { kind: "ingredient", item: current };
}

export function replaceIngredientForRecipes(
  sourceId: string,
  replacement: RecipeReplacement,
  ingredients: Ingredient[],
  recipes: Recipe[],
  today = new Date().toISOString().slice(0, 10)
) {
  const source = ingredients.find((item) => item.id === sourceId);
  const target = replacement.kind === "ingredient"
    ? ingredients.find((item) => item.id === replacement.id && item.status !== "inactive")
    : recipes.find((item) => item.id === replacement.id && item.type === "semiFinished");
  if (!source || !target || (replacement.kind === "ingredient" && source.id === target.id)) {
    throw new Error("Kies een andere actieve grondstof of een halffabricaat.");
  }

  if (replacement.kind === "semiFinished") {
    const visited = new Set<string>();
    function containsSource(recipeId: string): boolean {
      if (visited.has(recipeId)) return false;
      visited.add(recipeId);
      const recipe = recipes.find((item) => item.id === recipeId);
      return Boolean(recipe && (recipe.ingredients.some((line) => line.ingredientId === sourceId) ||
        recipe.semiFinishedItems.some((line) => containsSource(line.semiFinishedRecipeId))));
    }
    if (containsSource(target.id)) throw new Error("Dit zou een kringverwijzing tussen recepten maken.");
    if (recipes.some((recipe) => recipe.ingredients.some((line) => line.ingredientId === sourceId && (line.wastePercentage || 0) > 0))) {
      throw new Error("Controleer eerst de uitvalpercentages voordat je deze grondstof door een halffabricaat vervangt.");
    }
  }

  let affectedRecipes = 0;
  const nextRecipes = recipes.map((recipe) => {
    if (!recipe.ingredients.some((line) => line.ingredientId === sourceId)) return recipe;
    affectedRecipes++;
    if (replacement.kind === "ingredient") {
      return { ...recipe, lastUpdated: today, ingredients: recipe.ingredients.map((line) =>
        line.ingredientId === sourceId ? { ...line, ingredientId: target.id, costContribution: 0 } : line) };
    }
    const originalCount = recipe.ingredients.length;
    return {
      ...recipe,
      lastUpdated: today,
      ingredients: recipe.ingredients.flatMap((line, index) => line.ingredientId === sourceId ? [] : [{ ...line, sortOrder: line.sortOrder ?? index }]),
      semiFinishedItems: [
        ...recipe.semiFinishedItems.map((line, index) => ({ ...line, sortOrder: line.sortOrder ?? originalCount + index })),
        ...recipe.ingredients.flatMap((line, index) => line.ingredientId === sourceId ? [{
          semiFinishedRecipeId: target.id, quantity: line.quantity, unit: line.unit,
          costContribution: 0, sortOrder: line.sortOrder ?? index,
        }] : []),
      ],
    };
  });
  const aliases = new Map<string, string>();
  if (replacement.kind === "ingredient") {
    const targetIngredient = target as Ingredient;
    [...targetIngredient.aliases, source.name, ...source.aliases.filter((alias) => !/^[\d\s.-]+$/.test(alias))]
      .forEach((alias) => { if (alias.trim()) aliases.set(normalizeSearch(alias), alias.trim()); });
  }
  const nextIngredients = ingredients.map((item) => {
    if (item.id === sourceId) return { ...item, status: "inactive" as const, recipeReplacement: replacement, lastUpdated: today };
    if (replacement.kind === "ingredient" && item.id === target.id) return { ...item, aliases: [...aliases.values()], lastUpdated: today };
    return item;
  });
  return { ingredients: nextIngredients, recipes: nextRecipes, affectedRecipes, targetName: target.name };
}
