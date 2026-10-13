import "server-only";

import { createAdminClient } from "./supabase/admin";
import type { Json } from "./supabase/types";
import {
  HEYENDAAL_TOUCHPOINT_BY_ID,
  isPresentationCategory,
  normalizeWeekStart,
} from "../winkel/presentatie/presentationData";
import type {
  StorePresentationCompletion,
  StorePresentationPlacement,
  StorePresentationPlan,
  StorePresentationState,
} from "../winkel/presentatie/types";

export const STORE_PRESENTATION_SETTING_KEY = "store_presentation_pilot_v1";

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizePlacement(value: unknown): StorePresentationPlacement | null {
  if (!isRecord(value)) return null;

  const touchpointId = text(value.touchpointId, 80);
  if (!HEYENDAAL_TOUCHPOINT_BY_ID.has(touchpointId)) return null;

  return {
    touchpointId,
    role: value.role === "hoofdplek" ? "hoofdplek" : "ondersteuning",
    instruction: text(value.instruction, 500),
  };
}

function normalizePlan(value: unknown): StorePresentationPlan | null {
  if (!isRecord(value) || value.storeId !== "heyendaal") return null;

  const weekStart = normalizeWeekStart(text(value.weekStart, 10));
  const rawCategory = text(value.category, 40);
  const category = isPresentationCategory(rawCategory) ? rawCategory : "seizoen";
  const placements = Array.isArray(value.placements)
    ? value.placements
        .map(normalizePlacement)
        .filter((placement): placement is StorePresentationPlacement => Boolean(placement))
    : [];

  return {
    id: text(value.id, 120) || `heyendaal-${weekStart}`,
    storeId: "heyendaal",
    weekStart,
    title: text(value.title, 160),
    category,
    generalInstruction: text(value.generalInstruction, 800),
    placements,
    updatedAt: text(value.updatedAt, 80),
    updatedByName: text(value.updatedByName, 160),
  };
}

function normalizeCompletion(value: unknown): StorePresentationCompletion | null {
  if (!isRecord(value) || value.storeId !== "heyendaal") return null;

  const touchpointId = text(value.touchpointId, 80);
  if (!HEYENDAAL_TOUCHPOINT_BY_ID.has(touchpointId)) return null;

  return {
    storeId: "heyendaal",
    weekStart: normalizeWeekStart(text(value.weekStart, 10)),
    touchpointId,
    completed: value.completed === true,
    completedAt: text(value.completedAt, 80),
    completedBy: text(value.completedBy, 120),
    completedByName: text(value.completedByName, 160),
  };
}

export function emptyStorePresentationState(): StorePresentationState {
  return { plans: [], completions: [], updatedAt: "" };
}

export function normalizeStorePresentationState(value: unknown): StorePresentationState {
  if (!isRecord(value)) return emptyStorePresentationState();

  const plans = Array.isArray(value.plans)
    ? value.plans.map(normalizePlan).filter((plan): plan is StorePresentationPlan => Boolean(plan))
    : [];
  const completions = Array.isArray(value.completions)
    ? value.completions
        .map(normalizeCompletion)
        .filter((completion): completion is StorePresentationCompletion => Boolean(completion))
    : [];

  return {
    plans,
    completions,
    updatedAt: text(value.updatedAt, 80),
  };
}

export async function readStorePresentationState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", STORE_PRESENTATION_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return emptyStorePresentationState();
  return normalizeStorePresentationState(data.value);
}

export async function writeStorePresentationState(state: StorePresentationState) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: STORE_PRESENTATION_SETTING_KEY,
      value: toJson(state),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);
}

export function getStorePresentationPlan(
  state: StorePresentationState,
  storeId: string,
  weekStart: string
) {
  return (
    state.plans.find(
      (plan) => plan.storeId === storeId && plan.weekStart === normalizeWeekStart(weekStart)
    ) || null
  );
}

export function getStorePresentationCompletions(
  state: StorePresentationState,
  storeId: string,
  weekStart: string
) {
  const normalizedWeek = normalizeWeekStart(weekStart);
  return state.completions.filter(
    (completion) => completion.storeId === storeId && completion.weekStart === normalizedWeek
  );
}

export function upsertStorePresentationPlan(
  state: StorePresentationState,
  plan: StorePresentationPlan
) {
  const plans = state.plans.filter(
    (item) => !(item.storeId === plan.storeId && item.weekStart === plan.weekStart)
  );

  return {
    ...state,
    plans: [...plans, plan].slice(-80),
    updatedAt: new Date().toISOString(),
  };
}

export function upsertStorePresentationCompletion(
  state: StorePresentationState,
  completion: StorePresentationCompletion
) {
  const completions = state.completions.filter(
    (item) =>
      !(
        item.storeId === completion.storeId &&
        item.weekStart === completion.weekStart &&
        item.touchpointId === completion.touchpointId
      )
  );

  return {
    ...state,
    completions: [...completions, completion].slice(-600),
    updatedAt: new Date().toISOString(),
  };
}
