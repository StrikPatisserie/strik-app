import { hasFullAccess } from "./access";
import type { UserProfile } from "../supabase/types";

export function canManageWeeklyOffers(profile:UserProfile|null|undefined) {
  return hasFullAccess(profile) && profile?.email.trim().toLowerCase()==="feline@strik-patisserie.nl";
}
export function weeklyOffersChanged(current:{bakeryHome?:{offers?:unknown}},incoming:{bakeryHome?:{offers?:unknown}}) {
  if(incoming.bakeryHome===undefined)return false;
  return JSON.stringify(current.bakeryHome?.offers||[])!==JSON.stringify(incoming.bakeryHome?.offers||[]);
}
