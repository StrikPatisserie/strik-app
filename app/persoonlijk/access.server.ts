import "server-only";
import { getCurrentProfile } from "../lib/auth/session";
import { canAccessPersonalNotes } from "../lib/auth/access";
import { createClient } from "../lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const personalHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
export async function personalContext() {
  const profile=await getCurrentProfile();
  if(!profile)return{error:Response.json({message:"Log opnieuw in en bevestig je tweede verificatiestap."},{status:401,headers:personalHeaders})};
  if(!canAccessPersonalNotes(profile))return{error:Response.json({message:"Deze persoonlijke omgeving is niet beschikbaar voor dit account."},{status:403,headers:personalHeaders})};
  return{profile,db:await createClient() as unknown as SupabaseClient};
}
