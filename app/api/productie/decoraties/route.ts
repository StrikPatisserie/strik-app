import { getCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import { ProductionStoreError, readDocument, saveRecipePlanDocument } from "@/app/productie/documents.server";
import { readEditBase, retryConcurrentSave } from "@/app/productie/concurrentEditing.server";
import { assertUnchanged, ConcurrentChangeError } from "@/app/productie/concurrentChanges";
import { applyDecorationCommand } from "@/app/productie/decorationPlanning";
import { recipeViews, syncRecipeCatalog, validWorkspace } from "@/app/productie/workspaceData";
import type { PreviewState } from "@/app/productie/planning";
import type { RecepturenData } from "@/app/bakkerij/recepturen/recepturenApi";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function POST(request:Request) {
  const profile=await getCurrentProfile();
  if(!profile?.active || !productionDepartments(profile).includes("chocolade"))return Response.json({message:"Alleen de chocoladeafdeling en management kunnen decoraties controleren en inplannen."},{status:403,headers});
  const origin=request.headers.get("origin");
  if(origin && origin!==new URL(request.url).origin)return Response.json({message:"Ongeldige website."},{status:403,headers});
  try {
    const text=await request.text();if(text.length>10000)throw new ProductionStoreError("De decoratieactie is te groot.",413);
    const input=JSON.parse(text);
    return await retryConcurrentSave(async()=>{
      const [planner,recipes]=await Promise.all([readDocument<PreviewState>("planner"),readDocument<RecepturenData>("recipes")]);
      if(!planner || !recipes)throw new ProductionStoreError("De productieopslag is niet beschikbaar.");
      const base=await readEditBase(planner,"planner",input.revision);
      assertUnchanged(base.decorationChecks?.[input.command?.checkId],planner.data.decorationChecks?.[input.command?.checkId]);
      const views=recipeViews(recipes.data),current=syncRecipeCatalog(planner.data,recipes.data,views);
      const next=applyDecorationCommand(current,views,input.command,profile.id,new Date().toISOString(),()=>`decoration:${crypto.randomUUID()}`);
      if(!validWorkspace(next,views))throw new ProductionStoreError("Controleer de decoratieplanning.",400);
      if(next===current)return Response.json({state:current,revision:planner.revision,updatedAt:planner.updated_at},{headers});
      const revision=await saveRecipePlanDocument(planner.revision,recipes.revision,next,profile.id);
      return Response.json({state:next,revision,updatedAt:new Date().toISOString()},{headers});
    });
  }catch(cause){return Response.json({message:cause instanceof Error?cause.message:"Opslaan mislukt."},{status:cause instanceof ProductionStoreError?cause.status:cause instanceof ConcurrentChangeError?409:400,headers});}
}
