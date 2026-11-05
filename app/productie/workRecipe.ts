import type { RecepturenData } from "../bakkerij/recepturen/recepturenApi";
import type { RecipeUnit } from "../bakkerij/recepturen/types";
import type { PreviewState } from "./planning";

export type WorkRecipeLine = { ingredientId: string; quantity: number; unit: string };
export type WorkRecipeInput = {
  itemId: string; recipeId: string; yield: number; instructions: string;
  workInstructions: string; finishingInstructions: string;
  ingredients: WorkRecipeLine[];
  semiFinishedItems: { recipeId: string; quantity: number; unit: string }[];
};
export function editableWorkRecipe(state: PreviewState, data: RecepturenData, itemId: string): WorkRecipeInput {
  const item = state.items.find(item => item.id === itemId);
  const recipe = data.recipes.find(recipe => recipe.id === item?.recipeId);
  if (!item || !recipe) throw Error("Dit onderdeel heeft geen gekoppeld werkrecept. Ververs de planning.");
  return {
    itemId, recipeId: recipe.id, yield: recipe.standardBatchQuantity || 0,
    instructions: (recipe.preparationSteps || []).join("\n"),
    workInstructions: (recipe.workInstructions || []).join("\n"),
    finishingInstructions: (recipe.finishingSteps || []).join("\n"),
    ingredients: (recipe.ingredients || []).map(line => ({ ingredientId: line.ingredientId, quantity: line.quantity, unit: line.unit })),
    semiFinishedItems: (recipe.semiFinishedItems || []).map(line => ({ recipeId: line.semiFinishedRecipeId, quantity: line.quantity, unit: line.unit })),
  };
}

export function updateWorkRecipe(state: PreviewState, data: RecepturenData, input: WorkRecipeInput, now: string) {
  const item = state.items.find(item => item.id === input.itemId);
  const current = data.recipes.find(recipe => recipe.id === item?.recipeId);
  if (!item || !current || current.id !== input.recipeId) throw Error("De receptkoppeling is gewijzigd. Ververs eerst de planning.");
  if (!["stuks", "gram", "kg", "ml", "liter"].includes(item.unit)) throw Error("Controleer de eenheid eerst in receptenbeheer.");
  if (!Number.isFinite(input.yield) || input.yield <= 0 || input.yield > 1000000) throw Error("Vul een geldige basisopbrengst in.");
  const texts = [input.instructions, input.workInstructions, input.finishingInstructions];
  if (texts.some(text => typeof text !== "string" || text.length > 10000) || !texts.some(text => text.trim())) throw Error("Vul de werkwijze in.");
  if (!Array.isArray(input.ingredients) || !Array.isArray(input.semiFinishedItems) || !input.ingredients.length && !input.semiFinishedItems.length || input.ingredients.length + input.semiFinishedItems.length > 100) throw Error("Voeg één tot honderd grondstoffen of halffabricaten toe.");
  const units = ["gram", "kg", "ml", "liter", "stuk"], seen = new Set<string>();
  const valid = (key: string, quantity: number, unit: string) => {
    if (seen.has(key) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || !units.includes(unit)) throw Error("Controleer hoeveelheden en eenheden; voeg iedere grondstof of ieder halffabricaat één keer toe.");
    seen.add(key);
  };
  const ingredients = input.ingredients.map((line, index) => {
    if (!data.ingredients.some(ingredient => ingredient.id === line.ingredientId)) throw Error("Kies een bestaande grondstof.");
    valid(`ingredient:${line.ingredientId}`, line.quantity, line.unit);
    const original = current.ingredients.find(original => original.ingredientId === line.ingredientId);
    return { ...original, ingredientId: line.ingredientId, quantity: line.quantity, unit: line.unit as RecipeUnit, costContribution: original?.costContribution || 0, sortOrder: index };
  });
  const semiFinishedItems = input.semiFinishedItems.map(line => {
    if (!data.recipes.some(recipe => recipe.id === line.recipeId && recipe.type === "semiFinished")) throw Error("Kies een bestaand halffabricaat.");
    valid(`recipe:${line.recipeId}`, line.quantity, line.unit);
    const visit = (id: string, path: Set<string>): void => {
      if (id === current.id || path.has(id)) throw Error("Deze koppeling maakt een kring in het recept. Kies een ander halffabricaat.");
      const next = new Set(path).add(id);
      for (const child of data.recipes.find(recipe => recipe.id === id)?.semiFinishedItems || []) visit(child.semiFinishedRecipeId, next);
    };
    visit(line.recipeId, new Set());
    const original = current.semiFinishedItems.find(original => original.semiFinishedRecipeId === line.recipeId);
    return { ...original, semiFinishedRecipeId: line.recipeId, quantity: line.quantity, unit: line.unit as RecipeUnit, costContribution: original?.costContribution || 0 };
  });
  const steps = (text: string) => text.split("\n").map(line => line.trim()).filter(Boolean);
  // Only operational fields change. Prices, specifications, photos, logs and
  // other management data are retained from the canonical server document.
  const allergens = [...new Set([...(current.allergens || []), ...ingredients.flatMap(line => data.ingredients.find(row => row.id === line.ingredientId)?.allergens || []), ...semiFinishedItems.flatMap(line => data.recipes.find(row => row.id === line.semiFinishedRecipeId)?.allergens || [])])];
  const recipe = { ...current, standardBatchQuantity: input.yield, batchSize: `${input.yield} ${item.unit}`, ingredients, semiFinishedItems, allergens,
    preparationSteps: steps(input.instructions), workInstructions: steps(input.workInstructions), finishingSteps: steps(input.finishingInstructions),
    status: "draft" as const, lastUpdated: now.slice(0, 10) };
  return { recipes: { ...data, recipes: data.recipes.map(row => row.id === current.id ? recipe : row), updatedAt: now }, planner: state };
}
