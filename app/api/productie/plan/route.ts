import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { ProductionStoreError, readDocument, saveRecipePlanDocument } from "@/app/productie/documents.server";
import { recipeViews, syncRecipeCatalog, validWorkspace } from "@/app/productie/workspaceData";
import { buildRecipePlan, refreshRecipePlan } from "@/app/productie/recipePlanning";
import type { RecepturenData } from "@/app/bakkerij/recepturen/recepturenApi";
import type { PreviewState } from "@/app/productie/planning";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function POST(request:Request) {
  const profile=await getCurrentProfile();
  if(!profile?.active || !hasFullAccess(profile))return Response.json({message:"Alleen managers kunnen productieopdrachten plannen."},{status:403,headers});
  try {
    const text=await request.text();if(text.length>100000)throw new ProductionStoreError("De productieopdracht is te groot.",413);
    const incoming=JSON.parse(text);
    const [recipes,planner]=await Promise.all([readDocument<RecepturenData>("recipes"),readDocument<PreviewState>("planner")]);
    if(!recipes || !planner)throw new ProductionStoreError("De gedeelde opslag is nog niet ingericht.");
    if(incoming.revision!==planner.revision || incoming.recipeRevision!==recipes.revision)throw new ProductionStoreError("De planning of recepten zijn intussen gewijzigd. Ververs het voorstel eerst; er is niets opgeslagen.",409);
    const views=recipeViews(recipes.data);
    const current=syncRecipeCatalog(planner.data,recipes.data);
    let next=incoming.replaceTaskId?refreshRecipePlan(current,views,incoming.replaceTaskId,incoming.command):buildRecipePlan(current,views,incoming.command);
    if(incoming.replaceTaskId)next={...next,removedTasks:[...(current.removedTasks || []),...current.tasks.filter(t=>!next.tasks.some(n=>n.id===t.id)).map(task=>({task,removedAt:new Date().toISOString(),removedBy:profile.id}))]};
    if(!validWorkspace(next,views))throw new ProductionStoreError("Het voorstel bevat een ongeldige hoeveelheid, koppeling of planning.",400);
    const revision=await saveRecipePlanDocument(planner.revision,recipes.revision,next,profile.id);
    return Response.json({state:next,revision,updatedAt:new Date().toISOString()},{headers});
  }catch(error){return Response.json({message:error instanceof Error?error.message:"Inplannen is mislukt."},{status:error instanceof ProductionStoreError?error.status:400,headers});}
}
