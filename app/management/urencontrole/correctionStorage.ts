import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../../lib/supabase/admin";
import type { CorrectionRecord, CorrectionResult, CorrectionState, CorrectionHistory } from "./correctionTypes";

export interface CorrectionStore {
  ready(): Promise<boolean>;
  create(record: CorrectionRecord): Promise<void>;
  get(id: string): Promise<CorrectionRecord | null>;
  claim(id: string, actorId: string): Promise<{ record: CorrectionRecord; acquired: boolean }>;
  finish(id: string, state: CorrectionState, message: string, observed?: unknown, expectedState?: CorrectionState, checkedBy?: string): Promise<void>;
  history(shiftId: string): Promise<CorrectionHistory[]>;
}
function db() { return createAdminClient() as unknown as SupabaseClient; }
function fromRow(row: Record<string, unknown>): CorrectionRecord {
  return { id: row.id, actorId: row.actor_id, reference: row.reference, before: row.before_snapshot, after: row.after_values, originalNetMinutes: row.original_net_minutes, reason: row.reason, mode: row.mode, payload: row.update_payload, state: row.state, createdAt: row.created_at, expiresAt: row.expires_at, finishedAt: row.finished_at, message: row.result_message, rules: row.rules_snapshot } as CorrectionRecord;
}
export const correctionStore: CorrectionStore = {
  async ready() {
    try { const { error } = await db().from("tamigo_hours_corrections").select("id").limit(1); return !error; } catch { return false; }
  },
  async create(record) {
    const { error } = await db().from("tamigo_hours_corrections").insert({ id: record.id, actor_id: record.actorId, shift_id: record.reference.shiftId, reference: record.reference, before_snapshot: record.before, after_values: record.after, original_net_minutes: record.originalNetMinutes, reason: record.reason, mode: record.mode, rules_snapshot: record.rules, update_payload: record.payload, state: "prepared", created_at: record.createdAt, expires_at: record.expiresAt });
    if (error) throw new Error("De oorspronkelijke registratie kon niet worden bewaard. Er is niets gewijzigd.");
  },
  async get(id) {
    const { data, error } = await db().from("tamigo_hours_corrections").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error("Correctiehistorie is niet beschikbaar.");
    return data ? fromRow(data) : null;
  },
  async claim(id, actorId) {
    const { data, error } = await db().rpc("strik_claim_tamigo_hours_correction", { p_id: id, p_actor_id: actorId });
    if (error || !data) throw new Error("Deze correctie is al bezig, verlopen of geblokkeerd door een eerdere onzekere poging. Controleer de historie.");
    return { record: fromRow(data.record), acquired: data.acquired === true };
  },
  async finish(id, state, message, observed, expectedState = "applying", checkedBy) {
    const { data, error } = await db().from("tamigo_hours_corrections").update({ state, result_message: message, observed_snapshot: observed ?? null, finished_at: new Date().toISOString(), ...(checkedBy ? { verified_by: checkedBy } : {}) }).eq("id", id).eq("state", expectedState).select("id");
    if (error || data?.length !== 1) throw new Error("De definitieve uitkomst kon niet worden opgeslagen. Controleer Tamigo en de historie; probeer niet opnieuw te verzenden.");
  },
  async history(shiftId) {
    const { data, error } = await db().from("tamigo_hours_corrections").select("*").eq("shift_id", shiftId).order("created_at", { ascending: false }).limit(10);
    if (error) throw new Error("Correctiehistorie is niet beschikbaar.");
    return (data || []).map(value => {
      const row = fromRow(value);
      return { id: row.id, state: row.state, createdAt: row.createdAt, finishedAt: row.finishedAt, reason: row.reason, before: row.before, after: row.after, message: row.message };
    });
  },
};
export function correctionResult(record: CorrectionRecord): CorrectionResult {
  return { id: record.id, state: record.state, message: record.message || (record.state === "applying" ? "Deze correctie wordt verwerkt. Verstuur deze niet opnieuw." : "Deze correctie is al verwerkt; er is niets opnieuw verzonden.") };
}
