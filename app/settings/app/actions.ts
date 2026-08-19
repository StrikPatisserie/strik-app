"use server";

import { revalidatePath } from "next/cache";
import {
  FEATURE_VISIBILITY_SETTING_KEY,
  SEASONAL_NAVIGATION_SETTINGS,
  normalizeFeatureVisibilitySettings,
} from "../../featureVisibility";
import { requireAdminProfile } from "../../lib/auth/session";
import { createAdminClient } from "../../lib/supabase/admin";

export type AppSettingsActionState = {
  ok?: boolean;
  message?: string;
};

export async function updateFeatureVisibilityAction(
  _state: AppSettingsActionState,
  formData: FormData
): Promise<AppSettingsActionState> {
  const profile = await requireAdminProfile();
  const settings = normalizeFeatureVisibilitySettings(
    Object.fromEntries(
      SEASONAL_NAVIGATION_SETTINGS.map((setting) => [
        setting.key,
        formData.get(setting.key) === "on",
      ])
    )
  );

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: FEATURE_VISIBILITY_SETTING_KEY,
        value: settings,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      },
      { onConflict: "key" }
    );

    if (error) throw new Error(error.message);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "App-instellingen opslaan is mislukt.",
    };
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/settings/app");
  revalidatePath("/sinterklaas");
  revalidatePath("/vierdaagse");

  return {
    ok: true,
    message: "App-instellingen opgeslagen.",
  };
}
