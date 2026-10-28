export const REVIEW_VERSION = "strik-uren-v1";
export const TIME_ZONE = "Europe/Amsterdam";
export type ShiftKind = "work" | "absence" | "other" | "unknown";
export type TimeValue = { raw: string | null; iso: string | null; ms: number | null; issue: "missing" | "invalid" | "ambiguous" | "nonexistent" | null };
export type ReviewShift = {
  id: string;
  employeeId: string | null;
  employeeName: string;
  departmentId: string | null;
  departmentName: string;
  sourceDepartments: string[];
  start: TimeValue;
  end: TimeValue;
  date: string;
  breakMinutes: number | null;
  breakCode: string | null;
  reportedNetMinutes: number | null;
  comments: [string | null, string | null];
  kind: ShiftKind;
  activity: string;
  employeeApproved: boolean | null;
  planStatusCode: string | null;
  issues: string[];
  alternatives?: ReviewShift[];
  sourceRevision?: string;
};
export type ReviewThresholds = {
  deviationMinutes: number;
  shortMinutes: number;
  longMinutes: number;
  matchingMinutes: number;
  netToleranceMinutes: number;
  breakEnabled: boolean;
  fullDayMinutes: number;
  minimumBreakMinutes: number;
};
export type ReviewConfig = ReviewThresholds & { departmentOverrides: Record<string, Partial<ReviewThresholds>> };
export const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
  deviationMinutes: 1,
  shortMinutes: 60,
  longMinutes: 720,
  matchingMinutes: 240,
  netToleranceMinutes: 1,
  breakEnabled: true,
  fullDayMinutes: 480,
  minimumBreakMinutes: 30,
  departmentOverrides: {},
};
export const FLAG_LABELS = {
  start_vroeg: "Eerder begonnen", start_laat: "Later begonnen", einde_vroeg: "Eerder gestopt", einde_laat: "Later gestopt",
  planning_ontbreekt: "Geen planning", planning_onduidelijk: "Onduidelijke planning", uren_ontbreken: "Uren ontbreken", eindtijd_ontbreekt: "Eindtijd ontbreekt",
  pauze_ontbreekt: "Pauze ontbreekt", pauze_kort: "Pauze korter dan minimum", pauze_uitzondering: "Verklaarde pauze-uitzondering", pauze_onduidelijk: "Pauze ter beoordeling",
  dienst_kort: "Korte dienst", dienst_lang: "Lange dienst", overlap: "Overlap", bron_onduidelijk: "Brongegevens controleren", activiteit: "Verlof / andere activiteit",
  afronding: "Tijdvoorstel", toegang: "API-gegevens ontbreken", locatie: "Andere werklocatie",
} as const;
export type FlagType = keyof typeof FLAG_LABELS;
export type ReviewFlag = { type: FlagType; message: string };
export type ReviewProposal = { start: string; end: string; breakMinutes: number; netMinutes: number; reasons: string[]; rules: ReviewThresholds; basis?: "planning" };
export type ReviewRow = {
  id: string;
  date: string;
  planned: ReviewShift | null;
  actual: ReviewShift | null;
  candidates: ReviewShift[];
  flags: ReviewFlag[];
  originalNetMinutes: number | null;
  originalNetSource: "Tamigo" | "berekend" | "onbekend";
  proposal: ReviewProposal | null;
  deltaMinutes: number | null;
  status: "te_beoordelen" | "uitzondering" | "geen_melding" | "niet_werk" | "nog_gepland";
  overlaps?: { shift: ReviewShift; minutes: number; duplicate: boolean }[];
};
export type SourceCheck = {
  key: string; label: string; state: "available" | "unavailable" | "partial" | "unknown";
  message: string; httpStatus?: number; rows?: number; fields?: string[];
};
export type ReviewDataset = {
  month: string;
  period?: "calendar" | "payroll";
  generatedAt: string;
  sourceVersion: string;
  departments: { id: string; name: string }[];
  planned: ReviewShift[];
  actual: ReviewShift[];
  coverage: { planned: string[]; actual: string[] };
  checks: SourceCheck[];
};
export type DayStatus = { state: "open" | "closed" | "unknown"; message: string; employeeApprovalIsNotManagerApproval: true; httpStatus?: number };
