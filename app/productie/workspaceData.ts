import type { RecepturenData } from "../bakkerij/recepturen/recepturenApi";
import { type DepartmentId, type DemoRecipe, type ItemUnit, type PreviewState, type Task, DEPARTMENTS, addDays } from "./planning";

export type IngredientView = { id: string; name: string; supplier: string; unit: string; linked: boolean; specification: string; allergens: string };
export type LiveWorkspace = {
  state: PreviewState; revision: number; recipeRevision: number; updatedAt: string; today: string;
  recipes: DemoRecipe[]; ingredients: IngredientView[]; canManage: boolean;
  departments: DepartmentId[];
};
export function todayAmsterdam() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function itemUnit(value: string | undefined): ItemUnit {
  if (value === "stuk" || value === "stuks") return "stuks";
  return ["gram", "kg", "ml", "liter", "platen", "taak"].includes(value || "") ? value as ItemUnit : "stuks";
}
export function recipeViews(data: RecepturenData): DemoRecipe[] {
  return data.recipes.map(recipe => ({
    id: recipe.id, name: recipe.name, type: recipe.type,
    yield: Number.isFinite(recipe.standardBatchQuantity) && (recipe.standardBatchQuantity || 0) > 0 && ["stuk","stuks","gram","kg","ml","liter","platen"].includes(recipe.standardBatchUnit || "") ? recipe.standardBatchQuantity! : 0,
    unit: itemUnit(recipe.standardBatchUnit),
    ingredients: [
      ...(recipe.ingredients || []).map(line => ({ name: data.ingredients.find(i => i.id === line.ingredientId)?.name || "Grondstofverwijzing controleren", quantity: line.quantity, unit: line.unit })),
      ...(recipe.semiFinishedItems || []).map(line => ({ name: data.recipes.find(r => r.id === line.semiFinishedRecipeId)?.name || "Halffabricaatverwijzing controleren", quantity: line.quantity, unit: line.unit })),
    ],
    steps: [...(recipe.workInstructions || []), ...(recipe.preparationSteps || []), ...(recipe.finishingSteps || [])],
    allergens: recipe.allergens || [],
    semiFinishedItems: (recipe.semiFinishedItems || []).map(line=>({recipeId:line.semiFinishedRecipeId,quantity:line.quantity,unit:line.unit})),
    reviewRequired: (recipe.ingredients || []).some(line=>!data.ingredients.some(i=>i.id===line.ingredientId)) || (recipe.semiFinishedItems || []).some(line=>!data.recipes.some(r=>r.id===line.semiFinishedRecipeId)),
  }));
}
export function ingredientViews(data: RecepturenData): IngredientView[] {
  return data.ingredients.map(i => ({ id: i.id, name: i.name, supplier: i.supplier, unit: i.recipeUnit,
    linked: !!i.specification?.specsPlazaId,
    specification: i.specification?.specsPlazaLink?.environment === "test" ? "SpecsPlaza · testkoppeling" : i.specification?.specsPlazaId ? "SpecsPlaza · gekoppeld" : "Nog te koppelen",
    allergens: i.specification?.allergensConfirmed ? (i.allergens?.join(", ") || "Geen opgegeven allergenen") : "Nog controleren",
  }));
}
export function seedWorkspace(data: RecepturenData): PreviewState {
  const state: PreviewState = { version: 1, items: [], tasks: [] };
  const views=recipeViews(data);
  for (const recipe of data.recipes) {
    const group = (recipe.productGroup || "").trim().toLocaleLowerCase("nl-NL");
    const departmentId: DepartmentId = group === "ijs" ? "ijs" : ["chocolade", "bonbons"].includes(group) ? "chocolade" : "dessert";
    state.items.push({ id: `recipe:${recipe.id}`, recipeId: recipe.id, name: recipe.name,
      kind: recipe.type === "semiFinished" ? "component" : "product", unit: itemUnit(recipe.standardBatchUnit),
      departmentId, departmentUnconfirmed: !["ijs", "chocolade", "bonbons"].includes(group),
      stock: 0, stockKnown: false, note: recipe.internalNotes || recipe.notes || "", articleNumber: recipe.strikArticleNumber,
      productionBlocked: !!views.find(r=>r.id===recipe.id)?.reviewRequired,
    });
    for (const request of recipe.productionRequests || []) {
      if (request.status !== "open" || !Number.isFinite(request.quantity) || request.quantity <= 0) continue;
      try { addDays(request.date, 0); } catch { continue; }
      const id = `legacy-request:${recipe.id}:${request.id}`;
      state.tasks.push({ id, itemId: `recipe:${recipe.id}`, departmentId, date: request.date, quantity: request.quantity,
        operation: "Maken", status: "planned", note: `${request.reason || "Bestaand productieverzoek"}${departmentId === "dessert" ? " · Afdeling controleren" : ""}`,
        source: "manual", batchId: `batch:${id}`, recordsOutput: true,
      });
    }
  }
  for (const task of data.manualProductionPlanningItems || []) {
    if (task.status === "done") continue;
    try { addDays(task.date, 0); } catch { continue; }
    const id = `legacy-manual:${task.id}`;
    state.items.push({ id, name: task.title, kind: "activity", departmentId: "dessert", unit: "taak", stock: 0, stockKnown: false, departmentUnconfirmed: true, note: task.note || "" });
    state.tasks.push({ id, itemId: id, departmentId: "dessert", date: task.date, quantity: 1, operation: "Uitvoeren", status: "planned", note: `${task.note || ""} · Overgenomen losse planning: ${task.quantity} ${task.unit}; afdeling controleren.`, source: "manual", batchId: `batch:${id}`, recordsOutput: false });
  }
  return state;
}
export function syncRecipeCatalog(state: PreviewState, data: RecepturenData): PreviewState {
  const source = seedWorkspace({...data,manualProductionPlanningItems:[],recipes:data.recipes.map(r=>({...r,productionRequests:[]}))});
  const known = new Set(state.items.map(i=>i.id));
  const recipes = recipeViews(data);
  const items = state.items.map(item=> {
    if (!item.recipeId) return item;
    const recipe = recipes.find(r=>r.id===item.recipeId);
    if (!recipe || recipe.unit!==item.unit) return {...item,recipeId:undefined,note:`${item.note}\nReceptkoppeling opnieuw controleren: bronrecept of eenheid gewijzigd.`};
    return {...item,name:recipe.name,kind:recipe.type==="semiFinished"?"component" as const:"product" as const,productionBlocked:!!recipe.reviewRequired};
  });
  return {...state,items:[...items,...source.items.filter(i=>!known.has(i.id))]};
}
export function validWorkspace(value: unknown, recipes: DemoRecipe[]): value is PreviewState {
  if (!value || typeof value !== "object") return false;
  const state = value as PreviewState;
  if (state.version !== 1 || !Array.isArray(state.items) || !Array.isArray(state.tasks) || state.items.length > 15000 || state.tasks.length > 15000) return false;
  const ids = new Set<string>(), tasks = new Map<string, Task>(), batches = new Set<string>();
  try {
    for (const i of state.items) {
      if (!i || typeof i.id !== "string" || !i.id || ids.has(i.id) || typeof i.name !== "string" || !i.name.trim() || i.name.length > 500 || !["product","component","activity"].includes(i.kind) || !DEPARTMENTS.some(d => d.id === i.departmentId) || !["stuks","gram","kg","ml","liter","platen","taak"].includes(i.unit) || !Number.isFinite(i.stock) || i.stock < 0 || typeof i.note !== "string") return false;
      if (i.recipeId && (!recipes.some(r => r.id === i.recipeId && r.unit === i.unit) || i.kind === "activity")) return false;
      ids.add(i.id);
    }
    for (const t of state.tasks) {
      if (!t || !ids.has(t.itemId) || typeof t.id !== "string" || !t.id || tasks.has(t.id) || !Number.isFinite(t.quantity) || t.quantity <= 0 || t.quantity > 1000000 || !["planned","active","done","blocked"].includes(t.status) || !["manual","shop","order","routine"].includes(t.source) || !DEPARTMENTS.some(d => d.id === t.departmentId) || typeof t.operation !== "string" || !t.operation.trim() || typeof t.note !== "string" || t.note.length > 10000 || typeof t.batchId !== "string" || !t.batchId || typeof t.recordsOutput !== "boolean") return false;
      addDays(t.date, 0); if (t.dueDate) { addDays(t.dueDate, 0); if (t.date > t.dueDate) return false; }
      if (t.minutes !== undefined && (!Number.isFinite(t.minutes) || t.minutes < 0 || t.minutes > 1440)) return false;
      if (t.requires!==undefined && (!Array.isArray(t.requires) || t.requires.length>250 || new Set(t.requires).size!==t.requires.length || t.requires.some(id=>typeof id!=="string" || !id || id===t.id))) return false;
      if (t.generatedFor!==undefined && (typeof t.generatedFor!=="string" || !t.generatedFor || t.generatedFor.length>250)) return false;
      if (t.recordsOutput) { if (batches.has(t.batchId) || state.items.find(i => i.id === t.itemId)?.kind === "activity") return false; batches.add(t.batchId); }
      tasks.set(t.id, t);
    }
    const batchItems = new Map<string, string>();
    for (const t of state.tasks) {
      if (batchItems.has(t.batchId) && batchItems.get(t.batchId) !== t.itemId) return false;
      batchItems.set(t.batchId, t.itemId);
      const seen = new Set<string>([t.id]); let cursor: Task | undefined = t;
      while (cursor.dependsOn) {
        const prior = tasks.get(cursor.dependsOn);
        if (!prior || seen.has(prior.id) || prior.batchId !== t.batchId || prior.itemId !== t.itemId || prior.date > cursor.date || ((cursor.status === "done" || cursor.status === "active") && prior.status !== "done")) return false;
        seen.add(prior.id); cursor = prior;
      }
    }
    const visiting=new Set<string>(),visited=new Set<string>();
    function visit(id:string,depth=0):boolean {
      if(depth>250 || visiting.has(id)) return false;
      if(visited.has(id)) return true;
      const t=tasks.get(id);if(!t)return false;visiting.add(id);
      for(const required of [...(t.dependsOn?[t.dependsOn]:[]),...(t.requires || [])]) {
        const prior=tasks.get(required);
        if(!prior || prior.date>t.date || (["done","active"].includes(t.status) && prior.status!=="done") || !visit(required,depth+1))return false;
      }
      visiting.delete(id);visited.add(id);return true;
    }
    for(const id of tasks.keys()) if(!visit(id))return false;
    return true;
  } catch { return false; }
}
