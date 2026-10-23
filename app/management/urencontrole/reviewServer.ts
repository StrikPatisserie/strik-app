import "server-only";
import { fetchTamigoHoursReviewSource, getKnownTamigoHoursReviewDepartments, getTamigoStatusCode } from "../../tamigoApi";
import { dedupeReviewShifts, isRecord, normalizeReviewShift, sourceRecords } from "./reviewSource";
import { monthBounds } from "./reviewTime";
import { REVIEW_VERSION, type DayStatus, type ReviewDataset, type SourceCheck } from "./reviewTypes";
import { correctionRevision } from "./correctionRevision";

function errorCheck(key: string, label: string, error: unknown): SourceCheck {
  const status = getTamigoStatusCode(error);
  return { key, label, state: "unavailable", httpStatus: status, message: status === 401 || status === 403 ? `Geen API-toegang (HTTP ${status}). Controleer de bestaande Tamigo-applicatieconfiguratie en rechten.` : "Tamigo kon deze bron niet leveren. Probeer opnieuw; ontbrekende gegevens worden niet als nul behandeld." };
}
export async function getTamigoHoursReviewMonth(month: string): Promise<ReviewDataset> {
  const bounds = monthBounds(month);
  const data: ReviewDataset = { month, generatedAt: new Date().toISOString(), sourceVersion: REVIEW_VERSION, departments: [], planned: [], actual: [], coverage: { planned: [], actual: [] }, checks: [] };
  const departments = new Map<string, { id: string; name: string }>();
  const metadata = await Promise.allSettled([true, false].map(includeParents => fetchTamigoHoursReviewSource({ kind: "departments", includeParents })));
  for (const [index, result] of metadata.entries()) {
    const key = `departments-${index}`, label = `Afdelingen (${index === 0 ? "met bovenliggende afdelingen" : "zonder bovenliggende afdelingen"})`;
    if (result.status === "rejected") { data.checks.push(errorCheck(key, label, result.reason)); continue; }
    const rows = sourceRecords(result.value);
    if (!rows) { data.checks.push({ key, label, state: "unavailable", message: "Onbekend API-antwoord voor afdelingen." }); continue; }
    for (const row of rows) if (typeof row.DepartmentId === "string" && typeof row.Name === "string") departments.set(row.DepartmentId, { id: row.DepartmentId, name: row.Name });
    data.checks.push({ key, label, state: "available", rows: rows.length, message: `${rows.length} afdelingen opgehaald; beide lijsten worden samengevoegd om historische verwijzingen te behouden.` });
  }
  if (!departments.size) {
    for (const department of getKnownTamigoHoursReviewDepartments()) departments.set(department.id, department);
    data.checks.push({ key: "departments-fallback", label: "Volledigheid afdelingen", state: "partial", message: "Alleen de locaties uit de bestaande koppeling worden gebruikt. Andere afdelingen kunnen ontbreken; de volledige afdelingenlijst is niet beschikbaar." });
  }
  data.departments = [...departments.values()].sort((a, b) => a.name.localeCompare(b.name, "nl"));
  const breakResult = await Promise.allSettled([fetchTamigoHoursReviewSource({ kind: "breakcodes" })]);
  if (breakResult[0].status === "fulfilled") {
    const codes = sourceRecords(breakResult[0].value);
    data.checks.push({ key: "breakcodes", label: "Pauzecodes", state: codes ? "available" : "unknown", rows: codes?.length, message: codes ? `${codes.length} pauzecodes beschikbaar. Alleen de geregistreerde BreakCodeHours wordt als pauzeduur gebruikt; een code wordt niet nogmaals afgetrokken.` : "Pauzecodes niet leesbaar; codebetekenis wordt niet verzonnen." });
  } else data.checks.push(errorCheck("breakcodes", "Pauzecodes", breakResult[0].reason));
  // Bounded concurrency; one <= 34-day read per department, including boundary nights.
  for (let offset = 0; offset < data.departments.length; offset += 4) {
    const group = data.departments.slice(offset, offset + 4);
    const results = await Promise.allSettled(group.map(department => fetchTamigoHoursReviewSource({ kind: "shifts", departmentId: department.id, from: bounds.fetchFrom, to: bounds.fetchTo })));
    for (const [index, result] of results.entries()) {
      const department = group[index], key = `shifts-${department.id}`;
      if (result.status === "rejected") { data.checks.push(errorCheck(key, department.name, result.reason)); continue; }
      const records = sourceRecords(result.value);
      if (!records) { data.checks.push({ key, label: department.name, state: "unavailable", message: "Onbekend dienstenantwoord; niet als een lege maand beschouwd." }); continue; }
      const unknownCodes = new Set<string>();
      const fields = new Set<string>();
      for (const [rowIndex, raw] of records.entries()) {
        for (const field of ["ShiftId", "EmployeeId", "DepartmentId", "StartDateTime", "EndDateTime", "ShiftHours", "BreakCodeHours", "BreakCode", "Comments", "Comments2", "IsProductive", "ShiftActivityName", "IsApprovedByEmployee", "PlanStatusCodeId"]) if (Object.hasOwn(raw, field)) fields.add(field);
        const code = String(raw.PlanStatusCodeId ?? "");
        if (code === "4" || code === "6") continue;
        const row = normalizeReviewShift(raw, department.id, rowIndex);
        row.sourceRevision = correctionRevision(raw);
        if (code === "1") row.issues.push("Deze planning is een concept; geen geautoriseerde roosterbasis voor correcties.");
        if (code === "1" || code === "2") data.planned.push(row);
        else if (code === "3" || code === "5") data.actual.push(row);
        else { unknownCodes.add(code || "ontbreekt"); data.actual.push({ ...row, kind: "unknown", issues: [...row.issues, "Onbekende dienststatus; niet als gewerkte dienst aangenomen."] }); }
      }
      const truncated = isRecord(result.value) && typeof result.value.TotalCount === "number" && result.value.TotalCount > records.length;
      if (!unknownCodes.size && !truncated) { data.coverage.planned.push(department.id); data.coverage.actual.push(department.id); }
      data.checks.push({ key, label: department.name, state: unknownCodes.size || truncated ? "partial" : "available", rows: records.length, fields: [...fields].sort(), message: truncated ? "API-antwoord lijkt afgekapt. Ontbrekende diensten kunnen niet worden vastgesteld." : unknownCodes.size ? `Onbekende dienststatus (${[...unknownCodes].join(", ")}); volledigheid niet bevestigd.` : `${records.length} bronregels gelezen. Planning (1/2), werkelijk (3/5); originele versies (4) en klokregels (6) worden niet dubbel als werk geteld.` });
    }
  }
  data.planned = dedupeReviewShifts(data.planned);
  data.actual = dedupeReviewShifts(data.actual);
  const sample = data.actual.find(row => row.departmentId && row.date);
  if (sample) {
    const status = await getTamigoHoursDayStatus(sample.departmentId!, sample.date);
    data.checks.push({ key: "day-status-access", label: "Toegang tot open/gesloten dagstatus", state: status.state === "unknown" ? (status.httpStatus === 401 || status.httpStatus === 403 ? "unavailable" : "unknown") : "available", httpStatus: status.httpStatus, message: status.state === "unknown" ? status.message : "Dagstatus is voor één steekproefdatum beschikbaar. Per dienst kan de betreffende dagstatus apart worden opgevraagd; andere dagen zijn hiermee niet bevestigd." });
  }
  data.checks.push({ key: "manual-origin", label: "Herkomst registratie", state: "unknown", message: "De diensten-API bevestigt werkelijke uren, maar niet of deze handmatig of via een klok zijn ingevoerd. Beide worden niet als bewezen handmatige invoer aangeduid." });
  data.checks.push({ key: "approval", label: "Goedkeuring", state: "unknown", message: "IsApprovedByEmployee is medewerkerakkoord, geen managersgoedkeuring. Dienststatus 5 betekent gesloten volgens de documentatie; status 3 bevestigt op zichzelf geen open of goedgekeurde dag." });
  return data;
}
export async function getTamigoHoursDayStatus(departmentId: string, date: string): Promise<DayStatus> {
  try {
    const raw = await fetchTamigoHoursReviewSource({ kind: "day-status", departmentId, date });
    if (isRecord(raw) && raw.Success === true && [true, false, "true", "false"].includes(raw.Message as boolean | string)) return { state: raw.Message === true || raw.Message === "true" ? "closed" : "open", message: "Dagstatus rechtstreeks uit Tamigo. Dit is geen goedkeuring van een Strik-correctievoorstel.", employeeApprovalIsNotManagerApproval: true };
    return { state: "unknown", message: "Onbekend API-antwoord voor de dagstatus; niet als open of goedgekeurd aangenomen.", employeeApprovalIsNotManagerApproval: true };
  } catch (error) {
    const status = getTamigoStatusCode(error);
    return { state: "unknown", message: `Dagstatus niet beschikbaar${status === 401 || status === 403 ? ` (HTTP ${status}; toegang ontbreekt)` : ""}. Open/gesloten en managersgoedkeuring zijn niet bevestigd.`, employeeApprovalIsNotManagerApproval: true, httpStatus: status };
  }
}
