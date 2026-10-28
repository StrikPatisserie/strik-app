import type { FlagType, ReviewRow, ReviewShift } from "./reviewTypes";

export type ReviewView = "attention" | "no_flags" | "all" | "unassigned";
export const DEFAULT_REVIEW_VIEW: ReviewView = "attention";

export function visibleReviewDepartment(name: string) {
  const normalized = name.trim().toLocaleLowerCase("nl").replace(/\s*[-–—]\s*/g, " - ").replace(/\s+/g, " ");
  return !["winkel - wijchen", "winkel wijchen", "winkels"].includes(normalized);
}
export function missingReviewEmployee(shift: ReviewShift) {
  return !shift.employeeId || shift.employeeId === "00000000-0000-0000-0000-000000000000" || !shift.employeeName.trim() || shift.employeeName === "Medewerkernaam niet beschikbaar";
}

// Incomplete/conflicting sources need a decision before routine time rounding.
const PRIORITY: FlagType[] = [
  "bron_onduidelijk", "toegang", "eindtijd_ontbreekt", "overlap", "planning_onduidelijk",
  "uren_ontbreken", "planning_ontbreekt", "pauze_onduidelijk", "pauze_ontbreekt",
  "pauze_kort", "pauze_uitzondering", "dienst_lang", "dienst_kort", "locatie",
  "start_laat", "start_vroeg", "einde_laat", "einde_vroeg", "afronding", "activiteit",
];
export function focusFlags(row: ReviewRow) {
  return [...row.flags].sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type));
}
export function selectReviewRows(rows: ReviewRow[], options: {
  department?: string; employee?: string; flagType?: string; showNonWork?: boolean; view?: ReviewView;
} = {}) {
  const scoped = rows.filter(row => {
    const source = row.actual || row.planned!;
    return visibleReviewDepartment(source.departmentName)
      && (!options.department || source.departmentId === options.department)
      && (!options.employee || source.employeeId === options.employee)
      && (options.showNonWork || row.status !== "niet_werk");
  });
  const assigned = scoped.filter(row => !missingReviewEmployee(row.actual || row.planned!));
  const unassigned = scoped.filter(row => missingReviewEmployee(row.actual || row.planned!));
  const counts = { attention: assigned.filter(row => row.flags.length > 0).length, no_flags: assigned.filter(row => !row.flags.length).length, all: assigned.length, unassigned: unassigned.length };
  const view = options.view || DEFAULT_REVIEW_VIEW;
  const selected = (view === "unassigned" ? unassigned : assigned).filter(row => (view === "unassigned" || view === "all" || (view === "attention" ? row.flags.length > 0 : !row.flags.length))
    && (!options.flagType || row.flags.some(flag => flag.type === options.flagType)));
  const priority = (row: ReviewRow) => row.flags.length ? PRIORITY.indexOf(focusFlags(row)[0].type) : PRIORITY.length;
  selected.sort((a, b) => priority(a) - priority(b) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { rows: selected, counts };
}
