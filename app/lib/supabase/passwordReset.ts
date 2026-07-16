import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSupabasePublicConfig } from "./config";
import type { Database } from "./types";

export function getPasswordUpdateUrl(siteUrl: string) {
  return `${siteUrl}/update-password`;
}

export async function sendPasswordResetEmail(email: string, redirectTo: string) {
  const { url, publishableKey } = requireSupabasePublicConfig();
  const supabase = createSupabaseClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
      persistSession: false,
    },
  });

  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
}
