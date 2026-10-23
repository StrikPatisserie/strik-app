import { durationMinutes, formatMinutes, localDate, localParts, monthBounds, parseTime } from "./reviewTime";
import { isRecord, sourceRecords } from "./reviewSource";
import type { ReviewShift } from "./reviewTypes";
import type { BreakOption, CorrectionDraft, CorrectionReference, CorrectionValues, TamigoShiftUpdate } from "./correctionTypes";

export class CorrectionError extends Error {
  constructor(message: string, readonly status = 400) { super(message); this.name = "CorrectionError"; }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validUuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value) && value !== "00000000-0000-0000-0000-000000000000"; }
export function correctionReference(value: unknown): CorrectionReference {
  if (!isRecord(value) || !validUuid(value.shiftId) || !validUuid(value.departmentId) || typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(Date.parse(value.date)) || new Date(value.date).toISOString().slice(0, 10) !== value.date || typeof value.revision !== "string" || !/^[a-f0-9]{64}$/.test(value.revision)) throw new CorrectionError("Deze dienst mist een geldige bronversie. Haal het overzicht opnieuw op.");
  if (typeof value.reviewMonth !== "string") throw new CorrectionError("De controlemaand ontbreekt.");
  try {
    const bounds = monthBounds(value.reviewMonth);
    if (value.date < bounds.fetchFrom || value.date >= bounds.fetchTo) throw new Error();
  } catch { throw new CorrectionError("De dienst valt buiten de gekozen controlemaand."); }
  return { shiftId: value.shiftId.toLowerCase(), departmentId: value.departmentId.toLowerCase(), date: value.date, reviewMonth: value.reviewMonth, revision: value.revision };
}
export function correctionDraft(value: unknown): CorrectionDraft {
  if (!isRecord(value) || typeof value.start !== "string" || typeof value.end !== "string" || value.start.length > 50 || value.end.length > 50 || typeof value.breakCode !== "string" || value.breakCode.length > 80 || typeof value.reason !== "string" || value.reason.trim().length < 3 || value.reason.length > 1000 || !["proposal", "manual"].includes(String(value.mode))) throw new CorrectionError("Vul begin, einde, pauze en een korte reden voor de correctie in.");
  return { start: value.start, end: value.end, breakCode: value.breakCode, reason: value.reason.trim(), mode: value.mode as CorrectionDraft["mode"] };
}
export function breakOptions(value: unknown): BreakOption[] {
  const rows = sourceRecords(value);
  if (!rows) throw new CorrectionError("Pauzecodes kunnen niet worden gecontroleerd. Er is niets gewijzigd.", 503);
  const options: BreakOption[] = [{ code: "", minutes: 0, minimumMinutes: 0, label: "Geen pauze · 0 min" }];
  for (const row of rows) {
    if (typeof row.Code !== "string" || !row.Code || row.Disabled !== false || row.OverridenByWageRateTypeConfig !== false || !Array.isArray(row.SubBreakConfigs) || row.SubBreakConfigs.length) continue;
    const hours = row.Hours === null || row.Hours === "" ? NaN : Number(row.Hours);
    const minimum = row.MinimumHours === null || row.MinimumHours === "" ? NaN : Number(row.MinimumHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 4 || !Number.isFinite(minimum) || minimum < 0) continue;
    const minutes = hours * 60;
    if (options.some(option => option.code === row.Code)) throw new CorrectionError("Pauzecodes bevatten dubbele codes. Controleer dit in Tamigo.", 503);
    options.push({ code: row.Code, minutes, minimumMinutes: minimum * 60, label: `${Number(minutes.toFixed(2))} min pauze${minimum ? ` · vanaf ${formatMinutes(minimum * 60)} bruto` : ""}` });
  }
  return options;
}
export function editableTime(iso: string | null | undefined) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "";
  const p = localParts(Date.parse(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function correctionValues(draft: CorrectionDraft, before: ReviewShift, options: BreakOption[]): CorrectionValues {
  const start = parseTime(draft.start), end = parseTime(draft.end);
  if (!start.iso || !end.iso || start.ms === null || end.ms === null) throw new CorrectionError("Begin of einde is ongeldig of dubbelzinnig door de zomer-/wintertijd. Corrigeer een dubbelzinnige tijd in Tamigo.");
  if (start.ms % 60000 || end.ms % 60000) throw new CorrectionError("Gebruik hele minuten voor een correctie.");
  if (before.start.ms === null || localDate(start.ms) !== before.date) throw new CorrectionError("De startdatum moet gelijk blijven aan die van de oorspronkelijke dienst. Een dienst verplaatsen doe je in Tamigo.");
  const gross = (end.ms - start.ms) / 60000;
  if (gross <= 0 || gross > 1440) throw new CorrectionError("Controleer de datums: een correctie moet langer dan nul en maximaal 24 uur zijn.");
  const option = options.find(item => item.code === draft.breakCode);
  if (!option) throw new CorrectionError("Kies een ondersteunde Tamigo-pauzecode. De pauze wordt niet als losse aftrek nogmaals toegepast.");
  if (gross < option.minimumMinutes) throw new CorrectionError("Deze pauzecode geldt in Tamigo pas vanaf een langere bruto dienst. Kies een geldige code of controleer de dienst in Tamigo.");
  if (option.minutes >= gross) throw new CorrectionError("De pauze moet korter zijn dan de dienst.");
  return { start: start.iso, end: end.iso, breakCode: option.code, breakMinutes: option.minutes, netMinutes: gross - option.minutes };
}
function populated(value: unknown) { return value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0); }
export function sourceWriteBlockers(raw: Record<string, unknown>, shift: ReviewShift) {
  const blockers: string[] = [];
  if (!validUuid(shift.id) || !validUuid(shift.employeeId) || !validUuid(shift.departmentId)) blockers.push("Dienst-, medewerker- of afdelings-ID ontbreekt.");
  if (shift.kind !== "work") blockers.push("Verlof, ziekte en andere activiteiten worden hier niet aangepast.");
  if (shift.planStatusCode !== "3") blockers.push("Alleen een werkelijke, niet gesloten dienst kan worden aangepast.");
  if (shift.issues.length || shift.alternatives?.length) blockers.push("De bron is onduidelijk. Controleer deze dienst in Tamigo.");
  if (shift.breakMinutes === null) blockers.push("De oorspronkelijke pauzeduur is onbekend.");
  const gross = durationMinutes(shift.start, shift.end);
  if (gross !== null && gross > 1440) blockers.push("De oorspronkelijke dienst is langer dan 24 uur. Controleer deze datumafwijking rechtstreeks in Tamigo.");
  if (gross !== null && shift.breakMinutes !== null && shift.reportedNetMinutes !== null && Math.abs(gross - shift.breakMinutes - shift.reportedNetMinutes) > 1) blockers.push("Het oorspronkelijke netto urentotaal wijkt af van tijden en pauze. Controleer deze dienst in Tamigo.");
  const activitySupported = raw.ShiftActivityId === null || (typeof raw.ShiftActivityId === "string" && UUID.test(raw.ShiftActivityId));
  const comment = raw.Comments ?? raw.Comment;
  if (typeof raw.IsAvailable !== "boolean" || typeof raw.IsExchange !== "boolean" || !activitySupported || (comment !== null && comment !== undefined && typeof comment !== "string")) blockers.push("Niet alle vereiste dienstvelden zijn beschikbaar voor veilig terugschrijven.");
  // The documented update DTO cannot faithfully represent these extra fields.
  if (populated(raw.Comments2) || (populated(raw.AbsencePercentage) && Number(raw.AbsencePercentage) !== 0) || ["ShiftActivities", "Tasks", "CompetencyId", "SkillExternalId", "BreakStartTime", "ActivityId", "GroupId"].some(key => populated(raw[key]))) blockers.push("Deze dienst heeft extra opmerkingen, activiteiten of details die de gedocumenteerde schrijffunctie niet volledig ondersteunt. Pas deze aan in Tamigo.");
  return blockers;
}
export function updatePayload(raw: Record<string, unknown>, shift: ReviewShift, after: CorrectionValues): TamigoShiftUpdate {
  if (sourceWriteBlockers(raw, shift).length) throw new CorrectionError("De bron ondersteunt geen veilige correctie.", 409);
  function microsoftDate(iso: string) {
    const ms = Date.parse(iso), parts = localParts(ms);
    const offset = Math.round((Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - ms) / 60000);
    const sign = offset < 0 ? "-" : "+";
    const suffix = `${sign}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}${String(Math.abs(offset) % 60).padStart(2, "0")}`;
    return `/Date(${ms}${suffix})/`;
  }
  return { ShiftId: shift.id, EmployeeId: shift.employeeId!, StartTime: microsoftDate(after.start), EndTime: microsoftDate(after.end), BreakCode: after.breakCode, Comment: shift.comments[0], IsAvailable: raw.IsAvailable as boolean, IsExchange: raw.IsExchange as boolean, ShiftActivityId: typeof raw.ShiftActivityId === "string" ? raw.ShiftActivityId : null };
}
export function originalNet(shift: ReviewShift) {
  const gross = durationMinutes(shift.start, shift.end);
  return shift.reportedNetMinutes ?? (gross !== null && shift.breakMinutes !== null ? gross - shift.breakMinutes : null);
}
export function overlaps(after: CorrectionValues, shift: ReviewShift, other: ReviewShift) {
  return shift.id !== other.id && shift.employeeId === other.employeeId && other.kind === "work" && other.start.ms !== null && other.end.ms !== null && Date.parse(after.start) < other.end.ms && Date.parse(after.end) > other.start.ms;
}
export function sameValues(shift: ReviewShift, values: CorrectionValues) {
  return shift.start.iso === values.start && shift.end.iso === values.end && (shift.breakCode || "") === values.breakCode && shift.breakMinutes !== null && Math.abs(shift.breakMinutes - values.breakMinutes) < .001 && shift.reportedNetMinutes !== null && Math.abs(shift.reportedNetMinutes - values.netMinutes) < .01;
}
