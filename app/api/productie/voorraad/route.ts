import {getCurrentProfile} from "@/app/lib/auth/session";
import {productionDepartments} from "@/app/productie/access";
import {readDocument,ProductionStoreError} from "@/app/productie/documents.server";
import {readOperational,saveOperational} from "@/app/productie/operationalStore.server";
import {INVENTORY_KEY,emptyInventory,inventoryOverview,applyInventory,type InventoryState} from "@/app/productie/inventory";
import {inventoryDispatchDays,archiveInventoryDays} from "@/app/productie/inventorySource.server";
import {syncRecipeCatalog,todayAmsterdam} from "@/app/productie/workspaceData";
import type {PreviewState} from "@/app/productie/planning";
import type {RecepturenData} from "@/app/bakkerij/recepturen/recepturenApi";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
async function source(){
 const [planner,recipes,inventory,days]=await Promise.all([readDocument<PreviewState>("planner"),readDocument<RecepturenData>("recipes"),readOperational<InventoryState>(INVENTORY_KEY,emptyInventory()),inventoryDispatchDays()]);
 if(!planner||!recipes)throw new ProductionStoreError("De productieopslag is nog niet ingericht.");
 return{planner:syncRecipeCatalog(planner.data,recipes.data),inventory,days};
}
function view(data:Awaited<ReturnType<typeof source>>){return{revision:data.inventory.revision,history:data.inventory.counts.slice(-1000).reverse(),...inventoryOverview(data.planner,data.inventory,data.days,todayAmsterdam())};}
export async function GET(){
 if(!productionDepartments(await getCurrentProfile()).length)return Response.json({message:"Geen toegang tot voorraadbeheer."},{status:403,headers});
 try{return Response.json(view(await source()),{headers});}catch(error){return Response.json({message:error instanceof Error?error.message:"Voorraad niet bereikbaar."},{status:503,headers});}
}
export async function POST(request:Request){
 const profile=await getCurrentProfile();if(!profile||!productionDepartments(profile).length)return Response.json({message:"Geen toegang tot voorraadbeheer."},{status:403,headers});
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({message:"Ongeldige herkomst."},{status:403,headers});
 try{
  const raw=await request.text();if(raw.length>50000)throw Error("De telling is te groot.");const input=JSON.parse(raw);
  if(typeof input.id!=="string"||!/^[a-zA-Z0-9-]{8,100}$/.test(input.id))throw Error("Ongeldige voorraadactie.");
  const data=await source();if(data.inventory.actions.includes(input.id))return Response.json(view(data),{headers});
  if(input.revision!==data.inventory.revision)throw new ProductionStoreError("De voorraadregistratie is intussen veranderd. Ververs eerst.",409);
  const next=applyInventory(data.inventory,input.command,data.planner.items,profile.id,input.id,new Date().toISOString(),todayAmsterdam());
  // Preserve the available historical baseline before logistics rotates batches.
  // Aggregates are replaceable snapshots: retries do not add to the totals.
  if(input.command.kind==="count")await archiveInventoryDays(data.days);
  await saveOperational(INVENTORY_KEY,data.inventory.revision,next,profile.id);
  return Response.json(view({...data,inventory:next}),{headers});
 }catch(error){return Response.json({message:error instanceof Error?error.message:"Voorraad opslaan mislukt."},{status:error instanceof ProductionStoreError?error.status:400,headers});}
}
