import type { Recipe } from "./types";
import { normalizeSearch } from "./utils";

export const defaultWorkCategoryOptions = [
  { id: "gebak", label: "Gebak" },
  { id: "taarten", label: "Taarten" },
  { id: "sloffen", label: "Sloffen" },
  { id: "koek", label: "Koek" },
  { id: "ijs", label: "IJs" },
  { id: "bonbons", label: "Bonbons" },
  { id: "hartig", label: "Hartig" },
  { id: "chocolade", label: "Chocolade" },
  { id: "cake", label: "Cake" },
  { id: "zout", label: "Zout" },
  { id: "petit", label: "Petit" },
  { id: "seizoen", label: "Seizoen" },
  { id: "overig", label: "Overig" },
];

export function normalizeWorkCategory(value: string) {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function workCategoryLabel(categoryId: string) {
  const known = defaultWorkCategoryOptions.find(
    (category) => category.id === categoryId
  );
  if (known) return known.label;

  return categoryId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function inferredWorkCategories(recipe: Recipe) {
  const haystack = normalizeSearch(`${recipe.productGroup} ${recipe.name}`);
  const categories = defaultWorkCategoryOptions
    .filter((category) => {
      if (category.id === "taarten") return haystack.includes("taart");
      if (category.id === "sloffen") return haystack.includes("slof");
      if (category.id === "koek") return haystack.includes("koek");
      if (category.id === "ijs") return haystack.includes("ijs");
      if (category.id === "bonbons") return haystack.includes("bonbon");
      if (category.id === "hartig") return haystack.includes("hartig");
      if (category.id === "chocolade") return haystack.includes("choco");
      if (category.id === "cake") return haystack.includes("cake");
      if (category.id === "zout") return haystack.includes("zout");
      if (category.id === "petit") return haystack.includes("petit");
      if (category.id === "seizoen") return haystack.includes("seizoen");
      if (category.id === "gebak") {
        return haystack.includes("gebak") || haystack.includes("gateau");
      }

      return false;
    })
    .map((category) => category.id);

  return categories.length ? categories : ["overig"];
}

export function workCategoriesForRecipe(recipe: Recipe) {
  const categories = recipe.workCategories?.length
    ? recipe.workCategories
    : inferredWorkCategories(recipe);

  return Array.from(
    new Set(categories.map(normalizeWorkCategory).filter(Boolean))
  );
}
