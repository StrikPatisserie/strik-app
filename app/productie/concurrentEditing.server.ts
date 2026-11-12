import "server-only";
import { ProductionStoreError, ProductionRevisionError, readDocumentRevision, type ProductionDocument } from "./documents.server";
import { assertUnchanged } from "./concurrentChanges";
import type { PreviewState } from "./planning";
import type { RecepturenData } from "../bakkerij/recepturen/recepturenApi";

export async function readEditBase<T>(current: ProductionDocument<T>, key: "planner" | "recipes", revision: number): Promise<T> {
  if (!Number.isSafeInteger(revision) || revision < 1 || revision > current.revision) {
    throw new ProductionStoreError("Deze weergave is verouderd. Open het onderdeel opnieuw. Je invoer blijft bewaard.", 409);
  }
  if (revision === current.revision) return current.data;
  const base = await readDocumentRevision<T>(key, revision);
  if (!base) throw new ProductionStoreError("Deze weergave is verouderd. Open het onderdeel opnieuw. Je invoer blijft bewaard.", 409);
  return base;
}

/** Retry only a write that lost the database compare-and-swap race. */
export async function retryConcurrentSave<T>(save: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await save(); }
    catch (error) {
      if (!(error instanceof ProductionRevisionError) || attempt >= 3) throw error;
    }
  }
}

export function assertTaskCurrent(base: PreviewState, current: PreviewState, taskId: string) {
  const task = base.tasks.find(row => row.id === taskId);
  assertUnchanged(task, current.tasks.find(row => row.id === taskId));
  if (task) assertUnchanged(base.items.find(row => row.id === task.itemId), current.items.find(row => row.id === task.itemId));
  for (const key of ["timers", "completions", "stockFulfillments", "recipeDrafts", "overrides"] as const) {
    assertUnchanged(base.productionWork?.[key]?.[taskId], current.productionWork?.[key]?.[taskId]);
  }
}

/** A changed source or ingredient can change yield, units or dependencies. */
export function assertRecipeCurrent(base: RecepturenData, current: RecepturenData, recipeId: string) {
  const pending = [recipeId], visited = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const recipe = base.recipes.find(row => row.id === id);
    assertUnchanged(recipe, current.recipes.find(row => row.id === id));
    for (const line of recipe?.ingredients || []) {
      assertUnchanged(base.ingredients.find(row => row.id === line.ingredientId), current.ingredients.find(row => row.id === line.ingredientId));
    }
    for (const line of recipe?.semiFinishedItems || []) pending.push(line.semiFinishedRecipeId);
  }
  return visited;
}
