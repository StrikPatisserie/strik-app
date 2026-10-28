import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { productionDepartments } from "@/app/productie/access";
import { getProductionRoster } from "@/app/productie/staffing.server";
import { readDocument,saveDocument,ProductionStoreError } from "@/app/productie/documents.server";
import { mondayOf,validStaffingSettings,normalizeStaffingSettings,type PreviewState } from "@/app/productie/planning";
import { todayAmsterdam } from "@/app/productie/workspaceData";
export const dynamic="force-dynamic";
export const maxDuration=120;
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:Request){
 const profile=await getCurrentProfile();if(!productionDepartments(profile).length)return Response.json({message:"Geen toegang tot het productierooster."},{status:403,headers});
 try{const week=mondayOf(new URL(request.url).searchParams.get("week") || todayAmsterdam());if(week<"2020-01-01" || week>"2100-12-31")return Response.json({message:"Kies een geldige roosterweek."},{status:400,headers});return Response.json(await getProductionRoster(week,hasFullAccess(profile)),{headers});}
 catch(e){return Response.json({message:e instanceof ProductionStoreError?e.message:"Het productierooster kon niet worden geladen. Probeer opnieuw."},{status:e instanceof ProductionStoreError?e.status:400,headers});}
}
export async function PUT(request:Request){
 const profile=await getCurrentProfile();if(!profile || !hasFullAccess(profile))return Response.json({message:"Alleen managers kunnen werkweken en takenpakketten beheren."},{status:403,headers});
 const origin=request.headers.get("origin");if(origin && origin!==new URL(request.url).origin)return Response.json({message:"Ongeldige website."},{status:403,headers});
 try{const text=await request.text();if(text.length>1200000)return Response.json({message:"De instellingen zijn te groot."},{status:413,headers});const input=JSON.parse(text);
  if(!validStaffingSettings(input?.settings))return Response.json({message:"Controleer de afdelingen, medewerker-ID’s, normale werkdagen, weekuren en takenpakketten."},{status:400,headers});
  const planner=await readDocument<PreviewState>("planner");if(!planner)throw new ProductionStoreError("De productieopslag is nog niet ingericht.");
  if(planner.revision!==input.revision)throw new ProductionStoreError("De planning of roosterinstellingen zijn intussen gewijzigd. Ververs eerst; er is niets opgeslagen.",409);
  const settings=normalizeStaffingSettings(input.settings);
  const revision=await saveDocument("planner",planner.revision,{...planner.data,staffing:settings},profile.id,"Productierooster: afdelingen, normale werkweken en vaste taken bijgewerkt");
  return Response.json({revision,settings},{headers});
 }catch(e){return Response.json({message:e instanceof ProductionStoreError?e.message:"Opslaan is niet gelukt. Ververs de roosterinstellingen."},{status:e instanceof ProductionStoreError?e.status:400,headers});}
}
