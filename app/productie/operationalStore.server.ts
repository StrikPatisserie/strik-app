import "server-only";
import { createAdminClient } from "../lib/supabase/admin";
import type { Json } from "../lib/supabase/types";
import { ProductionStoreError } from "./documents.server";

/** Private app_settings documents. Clients only reach these through guarded
 * operational APIs; RLS does not grant ordinary app users direct reads. */
export async function readOperational<T>(key:string,empty:T):Promise<T> {
 const {data,error}=await createAdminClient().from("app_settings").select("value").eq("key",key).maybeSingle();
 if(error)throw new ProductionStoreError("De gedeelde opslag is niet bereikbaar.");
 return data ? data.value as unknown as T : empty;
}
export async function saveOperational<T extends {revision:number}>(key:string,previous:number,next:T,actor:string|null) {
 const db=createAdminClient(),row={key,value:next as unknown as Json,updated_at:new Date().toISOString(),updated_by:actor};
 const {key:documentKey,...update}=row;
 const result=previous===0?await db.from("app_settings").insert(row).select("key").maybeSingle():await db.from("app_settings").update(update).eq("key",documentKey).eq("value->>revision",String(previous)).select("key").maybeSingle();
 if(result.error||!result.data)throw new ProductionStoreError(result.error&&result.error.code!=="23505"?"Opslaan kon niet worden bevestigd.":"Iemand heeft dit intussen gewijzigd. Ververs eerst; er is niets overschreven.",result.error&&result.error.code!=="23505"?503:409);
}
