import type { Ingredient, Recipe } from "./types";

type RecepturenDataWithIngredients = {
  ingredients: Ingredient[];
  recipes: Recipe[];
};

function cleanLegacyHalfFabricateText(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLegacyHalfFabricateIngredient(ingredient: Ingredient) {
  const name = cleanLegacyHalfFabricateText(ingredient.name);
  const article = cleanLegacyHalfFabricateText(ingredient.supplierArticleNumber);
  const id = cleanLegacyHalfFabricateText(ingredient.id);

  return (
    /^HF\s+/i.test(name) ||
    /^HF\d+/i.test(article) ||
    /^ing-hersteld-hf-/i.test(id)
  );
}

function sameSemiFinishedUsage(
  first: Recipe["semiFinishedItems"][number],
  second: Recipe["semiFinishedItems"][number]
) {
  return (
    first.semiFinishedRecipeId === second.semiFinishedRecipeId &&
    first.unit === second.unit &&
    Math.abs((first.quantity || 0) - (second.quantity || 0)) < 0.0001
  );
}

function moveLegacyHalfFabricateReferences(
  recipes: Recipe[],
  legacyIngredientIds: Set<string>
) {
  const semiFinishedRecipeIds = new Set(
    recipes
      .filter((recipe) => recipe.type === "semiFinished")
      .map((recipe) => recipe.id)
  );

  return recipes.map((recipe) => {
    let changed = false;
    const nextIngredients: Recipe["ingredients"] = [];
    const nextSemiFinishedItems = Array.isArray(recipe.semiFinishedItems)
      ? [...recipe.semiFinishedItems]
      : [];

    (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).forEach(
      (line) => {
        if (!legacyIngredientIds.has(line.ingredientId)) {
          nextIngredients.push(line);
          return;
        }

        changed = true;
        if (
          line.ingredientId === recipe.id ||
          !semiFinishedRecipeIds.has(line.ingredientId)
        ) {
          return;
        }

        const replacement: Recipe["semiFinishedItems"][number] = {
          semiFinishedRecipeId: line.ingredientId,
          quantity: line.quantity,
          unit: line.unit,
          costContribution: line.costContribution || 0,
          sortOrder: line.sortOrder,
        };
        const existing = nextSemiFinishedItems.find((item) =>
          sameSemiFinishedUsage(item, replacement)
        );

        if (existing) {
          existing.costContribution =
            existing.costContribution || replacement.costContribution;
          if (existing.sortOrder === undefined) {
            existing.sortOrder = replacement.sortOrder;
          }
        } else {
          nextSemiFinishedItems.push(replacement);
        }
      }
    );

    return changed
      ? {
          ...recipe,
          ingredients: nextIngredients,
          semiFinishedItems: nextSemiFinishedItems,
        }
      : recipe;
  });
}

export function removeLegacyHalfFabricateIngredients<
  T extends RecepturenDataWithIngredients,
>(data: T): T {
  const ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];
  const legacyIngredients = ingredients.filter(isLegacyHalfFabricateIngredient);
  if (!legacyIngredients.length) return data;

  const legacyIngredientIds = new Set(
    legacyIngredients.map((ingredient) => ingredient.id)
  );
  const recipes = Array.isArray(data.recipes) ? data.recipes : [];

  return {
    ...data,
    ingredients: ingredients.filter(
      (ingredient) => !isLegacyHalfFabricateIngredient(ingredient)
    ),
    recipes: moveLegacyHalfFabricateReferences(recipes, legacyIngredientIds),
  };
}
