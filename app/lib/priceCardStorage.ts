import "server-only";

import type { Json } from "./supabase/types";
import { createAdminClient } from "./supabase/admin";
import {
  emptyPriceCardState,
  normalizePriceCardState,
  type PriceCardState,
} from "../management/prijskaartjes/priceCardTypes";

const SETTING_KEY = "management_price_cards_v1";

export async function readPriceCardState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTING_KEY)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return emptyPriceCardState();
  return normalizePriceCardState(data.value);
}

export async function writePriceCardState(state: PriceCardState) {
  const normalized = normalizePriceCardState({
    ...state,
    updatedAt: new Date().toISOString(),
  });
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: SETTING_KEY,
      value: normalized as unknown as Json,
      updated_at: normalized.updatedAt,
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);
  return normalized;
}
