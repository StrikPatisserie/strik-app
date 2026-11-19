/** Actual yields of one choux production; pieces are never inferred from batter weight. */
export type SoezenBatchOutputs = { hazelnutChoux: number; bosscheBollen: number; remainingBatterKg: number };
export type BatchOutputDraft = Record<keyof SoezenBatchOutputs, string>;
export function needsSoezenOutputs(item: {recipeId?: string; name: string}, task: {recordsOutput: boolean}): boolean {
  return task.recordsOutput && (item.recipeId === "hf030" || /soezenbeslag/i.test(item.name));
}
export function validBatchOutputs(value: unknown): value is SoezenBatchOutputs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as SoezenBatchOutputs;
  return Object.keys(v).length === 3 && [v.hazelnutChoux, v.bosscheBollen, v.remainingBatterKg].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000000)
    && Number.isInteger(v.hazelnutChoux) && Number.isInteger(v.bosscheBollen);
}
export function batchOutputDraft(value?: SoezenBatchOutputs): BatchOutputDraft {
  return {hazelnutChoux: value ? String(value.hazelnutChoux) : "", bosscheBollen: value ? String(value.bosscheBollen) : "", remainingBatterKg: value ? String(value.remainingBatterKg) : ""};
}
export function parseBatchOutputDraft(draft: BatchOutputDraft): SoezenBatchOutputs | undefined {
  if (Object.values(draft).some(v => !v.trim() || !/^\d+(?:[.,]\d+)?$/.test(v.trim()))) return undefined;
  const value = {hazelnutChoux: Number(draft.hazelnutChoux.replace(",", ".")), bosscheBollen: Number(draft.bosscheBollen.replace(",", ".")), remainingBatterKg: Number(draft.remainingBatterKg.replace(",", "."))};
  return validBatchOutputs(value) ? value : undefined;
}
export function sameBatchOutputs(a?: SoezenBatchOutputs, b?: SoezenBatchOutputs): boolean {
  return a === b || !!a && !!b && a.hazelnutChoux === b.hazelnutChoux && a.bosscheBollen === b.bosscheBollen && a.remainingBatterKg === b.remainingBatterKg;
}
export function batchOutputSummary(v: SoezenBatchOutputs): string {
  const n = (v: number) => v.toLocaleString("nl-NL", {maximumFractionDigits: 3});
  return `${n(v.hazelnutChoux)} hazelnootsoezen · ${n(v.bosscheBollen)} Bossche bollen · ${n(v.remainingBatterKg)} kg restbeslag`;
}
