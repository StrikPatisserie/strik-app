"use server";

import { revalidatePath } from "next/cache";
import {
  FEATURE_VISIBILITY_SETTING_KEY,
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
  const settings = normalizeFeatureVisibilitySettings({
    vierdaagseNavigation: formData.get("vierdaagseNavigation") === "on",
  });

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: FEATURE_VISIBILITY_SETTING_KEY,
        value: {
          vierdaagseNavigation: settings.vierdaagseNavigation,
        },
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
  revalidatePath("/settings/app");

  return {
    ok: true,
    message: settings.vierdaagseNavigation
      ? "Vierdaagse staat weer in het menu."
      : "Vierdaagse is uit het menu gehaald.",
  };
}
