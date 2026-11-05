import "server-only";
import {canAccessPath} from "../lib/auth/access";
import type {UserProfile} from "../lib/supabase/types";
import {createAdminClient} from "../lib/supabase/admin";

const SETTING_KEY="winkel_lokaalverhaal_access_v1";
export type LokaalVerhaalCredentials={username:string;password:string};

// Shared store access is loaded only for users who may open the store overview.
// Keep the actual credentials out of source files and public client bundles.
export async function getLokaalVerhaalCredentials(profile:UserProfile|null):Promise<LokaalVerhaalCredentials|null> {
  if(!canAccessPath(profile,"/winkel"))return null;
  const {data,error}=await createAdminClient().from("app_settings").select("value").eq("key",SETTING_KEY).maybeSingle();
  if(error)throw Error("De gedeelde inlog kon niet worden geladen.");
  const value=data?.value;
  if(!value||typeof value!=="object"||Array.isArray(value)||typeof value.username!=="string"||typeof value.password!=="string"||!value.username||!value.password)return null;
  return {username:value.username,password:value.password};
}
