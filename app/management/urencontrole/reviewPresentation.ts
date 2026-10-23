import type { FlagType, ReviewRow } from "./reviewTypes";

export type ReviewView = "attention" | "no_flags" | "all";
export const DEFAULT_REVIEW_VIEW: ReviewView = "attention";

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
    return (!options.department || source.departmentId === options.department)
      && (!options.employee || source.employeeId === options.employee)
      && (options.showNonWork || row.status !== "niet_werk");
  });
  const counts = { attention: scoped.filter(row => row.flags.length > 0).length, no_flags: scoped.filter(row => !row.flags.length).length, all: scoped.length };
  const view = options.view || DEFAULT_REVIEW_VIEW;
  const selected = scoped.filter(row => (view === "all" || (view === "attention" ? row.flags.length > 0 : !row.flags.length))
    && (!options.flagType || row.flags.some(flag => flag.type === options.flagType)));
  const priority = (row: ReviewRow) => row.flags.length ? PRIORITY.indexOf(focusFlags(row)[0].type) : PRIORITY.length;
  selected.sort((a, b) => priority(a) - priority(b) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { rows: selected, counts };
}
