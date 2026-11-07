import type { RecepturenData } from "../bakkerij/recepturen/recepturenApi";
import type { RecipeUnit } from "../bakkerij/recepturen/types";
import type { PreviewState } from "./planning";

export type WorkRecipeLine = { ingredientId: string; quantity: number; unit: string };
export type WorkRecipeComponent = { kind: "ingredient" | "semiFinished"; linkedId: string; quantity: number; unit: string };
export const WORK_RECIPE_UNITS = ["gram", "kg", "ml", "liter", "stuk"];
export function workRecipeComponentError(line: WorkRecipeComponent, availableIds: string[], duplicate = false): string | undefined {
  const label = line.kind === "ingredient" ? "grondstof" : "halffabricaat";
  if (!line.linkedId || !availableIds.includes(line.linkedId)) return `Kies een bestaande ${label} of verwijder deze regel.`;
  if (duplicate) return `Deze ${label} staat al in het recept. Voeg de hoeveelheden samen of kies een andere koppeling.`;
  if (!Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 1000000) return "Vul een hoeveelheid groter dan nul en maximaal 1000000 in.";
  if (!WORK_RECIPE_UNITS.includes(line.unit)) return "Kies een geldige eenheid voor deze regel.";
}
export type WorkRecipeInput = {
  itemId: string; recipeId: string; yield: number; instructions: string;
  workInstructions: string; finishingInstructions: string;
  ingredients: WorkRecipeLine[];
  semiFinishedItems: { recipeId: string; quantity: number; unit: string }[];
};
export function workRecipeSource(state: PreviewState, data: RecepturenData, itemId: string) {
  const item = state.items.find(item => item.id === itemId);
  const recipe = data.recipes.find(recipe => item?.recipeId ? recipe.id === item.recipeId : item?.id === `recipe:${recipe.id}`);
  if (!item || item.kind === "activity" || !recipe) throw Error("Dit onderdeel heeft geen gekoppeld werkrecept. Ververs de planning.");
  const sourceUnit = recipe.standardBatchUnit === "stuk" ? "stuks" : recipe.standardBatchUnit;
  const unitChanged = sourceUnit !== item.unit;
  let yieldQuantity = recipe.standardBatchQuantity || 0;
  if (unitChanged) {
    const units: Record<string, { dimension: string; factor: number }> = {
      gram: { dimension: "mass", factor: 1 }, kg: { dimension: "mass", factor: 1000 },
      ml: { dimension: "volume", factor: 1 }, liter: { dimension: "volume", factor: 1000 },
    };
    const from = units[sourceUnit || ""], to = units[item.unit];
    yieldQuantity = from && to && from.dimension === to.dimension ? yieldQuantity * from.factor / to.factor : 0;
  }
  const converted = Number.isFinite(yieldQuantity) && yieldQuantity > 0 && yieldQuantity <= 1000000;
  const requiresPermanent = !item.recipeId || unitChanged;
  const notice = requiresPermanent ? unitChanged
    ? `Het bronrecept gebruikt ${recipe.standardBatchUnit || "een onbekende eenheid"}. Dit geplande onderdeel gebruikt ${item.unit}. ${converted ? `De basisopbrengst is omgerekend naar ${yieldQuantity.toLocaleString("nl-NL")} ${item.unit}. Controleer deze waarde.` : `Vul zelf een geldige basisopbrengst in ${item.unit} in. Automatisch omrekenen levert geen geldige basisopbrengst op.`} Bij opslaan wordt hetzelfde vaste recept opnieuw gekoppeld aan dit onderdeel.`
    : "Bij opslaan wordt het bestaande vaste bronrecept opnieuw gekoppeld aan dit onderdeel." : undefined;
  return { item, recipe, yieldQuantity: converted ? yieldQuantity : 0, requiresPermanent, notice, unitChanged };
}
export function editableWorkRecipe(state: PreviewState, data: RecepturenData, itemId: string): WorkRecipeInput {
  const { recipe, yieldQuantity } = workRecipeSource(state, data, itemId);
  return {
    itemId, recipeId: recipe.id, yield: yieldQuantity,
    instructions: (recipe.preparationSteps || []).join("\n"),
    workInstructions: (recipe.workInstructions || []).join("\n"),
    finishingInstructions: (recipe.finishingSteps || []).join("\n"),
    ingredients: (recipe.ingredients || []).map(line => ({ ingredientId: line.ingredientId, quantity: line.quantity, unit: line.unit })),
    semiFinishedItems: (recipe.semiFinishedItems || []).map(line => ({ recipeId: line.semiFinishedRecipeId, quantity: line.quantity, unit: line.unit })),
  };
}

