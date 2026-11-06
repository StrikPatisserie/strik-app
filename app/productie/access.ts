import { canAccessBakkerijIjsChocolade, canAccessBakkerijPatisserie, hasFullAccess } from "../lib/auth/access";
import type { UserProfile } from "../lib/supabase/types";
import { DEPARTMENTS, type DepartmentId, type PreviewState } from "./planning";

export function productionDepartments(profile: UserProfile | null): DepartmentId[] {
  if (!profile?.active) return [];
  const all = hasFullAccess(profile) || Boolean(profile.permissions?.["productie.manage"]);
  return DEPARTMENTS.filter(d => all || (d.board === "ijs" || d.board === "chocolade" ? canAccessBakkerijIjsChocolade(profile) : canAccessBakkerijPatisserie(profile))).map(d => d.id);
}
export function visibleWorkspace(state: PreviewState): PreviewState {
  // Existing production users can coordinate work and dependencies across the
  // production departments. Editing is limited to their assigned departments.
  // Financial/HR data is never part of this document.
  return state;
}
export function mergeWorkspaceForEmployee(current: PreviewState, incoming: PreviewState, allowed: DepartmentId[]): PreviewState {
  // Other departments stay visible for coordination; edits stay in scope.
  for (const key of ["items", "tasks"] as const) {
    for (const original of current[key]) {
      const changed = incoming[key].find(row => row.id === original.id);
      if (JSON.stringify(original) === JSON.stringify(changed)) continue;
      if (!allowed.includes(original.departmentId) || (changed && !allowed.includes(changed.departmentId))) throw Error("Je kunt alleen je eigen productieafdelingen wijzigen.");
    }
    for (const added of incoming[key]) {
      if (!current[key].some(row => row.id === added.id) && !allowed.includes(added.departmentId)) throw Error("Kies een eigen productieafdeling.");
    }
  }
  return incoming;
}
