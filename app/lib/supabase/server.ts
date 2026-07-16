import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptionsWithName } from "@supabase/ssr";
import type { Database } from "./types";
import { requireSupabasePublicConfig } from "./config";

type ServerClientOptions = {
  remember?: boolean;
};

function getCookieOptions(options?: ServerClientOptions): CookieOptionsWithName {
  return {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(options?.remember === false ? { maxAge: 60 * 60 * 8 } : {}),
  };
}

export async function createClient(options?: ServerClientOptions) {
  const { url, publishableKey } = requireSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookieOptions: getCookieOptions(options),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            cookieStore.set(name, value, cookieOptions);
          });
        } catch {
          // Server Components cannot write cookies. Middleware keeps sessions fresh.
        }
      },
    },
  });
}
