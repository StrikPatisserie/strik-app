import type { DemoRecipe, PreviewState, Task } from "./planning";
import { learnedWorkEstimate, workView } from "./productionWork";

export type TaskWorkSummary = {
  minutes?: number;
  crewSize?: number;
  laborMinutes?: number;
  fromStock: boolean;
};

export type DepartmentDayWork = {
  totalTaskCount: number;
  doneCount: number;
  doneLaborMinutes: number;
  doneMissingCount: number;
  plannedLaborMinutes: number;
  plannedMissingCount: number;
};

function validCrewSize(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 20;
}

function positiveMinutes(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

/** Current completions are authoritative. Historical work logs can also contain
 * reopened productions, so they never supply a completed task's current time. */
export function taskWorkSummary(state: PreviewState, task: Task): TaskWorkSummary {
  if (task.status !== "done") return { fromStock: false };
  if (task.stockFulfillmentId) return { fromStock: true, laborMinutes: 0 };

  const completion = state.productionWork?.completions?.[task.id];
  const minutes = positiveMinutes(completion?.minutes) ? completion.minutes : undefined;
  const crewSize = validCrewSize(completion?.crewSize) ? completion.crewSize : undefined;
  const laborMinutes = minutes !== undefined && crewSize !== undefined
    ? Math.round(minutes * crewSize * 1000000) / 1000000
    : positiveMinutes(completion?.laborMinutes) ? completion.laborMinutes : undefined;

  return { minutes, crewSize, laborMinutes, fromStock: false };
}

/** Aggregate the full workspace, independent of the visible status/search filter.
 * Explicit estimates use one person until the active task has a recorded crew.
 * Otherwise, confirmed recipe measurements provide their existing labor estimate. */
export function departmentDayWork(state: PreviewState, recipes?: DemoRecipe[]): Map<string, DepartmentDayWork> {
  const view = recipes ? workView(state, recipes) : undefined;
  const estimates = new Map<string, number | undefined>();
  const totals = new Map<string, DepartmentDayWork>();
  for (const task of state.tasks) {
    const key = `${task.departmentId}:${task.date}`;
    let total = totals.get(key);
    if (!total) {
      total = { totalTaskCount: 0, doneCount: 0, doneLaborMinutes: 0, doneMissingCount: 0, plannedLaborMinutes: 0, plannedMissingCount: 0 };
      totals.set(key, total);
    }
    total.totalTaskCount++;
    if (task.status === "done") {
      total.doneCount++;
      const summary = taskWorkSummary(state, task);
      if (summary.laborMinutes === undefined) total.doneMissingCount++;
      else total.doneLaborMinutes += summary.laborMinutes;
    } else if (task.minutes !== undefined && Number.isFinite(task.minutes) && task.minutes >= 0) {
      const crewSize = task.status === "active" ? state.productionWork?.timers?.[task.id]?.crewSize : undefined;
      total.plannedLaborMinutes += task.minutes * (validCrewSize(crewSize) ? crewSize : 1);
    } else {
      let estimate: number | undefined;
      if (view && !view.overrides[task.id]) {
        const estimateKey = JSON.stringify([task.itemId, task.operation.trim().toLowerCase(), task.quantity]);
        if (!estimates.has(estimateKey)) {
          estimates.set(estimateKey, learnedWorkEstimate(view, task.itemId, task.operation, task.quantity)?.laborMinutes);
        }
        estimate = estimates.get(estimateKey);
      }
      if (estimate === undefined) total.plannedMissingCount++;
      else total.plannedLaborMinutes += estimate;
    }
  }
  return totals;
}
