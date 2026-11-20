"use server";
import { revalidatePath } from "next/cache";
import { requireAdminProfile } from "@/app/lib/auth/session";
import { getSeason, seasonDb, wordpressSeason, previewCentral } from "./server";
import { holiday, validateSetup, validateClosure, seasonSummary, type SeasonConfig, type ClosureNotes, type SeasonArchive } from "./model";
export type SeasonActionResult={ok?:boolean;message?:string;href?:string};
export async function startSeason(id:string,year:number,input:SeasonConfig):Promise<SeasonActionResult>{
  const actor=await requireAdminProfile();
  try{
    const config=validateSetup(id,year,input), definition=holiday(id)!;
    const db=seasonDb();
    const started=await db.rpc("holiday_start",{p_season:id,p_year:year,p_config:config,p_actor:actor.id});
    if(started.error)throw Error(started.error.code==="23505"?"Sluit de vorige editie eerst af.":started.error.message);
    if(started.data?.state==="active") return {ok:true,href:`/feestdagen/${id}?jaar=${year}`};
    await wordpressSeason(definition.id,year,"open",config);
    const activated=await db.from("holiday_seasons").update({state:"active",started_at:new Date().toISOString(),updated_at:new Date().toISOString(),updated_by:actor.id}).eq("season",id).eq("year",year).eq("state","opening").select("year").maybeSingle();
    if(activated.error||!activated.data)throw Error("De opening is nog niet afgerond. Probeer opnieuw.");
    revalidatePath("/feestdagen","layout"); revalidatePath("/lettershop");
    return {ok:true,href:`/feestdagen/${id}?jaar=${year}`};
  }catch(e){return {message:e instanceof Error?e.message:"Openen is niet gelukt."};}
}
export async function closeSeason(id:string,year:number,notes:ClosureNotes):Promise<SeasonActionResult>{
  const actor=await requireAdminProfile();
  try{
    const definition=holiday(id);if(!definition)throw Error("Onbekend seizoen.");
    validateClosure(notes);
    const season=await getSeason(id,year);if(!season)throw Error("Dit seizoen is niet gestart.");
    if(season.state==="closed")return {ok:true,href:`/feestdagen/${id}?jaar=${year}`};
    if(!["active","closing"].includes(season.state))throw Error("Rond de seizoensstart eerst af.");
    // Validate the external source before entering the recoverable closing state.
    const [preview,central]=await Promise.all([wordpressSeason(definition.id,year,"read"),id==="sint"?previewCentral(year):Promise.resolve({})]);
    if(seasonSummary(preview,central).openCount>0&&!notes.exceptions.trim())throw Error("Er staan nog leveringen open. Licht eerst toe hoe die worden afgehandeld.");
    const db=seasonDb();
    if(season.state==="active"){
      const locked=await db.from("holiday_seasons").update({state:"closing",closure_notes:notes,revision:season.revision+1,updated_at:new Date().toISOString(),updated_by:actor.id}).eq("season",id).eq("year",year).eq("state","active").eq("revision",season.revision).select("year").maybeSingle();
      if(locked.error||!locked.data)throw Error("Het seizoen is intussen gewijzigd. Ververs de pagina.");
    }
    const sources=await wordpressSeason(definition.id,year,"close");
    const result=await db.rpc("holiday_finish_close",{p_season:id,p_year:year,p_sources:sources,p_notes:notes,p_actor:actor.id});
    if(result.error)throw Error("De invoer is gesloten, maar het archief is nog niet bevestigd. Hervat de afsluiting.");
    revalidatePath("/feestdagen","layout");revalidatePath("/management/cijfers-evaluaties","layout");revalidatePath("/lettershop");
    return {ok:true,href:`/feestdagen/${id}?jaar=${year}`};
  }catch(e){return {message:e instanceof Error?e.message:"Afsluiten is niet gelukt."};}
}
export async function archiveDownload(id:string,year:number){
  await requireAdminProfile();
  const {data,error}=await seasonDb().from("holiday_archives").select("*").eq("season",id).eq("year",year).single();
  if(error)throw Error("Het archief kon niet worden geladen.");
  const archive=data as SeasonArchive;
  return {...archive,summary:seasonSummary(archive.sources,archive.central)};
}
