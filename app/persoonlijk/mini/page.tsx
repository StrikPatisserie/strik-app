import { notFound } from "next/navigation";
import { requireCurrentProfile } from "../../lib/auth/session";
import { canAccessPersonalNotes } from "../../lib/auth/access";
import { UUID } from "../model";
import PersonalWorkspace from "../PersonalWorkspace";
export const dynamic="force-dynamic";
export const metadata={title:"Mijn to-do’s · klein venster",robots:{index:false,follow:false}};
export default async function PersonalMiniPage({searchParams}:{searchParams:Promise<{note?:string}>}) {
 const profile=await requireCurrentProfile();if(!canAccessPersonalNotes(profile))notFound();
 const {note}=await searchParams;
 return <PersonalWorkspace key={profile.id} ownerId={profile.id} compact initialNoteId={typeof note==="string"&&UUID.test(note)?note:undefined}/>;
}
