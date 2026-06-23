import type { Recipe } from "./types";
import { normalizeSearch } from "./utils";

const defaultRecipeGroupLabels = [
  "Gebak",
  "Koek",
  "Zout",
  "Taarten",
  "Sloffen",
  "Cake",
  "Petit Gateau",
  "Bonbons",
  "Chocolade",
  "Hartig",
  "IJs",
  "Stukwerk",
  "Vullingen",
  "Bodems & beslag",
  "Seizoen",
  "Overig",
];

export const defaultRecipeGroupOptions = defaultRecipeGroupLabels.map((label) => ({
  id: normalizeRecipeGroup(label),
  label,
}));

export function normalizeRecipeGroup(value: string) {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function recipeGroupLabel(categoryId: string) {
  const known = defaultRecipeGroupOptions.find(
    (category) => category.id === categoryId
  );
  if (known) return known.label;

  return categoryId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function recipeGroupIdForRecipe(recipe: Recipe) {
  return normalizeRecipeGroup(recipe.productGroup) || "overig";
}

export function recipeGroupOptionsForRecipes(
  recipes: Recipe[],
  extraLabels: string[] = []
) {
  const groups = new Map(
    defaultRecipeGroupOptions.map((option) => [option.id, option.label])
  );

  [...recipes.map((recipe) => recipe.productGroup), ...extraLabels].forEach(
    (label) => {
      const trimmed = label.trim();
      const id = normalizeRecipeGroup(trimmed);
      if (!id || groups.has(id)) return;

      groups.set(id, trimmed);
    }
  );

  return Array.from(groups, ([id, label]) => ({ id, label }));
}
