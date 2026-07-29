import "server-only";

import {
  FEATURE_VISIBILITY_SETTING_KEY,
  defaultFeatureVisibility,
  normalizeFeatureVisibilitySettings,
  type FeatureVisibilitySettings,
} from "../featureVisibility";
import { createAdminClient } from "./supabase/admin";

export async function getFeatureVisibilitySettings(): Promise<FeatureVisibilitySettings> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", FEATURE_VISIBILITY_SETTING_KEY)
      .maybeSingle();

    if (error || !data) return defaultFeatureVisibility;

    return normalizeFeatureVisibilitySettings(data.value);
  } catch {
    return defaultFeatureVisibility;
  }
}
