import {readEditBase, retryConcurrentSave, assertRecipeCurrent} from "@/app/productie/concurrentEditing.server";
import {ConcurrentChangeError, assertUnchanged, mergeConcurrentChanges} from "@/app/productie/concurrentChanges";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { canManageProduction } from "@/app/lib/auth/access";
import {productionDepartments,mergeWorkspaceForEmployee} from "@/app/productie/access";
import { ProductionStoreError, readDocument, saveRecipePlanDocument } from "@/app/productie/documents.server";
import { recipeViews, syncRecipeCatalog, validWorkspace } from "@/app/productie/workspaceData";
import { buildRecipePlan, refreshRecipePlan } from "@/app/productie/recipePlanning";
import type { RecepturenData } from "@/app/bakkerij/recepturen/recepturenApi";
import type { PreviewState } from "@/app/productie/planning";
import { combineMaterialTasks } from "@/app/productie/materialPlanning";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function POST(request:Request) {
  const profile=await getCurrentProfile();
  if(!profile?.active || !canManageProduction(profile))return Response.json({message:"Alleen managers kunnen productieopdrachten plannen."},{status:403,headers});
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return Response.json({message:"Ongeldige herkomst."},{status:403,headers});
  try {
    const text=await request.text();if(text.length>100000)throw new ProductionStoreError("De productieopdracht is te groot.",413);
    const incoming=JSON.parse(text);
    return await retryConcurrentSave(async () => {
      const [recipes,planner]=await Promise.all([readDocument<RecepturenData>("recipes"),readDocument<PreviewState>("planner")]);
      if(!recipes || !planner)throw new ProductionStoreError("De gedeelde opslag is nog niet ingericht.");
      const [basePlanner, baseRecipes] = await Promise.all([
        readEditBase(planner, "planner", incoming.revision), readEditBase(recipes, "recipes", incoming.recipeRevision)
      ]);
      const itemIds = incoming.action === "combine" ? basePlanner.tasks.filter(task => incoming.taskIds?.includes(task.id)).map(task => task.itemId) : [incoming.command?.task?.itemId];
      for (const itemId of itemIds) {
        const item = basePlanner.items.find(item => item.id === itemId);
        assertUnchanged(item, planner.data.items.find(row => row.id === itemId));
        if (item?.recipeId) {
          const dependencies = assertRecipeCurrent(baseRecipes, recipes.data, item.recipeId);
          for (const recipeId of dependencies) {
            assertUnchanged(basePlanner.productionWork?.preparation?.[recipeId], planner.data.productionWork?.preparation?.[recipeId]);
            const component = basePlanner.items.find(row => row.recipeId === recipeId);
            assertUnchanged(component, planner.data.items.find(row => row.recipeId === recipeId));
          }
        }
      }
      const views=recipeViews(recipes.data);
      const current=syncRecipeCatalog(planner.data,recipes.data,views);
      const base = syncRecipeCatalog(basePlanner, recipes.data, views);
      let next=incoming.action === "combine" ? combineMaterialTasks(base,views,incoming.taskIds) : incoming.replaceTaskId?refreshRecipePlan(base,views,incoming.replaceTaskId,incoming.command):buildRecipePlan(base,views,incoming.command);
      next = mergeConcurrentChanges(base, next, current);
      try{mergeWorkspaceForEmployee(current,next,productionDepartments(profile));}catch(error){throw new ProductionStoreError((error as Error).message,403);}
      if(incoming.replaceTaskId)next={...next,removedTasks:[...(current.removedTasks || []),...current.tasks.filter(t=>!next.tasks.some(n=>n.id===t.id)).map(task=>({task,removedAt:new Date().toISOString(),removedBy:profile.id}))]};
      if(!validWorkspace(next,views))throw new ProductionStoreError("Het voorstel bevat een ongeldige hoeveelheid, koppeling of planning.",400);
      const revision=await saveRecipePlanDocument(planner.revision,recipes.revision,next,profile.id);
      return Response.json({state:next,revision,updatedAt:new Date().toISOString()},{headers});
    });
  }catch(error){return Response.json({message:error instanceof Error?error.message:"Inplannen is mislukt."},{status:error instanceof ProductionStoreError?error.status:error instanceof ConcurrentChangeError?409:400,headers});}
}
