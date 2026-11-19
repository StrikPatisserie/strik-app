import type { RecepturenData } from "../bakkerij/recepturen/recepturenApi";
import type { Recipe, RecipeUnit } from "../bakkerij/recepturen/types";
import { DEPARTMENTS, type DepartmentId, type PreviewState } from "./planning";
import { updateWorkRecipe, WORK_RECIPE_UNITS, type WorkRecipeInput } from "./workRecipe";

export type NewRecipeInput = Omit<WorkRecipeInput, "itemId" | "recipeId"> & {
  name: string;
  type: Recipe["type"];
  departmentId: DepartmentId;
  unit: RecipeUnit;
  articleNumber: string;
  productGroup: string;
  equipment: string;
  notes: string;
  allergens: string[];
  photo?: { dataUrl: string; name: string };
};

function text(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw Error(`Controleer ${label}.`);
  return value.trim();
}

// Creation is an explicit operational command. Never accept prices, existing
// recipe identities, stock balances or management settings from the browser.
export function createProductionRecipe(state: PreviewState, data: RecepturenData, input: NewRecipeInput, id: string, now: string) {
  if (!input || typeof input !== "object") throw Error("Vul het recept in.");
  const name = text(input.name, "de receptnaam", 160, true);
  if (!["finalProduct", "semiFinished"].includes(input.type)) throw Error("Kies een eindproduct of halffabricaat.");
  const department = DEPARTMENTS.find(row => row.id === input.departmentId);
  if (!department) throw Error("Kies een afdeling.");
  if (!WORK_RECIPE_UNITS.includes(input.unit)) throw Error("Kies een geldige eenheid voor de basisopbrengst.");
  if (data.recipes.some(recipe => recipe.id === id) || state.items.some(item => item.id === `recipe:${id}`)) throw Error("Dit recept is al opgeslagen.");
  const articleNumber = text(input.articleNumber, "het artikelnummer", 80);
  const productGroup = text(input.productGroup, "de productgroep", 100) || department.name;
  const equipment = text(input.equipment, "de benodigdheden", 2000).split("\n").filter(Boolean);
  const notes = text(input.notes, "de notities", 10000);
  if (!Array.isArray(input.allergens) || input.allergens.length > 30 || input.allergens.some(value => typeof value !== "string" || !value.trim() || value.length > 80)) throw Error("Controleer de allergenen.");
  let photo: Pick<Recipe, "photoPreviewDataUrl" | "photoFileName" | "photoUpdatedAt"> = {};
  if (input.photo) {
    if (typeof input.photo.dataUrl !== "string" || input.photo.dataUrl.length > 1500000 || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(input.photo.dataUrl)) throw Error("Kies een JPG-, PNG- of WebP-foto van maximaal 1 MB.");
    photo = { photoPreviewDataUrl: input.photo.dataUrl, photoFileName: text(input.photo.name, "de fotonaam", 200, true), photoUpdatedAt: now };
  }
  const recipe: Recipe = {
    id, name, type: input.type, productGroup, strikArticleNumber: articleNumber,
    salesPrice: 0, costPrice: 0, previousCostPrice: 0, targetMargin: 0, currentMargin: 0,
    status: "draft", ingredients: [], semiFinishedItems: [], preparationSteps: [],
    allergens: [...new Set(input.allergens.map(value => value.trim()))], equipment, notes,
    isWorkModeVisible: true, createdAt: now.slice(0, 10), lastUpdated: now.slice(0, 10),
    version: "1", portionLabel: "", batchSize: "", photoHint: "", ...photo,
  };
  const item = {
    id: `recipe:${id}`, recipeId: id, name, kind: input.type === "semiFinished" ? "component" as const : "product" as const,
    departmentId: department.id, departmentUnconfirmed: false,
    unit: input.unit === "stuk" ? "stuks" as const : input.unit,
    articleNumber, stock: 0, stockKnown: false, note: notes,
  };
  return updateWorkRecipe({ ...state, items: [...state.items, item] }, { ...data, recipes: [...data.recipes, recipe] }, {
    itemId: item.id, recipeId: id, yield: input.yield, instructions: input.instructions,
    workInstructions: input.workInstructions, finishingInstructions: input.finishingInstructions,
    ingredients: input.ingredients, semiFinishedItems: input.semiFinishedItems, productionSteps: input.productionSteps,
  }, now);
}
