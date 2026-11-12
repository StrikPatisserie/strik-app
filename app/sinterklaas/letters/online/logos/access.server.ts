import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { requireSupabasePublicConfig, requireSupabaseServiceRoleKey } from "@/app/lib/supabase/config";

export const logoHeaders = { "Cache-Control": "private, no-store" };
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function logoAccess(request: Request, writing = false) {
  const profile = await getCurrentProfile();
  if (!profile?.active || !hasFullAccess(profile)) {
    return { error: Response.json({ message: "Geen toegang." }, { status: 403, headers: logoHeaders }) };
  }
  if (writing && request.headers.get("origin") !== new URL(request.url).origin) {
    return { error: Response.json({ message: "Ongeldige website." }, { status: 403, headers: logoHeaders }) };
  }
  const { url } = requireSupabasePublicConfig();
  const db = createClient(url, requireSupabaseServiceRoleKey(), { auth: { autoRefreshToken: false, persistSession: false } });
  return { db, profile };
}
