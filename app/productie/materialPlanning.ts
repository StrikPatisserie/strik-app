import { convertRecipeQuantity, requiredTaskIds, type DemoRecipe, type PreviewState, type Task } from "./planning";

const round = (value: number) => Math.round(value * 1e9) / 1e9;

/** Reservations belong to the consuming task. A shared batch records output once. */
export function recipeMaterialNeeds(state: PreviewState, recipes: DemoRecipe[], task: Task): Record<string, number> {
  const item = state.items.find(item => item.id === task.itemId);
  const recipe = state.productionWork?.overrides?.[task.id]
    || recipes.find(recipe => recipe.id === item?.recipeId);
  const needs: Record<string, number> = {};
  if (!recipe?.yield || !item || !task.requires?.length) return needs;

  for (const part of recipe.semiFinishedItems || []) {
    const matches = task.requires
      .map(id => state.tasks.find(task => task.id === id))
      .filter((producer): producer is Task => !!producer
        && state.items.find(item => item.id === producer.itemId)?.recipeId === part.recipeId);
    if (matches.length !== 1) continue;

    const producer = matches[0];
    const producerUnit = state.items.find(item => item.id === producer.itemId)!.unit;
    try {
      const recipeAmount = convertRecipeQuantity(task.quantity, item.unit, recipe.unit);
      const partAmount = convertRecipeQuantity(part.quantity * recipeAmount / recipe.yield, part.unit, producerUnit);
      needs[producer.id] = round((needs[producer.id] || 0) + partAmount);
    } catch {
      // Incomplete legacy unit mappings need review before batches can be combined.
    }
  }
  return needs;
}

export function materialConsumers(state: PreviewState, recipes: DemoRecipe[], producerId: string) {
  return state.tasks.filter(task => task.requires?.includes(producerId)).map(task => ({
    task,
    item: state.items.find(item => item.id === task.itemId)!,
    quantity: (task.materialNeeds || recipeMaterialNeeds(state, recipes, task))[producerId] ?? null,
  }));
}

export function canCombineMaterial(state: PreviewState, task: Task) {
  const item = state.items.find(item => item.id === task.itemId);
  return task.status === "planned"
    && item?.kind === "component"
    && !!item.recipeId
    && !!task.generatedFor
    && task.recordsOutput
    && !task.dependsOn
    && !task.stockFulfillmentId
    && !state.productionWork?.timers?.[task.id]
    && !state.productionWork?.completions?.[task.id]
    && !state.productionWork?.work?.some(row => row.taskId === task.id)
    && !state.productionWork?.overrides?.[task.id]
    && !state.tasks.some(other => other.id !== task.id && other.batchId === task.batchId)
    && state.tasks.find(parent => parent.id === task.generatedFor)?.recipePlan?.preparation?.combine !== false;
}

const batchKey = (task: Task) => JSON.stringify([task.itemId, task.date, task.departmentId, task.operation]);

export function materialBatchGroups(state: PreviewState) {
  const groups = new Map<string, Task[]>();
  for (const task of state.tasks) {
    if (!canCombineMaterial(state, task)) continue;
    const key = batchKey(task);
    groups.set(key, [...(groups.get(key) || []), task]);
  }
  return [...groups.values()].filter(tasks => tasks.length > 1);
}

export function combineMaterialTasks(state: PreviewState, recipes: DemoRecipe[], ids: string[]): PreviewState {
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 250 || new Set(ids).size !== ids.length) {
    throw Error("Kies minstens twee verschillende halffabricaattaken.");
  }
  const chosen = state.tasks.filter(task => ids.includes(task.id));
  if (chosen.length !== ids.length || chosen.some(task => !canCombineMaterial(state, task))
    || new Set(chosen.map(batchKey)).size !== 1) {
    throw Error("Bundel alleen ongestarte batches van hetzelfde onderdeel, op dezelfde dag en afdeling, met dezelfde handeling.");
  }

  const keeper = chosen[0];
  const removed = new Set(chosen.slice(1).map(task => task.id));
  const consumers = state.tasks.filter(task => requiredTaskIds(task).some(id => ids.includes(id)));
  const needs = new Map(consumers.map(task => [task.id, task.materialNeeds || recipeMaterialNeeds(state, recipes, task)]));
  if (consumers.some(task => task.status !== "planned"
    || task.requires?.some(id => ids.includes(id) && !needs.get(task.id)?.[id]))) {
    throw Error("Controleer eerst de recepthoeveelheden en ongestarte vervolgstappen van deze batches.");
  }

  const quantity = round(chosen.reduce((total, task) => total + task.quantity, 0));
  if (quantity > 1000000) throw Error("De gezamenlijke batch is te groot.");
  const chosenNeeds: Record<string, number> = {};
  for (const task of chosen) {
    for (const [id, amount] of Object.entries(task.materialNeeds || recipeMaterialNeeds(state, recipes, task))) {
      chosenNeeds[id] = round((chosenNeeds[id] || 0) + amount);
    }
  }
  const minutes = chosen.every(task => task.minutes !== undefined)
    ? chosen.reduce((total, task) => total + task.minutes!, 0)
    : undefined;
  const replace = (id: string) => removed.has(id) ? keeper.id : id;
  const tasks = state.tasks.filter(task => !removed.has(task.id)).map(original => {
    const task = original.id === keeper.id ? {
      ...original,
      quantity,
      minutes: minutes !== undefined && minutes <= 1440 ? minutes : undefined,
      requires: [...new Set(chosen.flatMap(task => task.requires || []))],
      materialNeeds: chosenNeeds,
      note: [...new Set(chosen.map(task => task.note).filter(Boolean))].join("\n").slice(0, 10000),
    } : original;
    const incoming = original.id === keeper.id ? task.materialNeeds : needs.get(task.id) || task.materialNeeds;
    const materialNeeds = incoming ? Object.entries(incoming).reduce<Record<string, number>>((result, [id, amount]) => {
      const target = replace(id);
      result[target] = round((result[target] || 0) + amount);
      return result;
    }, {}) : undefined;
    return {
      ...task,
      ...(task.requires ? { requires: [...new Set(task.requires.map(replace))] } : {}),
      ...(materialNeeds ? { materialNeeds } : {}),
    };
  });
  return { ...state, tasks };
}

export function combineNewPreparations(state: PreviewState, recipes: DemoRecipe[], newIds: Set<string>) {
  let next = state;
  // Lower-level tasks appear before their consumers in a recipe plan.
  const groups = materialBatchGroups(state).filter(group => group.some(task => newIds.has(task.id)));
  for (const group of groups) next = combineMaterialTasks(next, recipes, group.map(task => task.id));
  return next;
}
