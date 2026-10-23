import { normalizeReviewShift } from "./reviewSource";
import { REVIEW_VERSION, type ReviewDataset } from "./reviewTypes";

// Fictional, deterministic examples only. No copied personnel data, API keys or live requests.
export function createHoursReviewDemo(month: string): ReviewDataset {
  const department = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";
  const make = (id: string, employee: string, day: string, start: string, end: string | null, pause = 0, comment = "", location = department, productive = true) => normalizeReviewShift({
    ShiftId: id, EmployeeId: employee, EmployeeName: `Voorbeeldmedewerker ${employee.slice(-1)}`,
    DepartmentId: location, DepartmentName: location === department ? "Voorbeeldwinkel" : "Voorbeeldbakkerij",
    StartDateTime: `${month}-${day}T${start}:00`, EndDateTime: end ? `${month}-${day}T${end}:00` : null,
    BreakCodeHours: pause / 60, Comments: comment, Comments2: "", IsProductive: productive,
    ShiftActivityName: productive ? "" : "Verlof", PlanStatusCodeId: id.startsWith("p") ? 2 : 3, IsApprovedByEmployee: false,
  }, location, 0);
  return {
    month, generatedAt: new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 2)).toISOString(), sourceVersion: REVIEW_VERSION,
    departments: [{ id: department, name: "Voorbeeldwinkel" }, { id: other, name: "Voorbeeldbakkerij" }],
    planned: [make("p1", "demo-1", "05", "08:00", "17:00"), make("p2", "demo-2", "06", "08:00", "17:00"), make("p3", "demo-3", "07", "08:00", "16:00"), make("p4", "demo-4", "08", "08:00", "17:00"), make("p5", "demo-5", "09", "08:00", "17:00"), make("p6", "demo-6", "10", "08:00", "17:00"), make("p7", "demo-7", "12", "08:00", "17:00")],
    actual: [make("a1", "demo-1", "05", "07:50", "17:09"), make("a2", "demo-2", "06", "08:07", "17:24", 0, "Geen pauze want druk"), make("a3", "demo-3", "07", "08:00", "16:00"), make("a4", "demo-4", "08", "08:00", "17:00", 30), make("a5", "demo-5", "09", "08:00", "17:00", 15), make("a6", "demo-6", "10", "08:00", null), make("a8", "demo-8", "11", "09:00", "13:00", 0, "", other), make("a9", "demo-9", "13", "08:00", "16:00", 0, "", department, false)],
    coverage: { planned: [department, other], actual: [department, other] },
    checks: [{ key: "demo", label: "Lokale voorbeeldgegevens", state: "available", message: "Deze preview gebruikt uitsluitend fictieve diensten. Er wordt geen Tamigo-verbinding gemaakt." }, { key: "approval", label: "Goedkeuring", state: "unknown", message: "Geen melding is geen automatische goedkeuring. Dagstatus en akkoord door een medewerker staan los van beoordeling door een manager." }],
  };
}
