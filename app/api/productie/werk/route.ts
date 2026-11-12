import {readEditBase, retryConcurrentSave, assertTaskCurrent} from "@/app/productie/concurrentEditing.server";
import {ConcurrentChangeError, assertUnchanged} from "@/app/productie/concurrentChanges";
import {getCurrentProfile} from '@/app/lib/auth/session';
import {productionDepartments,visibleWorkspace} from '@/app/productie/access';
import {ProductionStoreError,readDocument,saveDocument} from '@/app/productie/documents.server';
import {recipeViews,syncRecipeCatalog,validWorkspace} from '@/app/productie/workspaceData';
import {applyWorkCommand} from '@/app/productie/workCommands';
import type {PreviewState} from '@/app/productie/planning';
import type {RecepturenData} from '@/app/bakkerij/recepturen/recepturenApi';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 const profile=await getCurrentProfile(),allowed=productionDepartments(profile);
 if(!profile?.active||!allowed.length)return Response.json({message:'Geen toegang tot productie.'},{status:403,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({message:'Ongeldige herkomst.'},{status:403,headers});
 try{
  const raw=await request.text();if(raw.length>4000)throw new ProductionStoreError('De actie is te groot.',413);
  const input=JSON.parse(raw);
  if(typeof input.id!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(input.id))throw Error('Ververs deze productieactie.');
  return await retryConcurrentSave(async () => {
    const [planner,recipes]=await Promise.all([readDocument<PreviewState>('planner'),readDocument<RecepturenData>('recipes')]);
    if(!planner||!recipes)throw new ProductionStoreError('De productieopslag is niet bereikbaar.');
    const alreadyApplied = planner.data.productionWork?.receipts?.some(row => row.id === input.id && row.actorId === profile.id)
      || Object.values(planner.data.productionWork?.stockFulfillments || {}).some(row => row.id === input.id && row.actorId === profile.id)
      || planner.data.productionWork?.history?.some(row => row.kind === "output" && row.id === input.id && row.actorId === profile.id);
    if(alreadyApplied)return Response.json({state:visibleWorkspace(syncRecipeCatalog(planner.data,recipes.data)),revision:planner.revision,updatedAt:planner.updated_at},{headers});
    const base = await readEditBase(planner, "planner", input.revision);
    if (input.command?.kind === "preparation") {
      assertUnchanged(base.productionWork?.preparation?.[input.command.recipeId], planner.data.productionWork?.preparation?.[input.command.recipeId]);
    } else {
      assertTaskCurrent(base, planner.data, input.command?.taskId);
      if (input.command?.kind === "stock") {
        const itemId = base.tasks.find(task => task.id === input.command.taskId)?.itemId;
        assertUnchanged(base.tasks.filter(task => task.itemId === itemId), planner.data.tasks.filter(task => task.itemId === itemId));
        assertUnchanged(Object.values(base.productionWork?.stockFulfillments || {}).filter(row => row.itemId === itemId), Object.values(planner.data.productionWork?.stockFulfillments || {}).filter(row => row.itemId === itemId));
      }
    }
    const views=recipeViews(recipes.data),current=syncRecipeCatalog(planner.data,recipes.data),now=new Date().toISOString();
    const next=applyWorkCommand(current,views,input.command,allowed,profile.id,input.id,now);
    if(!validWorkspace(next,views))throw Error('Controleer de productie; er is niets opgeslagen.');
    const revision=await saveDocument('planner',planner.revision,next,profile.id,`Productie: ${input.command.kind}`);
    return Response.json({state:visibleWorkspace(next),revision,updatedAt:now},{headers});
  });
 }catch(error){return Response.json({message:error instanceof Error?error.message:'Opslaan mislukt.'},{status:error instanceof ProductionStoreError?error.status:error instanceof ConcurrentChangeError?409:400,headers});}
}
