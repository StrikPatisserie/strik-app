import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  requireSupabasePublicConfig,
  requireSupabaseServiceRoleKey,
} from "./config";

export function createAdminClient() {
  const { url } = requireSupabasePublicConfig();
  const serviceRoleKey = requireSupabaseServiceRoleKey();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
