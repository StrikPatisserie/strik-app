import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSupabasePublicConfig } from "./config";
import type { Database } from "./types";

export function getPasswordUpdateUrl(siteUrl: string) {
  return new URL("/update-password", siteUrl).toString();
}

export function getPasswordResetErrorMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : "";
  if (code === "email_address_not_authorized") {
    return "De maildienst kan nog niet naar medewerkers mailen. Laat een beheerder de mailinstellingen controleren.";
  }
  if (code === "over_email_send_rate_limit") {
    return "De maildienst heeft zijn verzendlimiet bereikt. Probeer het later opnieuw of neem contact op met een beheerder.";
  }
  if (code === "over_request_rate_limit") {
    return "Er is zojuist al een resetmail aangevraagd. Wacht een minuut voordat je het opnieuw probeert.";
  }
  return "De resetmail kon niet worden verstuurd. Probeer opnieuw; neem contact op met een beheerder als dit blijft gebeuren.";
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
