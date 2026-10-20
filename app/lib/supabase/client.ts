"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { requireSupabasePublicConfig } from "./config";

export function createClient() {
  const { url, publishableKey } = requireSupabasePublicConfig();

  return createBrowserClient<Database>(url, publishableKey);
}

// Recovery links are consumed explicitly once by the reset page. A separate
// client prevents the browser SDK from also redeeming a PKCE code on startup.
export function createRecoveryClient() {
  const { url, publishableKey } = requireSupabasePublicConfig();
  return createBrowserClient<Database>(url, publishableKey, {
    isSingleton: false,
    auth: { detectSessionInUrl: false },
  });
}
