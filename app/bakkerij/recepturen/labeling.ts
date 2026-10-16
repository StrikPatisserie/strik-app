import type { Ingredient, NutritionKey, Recipe, RecipeUnit } from "./types";

export const nutritionFields: [NutritionKey, string, string][] = [
  ["energyKj", "Energie", "kJ"], ["energyKcal", "Energie", "kcal"],
  ["fat", "Vet", "g"], ["saturates", "Waarvan verzadigd", "g"],
  ["carbohydrates", "Koolhydraten", "g"], ["sugars", "Waarvan suikers", "g"],
  ["protein", "Eiwit", "g"], ["salt", "Zout", "g"],
];

export function calculateLabel(recipe: Recipe, ingredients: Ingredient[], recipes: Recipe[]) {
  const warnings = new Set<string>();
  const amounts = new Map<string, number>();
  const allergens = new Set<string>(recipe.allergens || []);
  const usedIngredients = new Set<string>();
  function collectAllergens(current: Recipe, path: Set<string>) {
    if (path.has(current.id)) return;
    const next = new Set([...path, current.id]);
    current.allergens?.forEach((item) => allergens.add(item));
    for (const line of current.ingredients || []) {
      usedIngredients.add(line.ingredientId);
      const ingredient = ingredients.find((item) => item.id === line.ingredientId);
      if (!(line.quantity > 0)) warnings.add(`Hoeveelheid ontbreekt: ${ingredient?.name || line.ingredientId}`);
      ingredient?.allergens?.forEach((item) => allergens.add(item));
      if (ingredient && !ingredient.specification?.allergensConfirmed) warnings.add(`Allergenen nog niet gecontroleerd: ${ingredient.name}`);
    }
    for (const line of current.semiFinishedItems || []) {
      const semi = recipes.find((item) => item.id === line.semiFinishedRecipeId);
      if (!(line.quantity > 0)) warnings.add(`Hoeveelheid halffabricaat ontbreekt: ${semi?.name || line.semiFinishedRecipeId}`);
      if (semi) collectAllergens(semi, next);
    }
  }
  collectAllergens(recipe, new Set());
  function weight(quantity: number, unit: RecipeUnit, ingredient?: Ingredient) {
    if (!Number.isFinite(quantity) || quantity < 0) return undefined;
    if (unit === "gram") return quantity;
    if (unit === "kg") return quantity * 1000;
    const spec = ingredient?.specification;
    if (unit === "stuk" && spec?.pieceWeightGrams && Number.isFinite(spec.pieceWeightGrams) && spec.pieceWeightGrams > 0) return quantity * spec.pieceWeightGrams;
    if ((unit === "ml" || unit === "liter") && spec?.densityGramsPerMl && Number.isFinite(spec.densityGramsPerMl) && spec.densityGramsPerMl > 0) return quantity * (unit === "liter" ? 1000 : 1) * spec.densityGramsPerMl;
    return undefined;
  }
  function walk(current: Recipe, multiplier: number, path: Set<string>) {
    if (path.has(current.id)) { warnings.add(`Cirkel in halffabricaten: ${current.name}`); return; }
    const nextPath = new Set([...path, current.id]);
    current.allergens?.forEach((item) => allergens.add(item));
    for (const line of current.ingredients || []) {
      if (line.quantity === 0) continue;
      const ingredient = ingredients.find((item) => item.id === line.ingredientId);
      if (!ingredient) { warnings.add(`Grondstof ontbreekt: ${line.ingredientId}`); continue; }
      ingredient.allergens?.forEach((item) => allergens.add(item));
      if (!ingredient.specification?.allergensConfirmed) warnings.add(`Allergenen nog niet gecontroleerd: ${ingredient.name}`);
      const grams = weight(line.quantity, line.unit, ingredient);
      if (grams === undefined || !Number.isFinite(grams)) { warnings.add(`Gewichtsomrekening ontbreekt: ${ingredient.name}`); continue; }
      amounts.set(ingredient.id, (amounts.get(ingredient.id) || 0) + grams * multiplier);
    }
    for (const line of current.semiFinishedItems || []) {
      if (line.quantity === 0) continue;
      const semi = recipes.find((item) => item.id === line.semiFinishedRecipeId);
      if (!semi) { warnings.add(`Halffabricaat ontbreekt: ${line.semiFinishedRecipeId}`); continue; }
      let factor: number | undefined;
      if (line.unit === "stuk" && semi.standardBatchUnit === "stuk" && (semi.standardBatchQuantity || 0) > 0) factor = line.quantity / semi.standardBatchQuantity!;
      else if ((line.unit === "ml" || line.unit === "liter") && (semi.standardBatchUnit === "ml" || semi.standardBatchUnit === "liter") && (semi.standardBatchQuantity || 0) > 0) factor = line.quantity * (line.unit === "liter" ? 1000 : 1) / (semi.standardBatchQuantity! * (semi.standardBatchUnit === "liter" ? 1000 : 1));
      else {
        const grams = weight(line.quantity, line.unit);
        const batch = semi.labeling?.finalBatchWeightGrams;
        if (grams !== undefined && batch && batch > 0) factor = grams / batch;
      }
      if (factor === undefined || !Number.isFinite(factor) || factor < 0) { warnings.add(`Eindgewicht halffabricaat ontbreekt: ${semi.name}`); continue; }
      walk(semi, multiplier * factor, nextPath);
    }
  }
  walk(recipe, 1, new Set());
  const composition = [...amounts].map(([id, grams]) => ({ ingredient: ingredients.find((item) => item.id === id)!, grams })).sort((a, b) => b.grams - a.grams);
  const finalWeight = recipe.labeling?.finalBatchWeightGrams;
  if (!finalWeight || !Number.isFinite(finalWeight) || finalWeight <= 0) warnings.add("Vul het eindgewicht van de volledige batch na bereiding in.");
  if (!composition.length) warnings.add("Er zijn nog geen gekoppelde grondstoffen om door te rekenen.");
  const nutrition: Partial<Record<NutritionKey, number>> = {};
  const massComplete = ![...warnings].some((item) => /ontbreekt|Cirkel/.test(item));
  for (const [key, label] of nutritionFields) {
    const missing = composition.filter(({ ingredient }) => !Number.isFinite(ingredient.specification?.nutritionPer100g?.[key]) || ingredient.specification!.nutritionPer100g![key]! < 0);
    if (missing.length) warnings.add(`${label} ontbreekt bij: ${missing.map((item) => item.ingredient.name).join(", ")}`);
    if (massComplete && finalWeight && Number.isFinite(finalWeight) && finalWeight > 0 && composition.length && !missing.length) nutrition[key] = composition.reduce((total, { ingredient, grams }) => total + ingredient.specification!.nutritionPer100g![key]! * grams, 0) / finalWeight;
  }
  return { composition, usedIngredients: ingredients.filter((item) => usedIngredients.has(item.id)), allergens: [...allergens], nutrition, warnings: [...warnings] };
}
