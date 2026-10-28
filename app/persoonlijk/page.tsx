import { notFound } from "next/navigation";
import { requireCurrentProfile } from "../lib/auth/session";
import { canAccessPersonalNotes } from "../lib/auth/access";
import PersonalWorkspace from "./PersonalWorkspace";
export const dynamic="force-dynamic";
export const metadata={title:"Mijn to-do’s · Strik",robots:{index:false,follow:false}};
export default async function PersonalPage(){const profile=await requireCurrentProfile();if(!canAccessPersonalNotes(profile))notFound();return <PersonalWorkspace ownerId={profile.id}/>;}
