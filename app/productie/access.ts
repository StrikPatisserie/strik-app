import { canAccessBakkerijIjsChocolade, canAccessBakkerijPatisserie, hasFullAccess } from "../lib/auth/access";
import type { UserProfile } from "../lib/supabase/types";
import { DEPARTMENTS, type DepartmentId, type PreviewState, transitionTask } from "./planning";

export function productionDepartments(profile: UserProfile | null): DepartmentId[] {
  if (!profile?.active) return [];
  return DEPARTMENTS.filter(d => hasFullAccess(profile) || (d.board === "ijs" || d.board === "chocolade" ? canAccessBakkerijIjsChocolade(profile) : canAccessBakkerijPatisserie(profile))).map(d => d.id);
}
export function visibleWorkspace(state: PreviewState): PreviewState {
  // Existing production users can coordinate work and dependencies across the
  // production departments. Editing is limited to their assigned departments.
  // Financial/HR data is never part of this document.
  return state;
}
export function mergeWorkspaceForEmployee(current: PreviewState, incoming: PreviewState, allowed: DepartmentId[]): PreviewState {
  if (JSON.stringify(current.items) !== JSON.stringify(incoming.items)) throw Error("Alleen managers kunnen onderdelen aanpassen.");
  const visible = current.tasks;
  if (visible.length !== incoming.tasks.length || new Set(incoming.tasks.map(t => t.id)).size !== visible.length) throw Error("Alleen managers kunnen taken toevoegen of verwijderen.");
  let tasks = current.tasks;
  for (const change of incoming.tasks) {
    const original = visible.find(t => t.id === change.id);
    if (!original || JSON.stringify({ ...original, status: change.status }) !== JSON.stringify(change)) throw Error("Alleen de taakstatus van je eigen afdeling kan worden gewijzigd.");
    if (original.status !== change.status && !allowed.includes(original.departmentId)) throw Error("Je kunt alleen taken in je eigen afdeling wijzigen.");
    if (original.status !== change.status) tasks = transitionTask(tasks, original.id, change.status);
  }
  return { ...current, tasks };
}
