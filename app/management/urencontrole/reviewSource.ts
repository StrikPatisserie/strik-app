import { durationMinutes, localDate, parseTime } from "./reviewTime";
import type { ReviewShift, ShiftKind } from "./reviewTypes";

type RecordValue = Record<string, unknown>;
export const isRecord = (value: unknown): value is RecordValue => Boolean(value && typeof value === "object" && !Array.isArray(value));
export function sourceRecords(value: unknown): RecordValue[] | null {
  if (Array.isArray(value)) return value.every(isRecord) ? value : null;
  if (!isRecord(value) || value.Success === false || value.success === false) return null;
  for (const key of ["Data", "data", "Result", "result", "Shifts", "Departments", "BreakCodes"]) if (Array.isArray(value[key])) {
    const rows = value[key] as unknown[];
    return rows.every(isRecord) ? rows : null;
  }
  return null;
}
function text(value: unknown) { return typeof value === "string" ? value : null; }
function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(?:[.,]\d+)?$/.test(value.trim())) return Number(value.replace(",", "."));
  return null;
}
function kindOf(row: RecordValue, activity: string): ShiftKind {
  if (/ziek|verlof|vakantie|absence|sick|vacation|holiday|maternity|parental/i.test(activity)) return "absence";
  if (row.IsProductive === true) return "work";
  if (row.IsProductive === false) return "other";
  return "unknown";
}
export function normalizeReviewShift(row: RecordValue, sourceDepartment: string, index: number): ReviewShift {
  const start = parseTime(row.StartDateTime ?? row.StartTime);
  const end = parseTime(row.EndDateTime ?? row.EndTime);
  const breakHours = number(row.BreakCodeHours);
  const reported = number(row.ShiftHours);
  const activity = text(row.ShiftActivityName) || text(row.ShiftActivityShortName) || "";
  const kind = kindOf(row, activity);
  const issues: string[] = [];
  const shiftId = text(row.ShiftId);
  const employeeId = text(row.EmployeeId);
  if (!shiftId || !employeeId || employeeId === "00000000-0000-0000-0000-000000000000") issues.push("Medewerker-ID of dienst-ID ontbreekt; identiteit kan niet betrouwbaar worden bepaald.");
  if (!text(row.DepartmentId)) issues.push("De daadwerkelijke werklocatie ontbreekt. De opvraagafdeling is hiervoor niet als vervanging gebruikt.");
  if (start.issue && start.issue !== "missing") issues.push(`Starttijd is ${start.issue === "ambiguous" ? "dubbelzinnig door de wintertijd" : start.issue === "nonexistent" ? "niet bestaand door de zomertijd of een ongeldige datum" : "ongeldig"}.`);
  if (end.issue && end.issue !== "missing") issues.push(`Eindtijd is ${end.issue === "ambiguous" ? "dubbelzinnig door de wintertijd" : end.issue === "nonexistent" ? "niet bestaand door de zomertijd of een ongeldige datum" : "ongeldig"}.`);
  if (Array.isArray(row.ShiftActivities) && row.ShiftActivities.length) issues.push("De dienst bevat meerdere activiteiten; de verdeling moet handmatig worden gecontroleerd.");
  const gross = durationMinutes(start, end);
  if (gross !== null && (gross < 0 || (gross === 0 && kind === "work"))) issues.push("Eindtijd ligt niet na de starttijd; mogelijke typefout. De datum is niet automatisch aangepast.");
  if (breakHours !== null && breakHours < 0) issues.push("Negatieve pauzeduur in de bron.");
  const rawDate = text(row.Date)?.slice(0, 10) || "";
  const fallbackDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && Number.isFinite(Date.parse(rawDate)) && new Date(rawDate).toISOString().slice(0, 10) === rawDate ? rawDate : "";
  return {
    id: shiftId || `missing-id:${sourceDepartment}:${index}`,
    employeeId, employeeName: text(row.EmployeeName) || "Medewerkernaam niet beschikbaar",
    departmentId: text(row.DepartmentId), departmentName: text(row.DepartmentName) || "Werklocatie onbekend", sourceDepartments: [sourceDepartment],
    start, end, date: start.ms !== null ? localDate(start.ms) : (fallbackDate || (end.ms !== null ? localDate(end.ms) : "")),
    breakMinutes: breakHours !== null && breakHours >= 0 ? breakHours * 60 : null,
    breakCode: text(row.BreakCode), reportedNetMinutes: reported !== null ? reported * 60 : null,
    comments: [text(row.Comments ?? row.Comment), text(row.Comments2)],
    kind, activity,
    employeeApproved: typeof row.IsApprovedByEmployee === "boolean" ? row.IsApprovedByEmployee : null,
    planStatusCode: row.PlanStatusCodeId === null || row.PlanStatusCodeId === undefined ? null : String(row.PlanStatusCodeId), issues,
  };
}
export function dedupeReviewShifts(shifts: ReviewShift[]) {
  const byId = new Map<string, ReviewShift>();
  const fingerprint = (shift: ReviewShift) => JSON.stringify([shift.employeeId, shift.departmentId, shift.start.raw, shift.end.raw, shift.breakMinutes, shift.reportedNetMinutes, shift.comments, shift.kind, shift.activity, shift.planStatusCode, shift.employeeApproved]);
  for (const shift of shifts) {
    const existing = byId.get(shift.id);
    if (!existing) { byId.set(shift.id, { ...shift, sourceDepartments: [...shift.sourceDepartments], issues: [...shift.issues] }); continue; }
    const issues = [...existing.issues];
    const conflict = fingerprint(existing) !== fingerprint(shift);
    if (conflict) issues.push("Dezelfde dienst-ID heeft tegenstrijdige brongegevens; slechts eenmaal opgenomen en geen automatisch voorstel.");
    byId.set(shift.id, { ...existing, sourceDepartments: [...new Set([...existing.sourceDepartments, ...shift.sourceDepartments])], issues: [...new Set(issues)], ...(conflict ? { alternatives: [...(existing.alternatives || []), { ...shift, alternatives: undefined }] } : {}) });
  }
  return [...byId.values()];
}
