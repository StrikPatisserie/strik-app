import "server-only";

import type { LogisticsBatch } from "@/app/bakkerij/logistiek/logisticsTypes";
import { createAdminClient } from "./supabase/admin";
import type { Json } from "./supabase/types";

const LOGISTICS_BATCHES_SETTING_KEY = "bakery_logistics_batches";
const MAX_STORED_BATCHES = 80;

type LogisticsState = {
  batches: LogisticsBatch[];
};

function emptyLogisticsState(): LogisticsState {
  return { batches: [] };
}

function isLogisticsBatch(value: unknown): value is LogisticsBatch {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LogisticsBatch).id === "string" &&
      typeof (value as LogisticsBatch).date === "string" &&
      Array.isArray((value as LogisticsBatch).receipts)
  );
}

function normalizeLogisticsState(value: unknown): LogisticsState {
  if (!value || typeof value !== "object") return emptyLogisticsState();

  const batches = (value as { batches?: unknown }).batches;
  if (!Array.isArray(batches)) return emptyLogisticsState();

  return {
    batches: batches.filter(isLogisticsBatch),
  };
}

function toJson(value: LogisticsState): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function sortBatches(batches: LogisticsBatch[]) {
  return [...batches].sort((first, second) => {
    const dateCompare = second.date.localeCompare(first.date);
    if (dateCompare !== 0) return dateCompare;

    return second.importedAt.localeCompare(first.importedAt);
  });
}

export async function readLogisticsState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LOGISTICS_BATCHES_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return emptyLogisticsState();

  return normalizeLogisticsState(data.value);
}

export async function getLogisticsBatchForDate(date: string) {
  const state = await readLogisticsState();

  return (
    sortBatches(state.batches).find((batch) => batch.date === date) || null
  );
}

export async function upsertLogisticsBatch(batch: LogisticsBatch) {
  const state = await readLogisticsState();
  const batches = sortBatches([
    batch,
    ...state.batches.filter(
      (item) => !(item.date === batch.date && item.status === batch.status)
    ),
  ]).slice(0, MAX_STORED_BATCHES);

  const nextState = { batches };
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_BATCHES_SETTING_KEY,
      value: toJson(nextState),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);

  return batch;
}
