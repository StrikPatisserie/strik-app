import "server-only";
import { createAdminClient } from "../../lib/supabase/admin";
import type { Json } from "../../lib/supabase/types";
import type { BusinessSeason } from "../../lib/businessSeasons";
import { BakeItError, readBakeItState, type BakeItState } from "./bakeItRegistrations";

const key = (season: BusinessSeason, year: string) => `b2b_bakeit_${season}_${year}`;
export async function readBakeItDocument(season: BusinessSeason, year: string) {
  const result = await createAdminClient().from("app_settings").select("value").eq("key", key(season, year)).maybeSingle();
  if (result.error) throw new BakeItError("Bake-it-registraties zijn tijdelijk niet bereikbaar.", 503);
  return readBakeItState(result.data?.value);
}

export async function saveBakeItDocument(season: BusinessSeason, year: string, previous: BakeItState, next: BakeItState, actorId: string) {
  const db = createAdminClient();
  const row = { key: key(season, year), value: next as unknown as Json, updated_at: new Date().toISOString(), updated_by: actorId };
  const { key: documentKey, ...update } = row;
  // Both first insert and updates are conditional. Never upsert over another
  // colleague's registration, including a concurrent initial registration.
  const result = previous.revision === 0
    ? await db.from("app_settings").insert(row).select("key").maybeSingle()
    : await db.from("app_settings").update(update).eq("key", documentKey).eq("value->>revision", String(previous.revision)).select("key").maybeSingle();
  if (result.error || !result.data) throw new BakeItError(result.error && result.error.code !== "23505" ? "Opslaan kon niet worden bevestigd. Ververs om de actuele registratie te zien." : "Iemand heeft de Bake-it-registraties intussen gewijzigd. Ververs en probeer opnieuw.", result.error && result.error.code !== "23505" ? 503 : 409);
}
