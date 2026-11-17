import { isBakeOffTask, convertRecipeQuantity, mondayOf, requiredTaskIds, type DemoRecipe, type PreviewState, type Task } from "./planning";

const round = (value: number) => Math.round(value * 1e9) / 1e9;

/** Reservations belong to the consuming task. A shared batch records output once. */
export function recipeMaterialNeeds(state: PreviewState, recipes: DemoRecipe[], task: Task): Record<string, number> {
  if (isBakeOffTask(task)) return {};
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

export type MaterialWeekUse = {
  task: Task;
  week: string;
  dates: string[];
  quantity: number | null;
  unit: string;
  producerIds: string[];
};

/** One demand per consuming batch. Follow-up steps and shared output never multiply it. */
export function materialUsesByRecipe(state: PreviewState, recipes: DemoRecipe[]): Map<string, MaterialWeekUse[]> {
  const items = new Map(state.items.map(item => [item.id, item]));
  const recipeMap = new Map(recipes.map(recipe => [recipe.id, recipe]));
  const tasks = new Map(state.tasks.map(task => [task.id, task]));
  const batches = new Map<string, Task[]>();
  for (const task of state.tasks) batches.set(task.batchId, [...(batches.get(task.batchId) || []), task]);
  const result = new Map<string, MaterialWeekUse[]>();

  for (const batch of batches.values()) {
    const task = batch.find(row => row.recipePlan)
      || batch.find(row => row.requires?.length)
      || batch.find(row => !row.dependsOn)
      || batch[0];
    if (isBakeOffTask(task)) continue;
    const item = items.get(task.itemId);
    const recipe = state.productionWork?.overrides?.[task.id] || recipeMap.get(item?.recipeId || "");
    if (!item) continue;
    const needs = task.materialNeeds || recipeMaterialNeeds(state, recipes, task);
    const dependencies = [...new Set(task.requires || [])].map(id => tasks.get(id))
      .filter((row): row is Task => !!row);
    const partIds = new Set([
      ...(recipe?.semiFinishedItems || []).map(part => part.recipeId),
      ...dependencies.map(row => items.get(row.itemId)?.recipeId).filter((id): id is string => !!id),
    ]);

    for (const recipeId of partIds) {
      const parts = recipe?.semiFinishedItems?.filter(part => part.recipeId === recipeId) || [];
      const producers = dependencies.filter(row => items.get(row.itemId)?.recipeId === recipeId);
      const unit = recipeMap.get(recipeId)?.unit || parts[0]?.unit || items.get(producers[0]?.itemId)?.unit;
      if (!unit) continue;
      let calculated: number | null = null;
      try {
        if (recipe && recipe.yield > 0 && parts.length) {
          const scale = convertRecipeQuantity(task.quantity, item.unit, recipe.unit) / recipe.yield;
          calculated = round(parts.reduce((sum, part) => sum + convertRecipeQuantity(part.quantity * scale, part.unit, unit), 0));
        }
      } catch { /* An unknown conversion stays visible as an unknown amount. */ }
      const uses = producers.length ? producers.map(producer => {
        let quantity: number | null = null;
        try {
          const reserved = needs[producer.id];
          if (reserved !== undefined) quantity = convertRecipeQuantity(reserved, items.get(producer.itemId)!.unit, unit);
          else if (producers.length === 1) quantity = calculated;
        } catch { /* Incompatible legacy units need review. */ }
        return { date: producer.date, quantity, producerId: producer.id };
      }) : [{ date: task.date, quantity: calculated, producerId: undefined }];
      const weeks = new Map<string, MaterialWeekUse>();
      for (const use of uses) {
        const week = mondayOf(use.date);
        const entry = weeks.get(week) || { task, week, dates: [], quantity: 0, unit, producerIds: [] };
        entry.dates = [...new Set([...entry.dates, use.date])].sort();
        entry.quantity = entry.quantity === null || use.quantity === null ? null : round(entry.quantity + use.quantity);
        if (use.producerId) entry.producerIds.push(use.producerId);
        weeks.set(week, entry);
      }
      result.set(recipeId, [...(result.get(recipeId) || []), ...weeks.values()]);
    }
  }
  return result;
}

/** Scheduled preparation follows the actual dependency graph, including nested and shared batches. */
export function earlierPreparations(state: PreviewState, task: Task): Task[] {
  const byId = new Map(state.tasks.map(row => [row.id, row]));
  const generated = new Map<string, Task[]>();
  for (const row of state.tasks) {
    if (row.generatedFor) generated.set(row.generatedFor, [...(generated.get(row.generatedFor) || []), row]);
  }
  const seen = new Set([task.id]);
  const queue = [task];
  for (let index = 0; index < queue.length; index++) {
    const consumer = queue[index];
    if (consumer.stockFulfillmentId && consumer.status === "done") continue;
    const ids = [...requiredTaskIds(consumer), ...(generated.get(consumer.id) || []).map(row => row.id)];
    for (const id of ids) {
      const producer = byId.get(id);
      if (!producer || seen.has(id)) continue;
      seen.add(id);
      queue.push(producer);
    }
  }
  return queue.slice(1).filter(row => row.date < task.date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function canCombineMaterial(state: PreviewState, task: Task) {
  const item = state.items.find(item => item.id === task.itemId);
  return task.status === "planned"
    && item?.kind === "component"
    && !!item.recipeId
    && !!task.generatedFor
    && task.recordsOutput
    && !task.dependsOn
    && !task.productionStage
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
  if (consumers.some(task => !!task.productionStage || task.status !== "planned"
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
      ...(task.recipePlan?.preparation ? {recipePlan:{...task.recipePlan,preparation:{...task.recipePlan.preparation,
        choices:Object.fromEntries(Object.entries(task.recipePlan.preparation.choices).map(([id,choice])=>[id,
          choice.sourceTaskId ? {...choice,sourceTaskId:replace(choice.sourceTaskId)} : choice]))}}} : {}),
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
