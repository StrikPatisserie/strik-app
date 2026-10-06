import "server-only";

import type { Json } from "./supabase/types";
import { createAdminClient } from "./supabase/admin";
import {
  emptyChristmasLettersState,
  normalizeChristmasLettersState,
  type ChristmasLettersState,
} from "../management/kerstbrieven/christmasLettersTypes";

const SETTING_KEY = "management_christmas_letters_v1";

export async function readChristmasLettersState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTING_KEY)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return emptyChristmasLettersState();

  return normalizeChristmasLettersState(data.value);
}

export async function writeChristmasLettersState(state: ChristmasLettersState) {
  const normalized = normalizeChristmasLettersState({
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
