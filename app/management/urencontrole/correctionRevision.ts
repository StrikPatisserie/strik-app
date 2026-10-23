import "server-only";
import { createHash } from "node:crypto";

// Stable across department references; do not fingerprint names or payroll fields.
const FIELDS = ["ShiftId", "EmployeeId", "DepartmentId", "StartDateTime", "EndDateTime", "StartTime", "EndTime", "Comments", "Comment", "Comments2", "BreakCode", "BreakCodeHours", "BreakCodeId", "BreakStartTime", "ShiftHours", "PlanId", "PlanStatusCodeId", "IsProductive", "ShiftActivityId", "ShiftActivityName", "ShiftActivityShortName", "ShiftActivities", "ActivityId", "AbsencePercentage", "IsAvailable", "IsExchange", "IsApprovedByEmployee", "CompetencyId", "SkillExternalId", "Tasks", "GroupId", "OrganizationalUnitId"];
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export function correctionRevision(raw: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(canonical(Object.fromEntries(FIELDS.filter(key => Object.hasOwn(raw, key)).map(key => [key, raw[key]]))))).digest("hex");
}
