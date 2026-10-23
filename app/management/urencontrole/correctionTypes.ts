import type { ReviewConfig, ReviewShift } from "./reviewTypes";

export type CorrectionReference = { shiftId: string; departmentId: string; date: string; reviewMonth: string; revision: string };
export type CorrectionDraft = { start: string; end: string; breakCode: string; reason: string; mode: "proposal" | "manual" };
export type BreakOption = { code: string; minutes: number; minimumMinutes: number; label: string };
export type CorrectionValues = { start: string; end: string; breakCode: string; breakMinutes: number; netMinutes: number };
export type CorrectionState = "prepared" | "applying" | "applied" | "rejected" | "unknown";
export type CorrectionPreview = {
  id: string | null; expiresAt: string | null; before: ReviewShift; after: CorrectionValues;
  originalNetMinutes: number | null; deltaMinutes: number | null; reason: string; mode: CorrectionDraft["mode"];
  blockers: string[]; warnings: string[]; demo?: boolean;
};
export type CorrectionHistory = { id: string; state: CorrectionState; createdAt: string; finishedAt: string | null; reason: string; after: CorrectionValues; before: ReviewShift; message: string };
export type CorrectionResult = { state: CorrectionState; message: string; id: string };
export type CorrectionRecord = {
  id: string; actorId: string; reference: CorrectionReference; before: ReviewShift; after: CorrectionValues;
  originalNetMinutes: number | null; reason: string; mode: CorrectionDraft["mode"]; payload: TamigoShiftUpdate;
  state: CorrectionState; createdAt: string; expiresAt: string; finishedAt: string | null; message: string;
  rules: ReviewConfig | null;
};
// Deliberately no employee, department, activity or comment editing in the UI.
export type TamigoShiftUpdate = {
  ShiftId: string; EmployeeId: string; StartTime: string; EndTime: string; BreakCode: string;
  Comment: string | null; IsAvailable: boolean; IsExchange: boolean; ShiftActivityId: string | null;
};
