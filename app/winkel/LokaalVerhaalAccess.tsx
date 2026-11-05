import {canAccessPath} from "../lib/auth/access";
import type {UserProfile} from "../lib/supabase/types";
import LokaalVerhaalCard from "./LokaalVerhaalCard";
import {getLokaalVerhaalCredentials} from "./lokaalVerhaal.server";

export default async function LokaalVerhaalAccess({profile}:{profile:UserProfile|null}) {
  if(!canAccessPath(profile,"/winkel"))return null;
  const credentials=await getLokaalVerhaalCredentials(profile).catch(()=>null);
  return <LokaalVerhaalCard credentials={credentials}/>;
}
