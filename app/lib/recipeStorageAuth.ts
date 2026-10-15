import "server-only";
import { createClient } from "./supabase/server";
import { getCurrentProfile } from "./auth/session";

// WordPress independently validates this user token and the user's current role.
// A legacy shared integration key alone must not grant access to recipe prices.
export async function recipeStorageAuthHeaders(): Promise<Record<string, string>> {
  if (!(await getCurrentProfile())?.active) throw new Error("Geen geldige gebruikerssessie voor recepturenopslag.");
  const db = await createClient();
  const { data, error } = await db.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Geen geldige gebruikerssessie voor recepturenopslag.");
  return { Accept: "application/json", "X-Strik-User-Token": data.session.access_token };
}
