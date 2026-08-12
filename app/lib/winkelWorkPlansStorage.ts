import "server-only";

import { createAdminClient } from "./supabase/admin";
import type { Json } from "./supabase/types";

export const WINKEL_WORK_PLAN_STATE_SETTING_KEY = "winkel_work_plan_state_v1";

export type WinkelWorkPlanCheck = {
  storeId: string;
  planId: string;
  periodKey: string;
  itemId: string;
  checked: boolean;
  checkedAt: string;
  checkedBy: string;
  checkedByName: string;
};

export type WinkelWorkPlanNote = {
  storeId: string;
  planId: string;
  periodKey: string;
  note: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

export type WinkelWorkPlanState = {
  checks: WinkelWorkPlanCheck[];
  notes: WinkelWorkPlanNote[];
  updatedAt: string;
};

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeCheck(value: unknown): WinkelWorkPlanCheck | null {
  if (!isRecord(value)) return null;

  const storeId = normalizeText(value.storeId);
  const planId = normalizeText(value.planId);
  const periodKey = normalizeText(value.periodKey);
  const itemId = normalizeText(value.itemId);
  if (!storeId || !planId || !periodKey || !itemId) return null;

  return {
    storeId,
    planId,
    periodKey,
    itemId,
    checked: value.checked === true,
    checkedAt: normalizeText(value.checkedAt),
    checkedBy: normalizeText(value.checkedBy),
    checkedByName: normalizeText(value.checkedByName),
  };
}

function normalizeNote(value: unknown): WinkelWorkPlanNote | null {
  if (!isRecord(value)) return null;

  const storeId = normalizeText(value.storeId);
  const planId = normalizeText(value.planId);
  const periodKey = normalizeText(value.periodKey);
  if (!storeId || !planId || !periodKey) return null;

  return {
    storeId,
    planId,
    periodKey,
    note: normalizeText(value.note),
    updatedAt: normalizeText(value.updatedAt),
    updatedBy: normalizeText(value.updatedBy),
    updatedByName: normalizeText(value.updatedByName),
  };
}

export function emptyWinkelWorkPlanState(): WinkelWorkPlanState {
  return {
    checks: [],
    notes: [],
    updatedAt: "",
  };
}

export function normalizeWinkelWorkPlanState(
  value: unknown
): WinkelWorkPlanState {
  if (!isRecord(value)) return emptyWinkelWorkPlanState();

  const checks = Array.isArray(value.checks)
    ? value.checks.map(normalizeCheck).filter(Boolean)
    : [];
  const notes = Array.isArray(value.notes)
    ? value.notes.map(normalizeNote).filter(Boolean)
    : [];

  return {
    checks: checks as WinkelWorkPlanCheck[],
    notes: notes as WinkelWorkPlanNote[],
    updatedAt: normalizeText(value.updatedAt),
  };
}

export async function readWinkelWorkPlanState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", WINKEL_WORK_PLAN_STATE_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return emptyWinkelWorkPlanState();

  return normalizeWinkelWorkPlanState(data.value);
}

export async function writeWinkelWorkPlanState(state: WinkelWorkPlanState) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: WINKEL_WORK_PLAN_STATE_SETTING_KEY,
      value: toJson(state),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);
}

export function getWinkelWorkPlanPeriodChecks(
  state: WinkelWorkPlanState,
  storeId: string,
  planId: string,
  periodKey: string
) {
  return state.checks.filter(
    (check) =>
      check.storeId === storeId &&
      check.planId === planId &&
      check.periodKey === periodKey
  );
}

export function getWinkelWorkPlanPeriodNote(
  state: WinkelWorkPlanState,
  storeId: string,
  planId: string,
  periodKey: string
) {
  return (
    state.notes.find(
      (note) =>
        note.storeId === storeId &&
        note.planId === planId &&
        note.periodKey === periodKey
    ) || null
  );
}

export function upsertWinkelWorkPlanCheck(
  state: WinkelWorkPlanState,
  check: WinkelWorkPlanCheck
) {
  const checks = state.checks.filter(
    (item) =>
      !(
        item.storeId === check.storeId &&
        item.planId === check.planId &&
        item.periodKey === check.periodKey &&
        item.itemId === check.itemId
      )
  );

  return {
    ...state,
    checks: [...checks, check],
    updatedAt: new Date().toISOString(),
  };
}

export function upsertWinkelWorkPlanNote(
  state: WinkelWorkPlanState,
  note: WinkelWorkPlanNote
) {
  const notes = state.notes.filter(
    (item) =>
      !(
        item.storeId === note.storeId &&
        item.planId === note.planId &&
        item.periodKey === note.periodKey
      )
  );

  return {
    ...state,
    notes: [...notes, note],
    updatedAt: new Date().toISOString(),
  };
}