export function updateWorkRecipe(state: PreviewState, data: RecepturenData, input: WorkRecipeInput, now: string) {
  const { item, recipe: current } = workRecipeSource(state, data, input.itemId);
  if (current.id !== input.recipeId) throw Error("De receptkoppeling is gewijzigd. Ververs eerst de planning.");
  if (!["stuks", "gram", "kg", "ml", "liter"].includes(item.unit)) throw Error("Controleer de eenheid eerst in receptenbeheer.");
  if (!Number.isFinite(input.yield) || input.yield <= 0 || input.yield > 1000000) throw Error("Vul een geldige basisopbrengst in.");
  const texts = [input.instructions, input.workInstructions, input.finishingInstructions];
  if (texts.some(text => typeof text !== "string" || text.length > 10000) || !texts.some(text => text.trim())) throw Error("Vul de werkwijze in.");
  if (!Array.isArray(input.ingredients) || !Array.isArray(input.semiFinishedItems) || !input.ingredients.length && !input.semiFinishedItems.length || input.ingredients.length + input.semiFinishedItems.length > 100) throw Error("Voeg één tot honderd grondstoffen of halffabricaten toe.");
  const seen = new Set<string>();
  const valid = (line: WorkRecipeComponent, availableIds: string[], index: number) => {
    const key = `${line.kind}:${line.linkedId}`;
    const error = workRecipeComponentError(line, availableIds, seen.has(key));
    if (error) throw Error(`${line.kind === "ingredient" ? "Grondstof" : "Halffabricaat"} ${index + 1}. ${error}`);
    seen.add(key);
  };
  const ingredients = input.ingredients.map((line, index) => {
    valid({ kind: "ingredient", linkedId: line.ingredientId, quantity: line.quantity, unit: line.unit }, data.ingredients.map(ingredient => ingredient.id), index);
    const original = current.ingredients.find(original => original.ingredientId === line.ingredientId);
    return { ...original, ingredientId: line.ingredientId, quantity: line.quantity, unit: line.unit as RecipeUnit, costContribution: original?.costContribution || 0, sortOrder: index };
  });
  const semiFinishedItems = input.semiFinishedItems.map((line, index) => {
    valid({ kind: "semiFinished", linkedId: line.recipeId, quantity: line.quantity, unit: line.unit }, data.recipes.filter(recipe => recipe.type === "semiFinished").map(recipe => recipe.id), index);
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
  const recipe = { ...current, standardBatchQuantity: input.yield, standardBatchUnit: (item.unit === "stuks" ? "stuk" : item.unit) as RecipeUnit, batchSize: `${input.yield} ${item.unit}`, ingredients, semiFinishedItems, allergens,
    preparationSteps: steps(input.instructions), workInstructions: steps(input.workInstructions), finishingSteps: steps(input.finishingInstructions),
    status: "draft" as const, lastUpdated: now.slice(0, 10) };
  const planner = item.productionBlocked || item.recipeId !== current.id ? { ...state, items: state.items.map(row => row.id === item.id ? { ...row, recipeId: current.id, productionBlocked: false } : row) } : state;
  return { recipes: { ...data, recipes: data.recipes.map(row => row.id === current.id ? recipe : row), updatedAt: now }, planner };
}
