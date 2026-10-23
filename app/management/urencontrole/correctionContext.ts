import "server-only";
import { fetchTamigoHoursReviewSource } from "../../tamigoApi";
import { dedupeReviewShifts, normalizeReviewShift, sourceRecords, isRecord } from "./reviewSource";
import { correctionRevision } from "./correctionRevision";
import { breakOptions, CorrectionError } from "./correctionRules";
import { REVIEW_VERSION, type ReviewDataset, type ReviewShift } from "./reviewTypes";
import type { BreakOption, CorrectionReference } from "./correctionTypes";

export type CorrectionContext = { raw: Record<string, unknown>; before: ReviewShift; dataset: ReviewDataset; options: BreakOption[]; complete: boolean };
export async function readCorrectionContext(reference: CorrectionReference): Promise<CorrectionContext> {
  const [withParents, withoutParents, breaks] = await Promise.allSettled([
    fetchTamigoHoursReviewSource({ kind: "departments", includeParents: true }),
    fetchTamigoHoursReviewSource({ kind: "departments", includeParents: false }),
    fetchTamigoHoursReviewSource({ kind: "breakcodes" }),
  ]);
  if (breaks.status !== "fulfilled") throw new CorrectionError("Pauzecodes zijn niet beschikbaar. Er is niets gewijzigd.", 503);
  const options = breakOptions(breaks.value);
  const departments = new Map<string, { id: string; name: string }>();
  let complete = true;
  for (const result of [withParents, withoutParents]) {
    const records = result.status === "fulfilled" ? sourceRecords(result.value) : null;
    if (!records) { complete = false; continue; }
    for (const row of records) if (typeof row.DepartmentId === "string" && typeof row.Name === "string") departments.set(row.DepartmentId.toLowerCase(), { id: row.DepartmentId.toLowerCase(), name: row.Name });
  }
  if (!departments.has(reference.departmentId)) throw new CorrectionError("Deze werklocatie is niet bevestigd door Tamigo. Haal het overzicht opnieuw op.", 409);
  const from = new Date(Date.parse(`${reference.date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.parse(`${reference.date}T12:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10);
  const dataset: ReviewDataset = { month: reference.reviewMonth, generatedAt: new Date().toISOString(), sourceVersion: REVIEW_VERSION, departments: [...departments.values()], planned: [], actual: [], coverage: { planned: [], actual: [] }, checks: [] };
  const matchingRaw: Record<string, unknown>[] = [];
  const locations = [...departments.values()];
  for (let offset = 0; offset < locations.length; offset += 4) {
    const group = locations.slice(offset, offset + 4);
    const results = await Promise.allSettled(group.map(department => fetchTamigoHoursReviewSource({ kind: "shifts", departmentId: department.id, from, to })));
    for (const [index, result] of results.entries()) {
      const department = group[index];
      const rows = result.status === "fulfilled" ? sourceRecords(result.value) : null;
      if (!rows || (result.status === "fulfilled" && isRecord(result.value) && typeof result.value.TotalCount === "number" && result.value.TotalCount > rows.length)) { complete = false; continue; }
      for (const [rowIndex, raw] of rows.entries()) {
        const code = String(raw.PlanStatusCodeId ?? "");
        if (code === "4" || code === "6") continue;
        if (!["1", "2", "3", "5"].includes(code)) { complete = false; continue; }
        const shift = normalizeReviewShift(raw, department.id, rowIndex);
        shift.sourceRevision = correctionRevision(raw);
        if (code === "1") shift.issues.push("Deze planning is een concept; geen geautoriseerde roosterbasis voor correcties.");
        if (code === "1" || code === "2") dataset.planned.push(shift);
        else {
          dataset.actual.push(shift);
          if (shift.id.toLowerCase() === reference.shiftId && shift.departmentId?.toLowerCase() === reference.departmentId) matchingRaw.push(raw);
        }
      }
      dataset.coverage.planned.push(department.id); dataset.coverage.actual.push(department.id);
    }
  }
  dataset.planned = dedupeReviewShifts(dataset.planned); dataset.actual = dedupeReviewShifts(dataset.actual);
  const before = dataset.actual.find(row => row.id.toLowerCase() === reference.shiftId && row.departmentId?.toLowerCase() === reference.departmentId);
  if (!before || !matchingRaw.length) throw new CorrectionError("De oorspronkelijke werkelijke dienst is niet teruggevonden. Er is niets gewijzigd.", 409);
  if (before.date !== reference.date || (reference.revision !== "verify" && before.sourceRevision !== reference.revision) || before.alternatives?.length) throw new CorrectionError("De dienst is inmiddels gewijzigd of heeft tegenstrijdige bronversies. Haal het overzicht opnieuw op.", 409);
  return { raw: matchingRaw[0], before, dataset, options, complete };
}
