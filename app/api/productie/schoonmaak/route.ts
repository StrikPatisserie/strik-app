import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess,canAccessBakkerijPatisserie } from "@/app/lib/auth/access";
import { ProductionStoreError,readDocument,saveDocument } from "@/app/productie/documents.server";
import { applyCleaningCommand,type CleaningCommand,type PreviewState } from "@/app/productie/planning";
import { syncRecipeCatalog } from "@/app/productie/workspaceData";
import type { RecepturenData } from "@/app/bakkerij/recepturen/recepturenApi";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function POST(request:Request){
  const profile=await getCurrentProfile();
  if(!profile?.active || !canAccessBakkerijPatisserie(profile))return Response.json({message:"Geen toegang tot de schoonmaakplanning van Patisserie."},{status:403,headers});
  const origin=request.headers.get("origin");if(origin && origin!==new URL(request.url).origin)return Response.json({message:"Ongeldige website."},{status:403,headers});
  try{
    const text=await request.text();if(text.length>64000)return Response.json({message:"De schoonmaaklijst is te groot."},{status:413,headers});
    const input=JSON.parse(text),command=input?.command as CleaningCommand;
    if(!command || !["check","plan","remove","move"].includes(command.kind))throw new ProductionStoreError("Kies een geldige schoonmaakactie.",400);
    if(command.kind!=="check" && !hasFullAccess(profile))throw new ProductionStoreError("Alleen management kan de schoonmaakplanning aanpassen.",403);
    const [planner,recipes]=await Promise.all([readDocument<PreviewState>("planner"),readDocument<RecepturenData>("recipes")]);
    if(!planner || !recipes)throw new ProductionStoreError("De productieopslag is nog niet ingericht.");
    if(input.revision!==planner.revision)throw new ProductionStoreError("De planning is intussen gewijzigd. Ververs eerst; er is niets opgeslagen.",409);
    const now=new Date().toISOString(),state=syncRecipeCatalog({...planner.data,cleaning:applyCleaningCommand(planner.data.cleaning || [],command,profile.id,now,()=>`cleaning-check:${crypto.randomUUID()}`)},recipes.data);
    const revision=await saveDocument("planner",planner.revision,state,profile.id,command.kind==="check"?`Schoonmaak ${command.date}: taak ${command.done?"afgevinkt":"heropend"}`:command.kind==="remove"?`Schoonmaakplanning ${command.date} verwijderd`:command.kind==="move"?`Schoonmaak verplaatst van ${command.date} naar ${command.to}`:`Schoonmaakplanning ${command.date} bijgewerkt`);
    return Response.json({state,revision,updatedAt:now},{headers});
  }catch(e){return Response.json({message:e instanceof Error?e.message:"De schoonmaakwijziging kon niet worden opgeslagen."},{status:e instanceof ProductionStoreError?e.status:400,headers});}
}
