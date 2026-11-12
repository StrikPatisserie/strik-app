import {readEditBase, retryConcurrentSave, assertTaskCurrent} from "@/app/productie/concurrentEditing.server";
import {ConcurrentChangeError, assertUnchanged} from "@/app/productie/concurrentChanges";
import {getCurrentProfile} from '@/app/lib/auth/session';
import {canAccessLogistiek,canManageProduction} from '@/app/lib/auth/access';
import {productionDepartments} from '@/app/productie/access';
import {readDocument,saveDocument,saveRecipePlanDocument,ProductionStoreError} from '@/app/productie/documents.server';
import {validWorkspace,recipeViews,syncRecipeCatalog} from '@/app/productie/workspaceData';
import {applyProductionRequest,canEditProductionRequest,requestPlanningTask,requestPlanningUrl,type RequestCommand} from '@/app/productie/requestPlanning';
import type {PreviewState} from '@/app/productie/planning';
import type {RecepturenData} from '@/app/bakkerij/recepturen/recepturenApi';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 const profile=await getCurrentProfile();if(!profile?.active||(!canAccessLogistiek(profile)&&!productionDepartments(profile).length))return Response.json({message:'Geen toegang tot productieverzoeken.'},{status:403,headers});
 try{
  const [planner,recipes]=await Promise.all([readDocument<PreviewState>('planner'),readDocument<RecepturenData>('recipes')]);
  if(!planner||!recipes)throw new ProductionStoreError('De productieopslag is nog niet ingericht.');
  const state=syncRecipeCatalog(planner.data,recipes.data);
  return Response.json({revision:planner.revision,canCreate:canAccessLogistiek(profile)||canManageProduction(profile),departments:productionDepartments(profile),items:state.items.filter(i=>i.kind!=='activity').map(({id,name,unit,departmentId,productionBlocked})=>({id,name,unit,departmentId,productionBlocked})),requests:(state.productionRequests||[]).map(r=>({...r,canEdit:canEditProductionRequest(state,r),plannedTask:requestPlanningTask(state,r),planningUrl:requestPlanningUrl(state,r)}))},{headers});
 }catch(e){return Response.json({message:e instanceof Error?e.message:'Laden mislukt.'},{status:503,headers});}
}
export async function POST(request:Request){
 const profile=await getCurrentProfile();if(!profile?.active||(!canAccessLogistiek(profile)&&!productionDepartments(profile).length))return Response.json({message:'Geen toegang.'},{status:403,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({message:'Ongeldige herkomst.'},{status:403,headers});
 try{
  const raw=await request.text();if(raw.length>12000)throw new ProductionStoreError('Het verzoek is te groot.',413);
  const input=JSON.parse(raw),command=input.command as RequestCommand;
  if(!command||!['create','edit','move','cancel','plan'].includes(command.kind))throw new ProductionStoreError('Ongeldige verzoekactie.',400);
  if(command.kind==='plan'?!productionDepartments(profile).includes(command.departmentId):!canAccessLogistiek(profile)&&!canManageProduction(profile))throw new ProductionStoreError('Je hebt geen rechten voor deze actie of afdeling.',403);
  const requestId = `request:${crypto.randomUUID()}`;
  return await retryConcurrentSave(async () => {
    const [planner,recipes]=await Promise.all([readDocument<PreviewState>('planner'),readDocument<RecepturenData>('recipes')]);
    if(!planner||!recipes)throw new ProductionStoreError('De productieopslag is nog niet ingericht.');
    const base = await readEditBase(planner, "planner", input.revision);
    if (command.kind !== "create") {
      const previous = base.productionRequests?.find(row => row.id === command.id);
      assertUnchanged(previous, planner.data.productionRequests?.find(row => row.id === command.id));
      if (previous) {
        const task = requestPlanningTask(base, previous);
        if (task) assertTaskCurrent(base, planner.data, task.id);
      }
    }
    const current=syncRecipeCatalog(planner.data,recipes.data),now=new Date().toISOString();
    const next=applyProductionRequest(current,recipeViews(recipes.data),command,profile.id,now,requestId);
    if(!validWorkspace(next,recipeViews(recipes.data)))throw new ProductionStoreError('Het verzoek bevat een ongeldige hoeveelheid of onderdeel. Er is niets opgeslagen.',400);
    const revision=command.kind==='plan'?await saveRecipePlanDocument(planner.revision,recipes.revision,next,profile.id):await saveDocument('planner',planner.revision,next,profile.id,`Productieverzoek ${command.kind==='create'?'toegevoegd':command.kind==='edit'||command.kind==='move'?'gewijzigd':'ingetrokken'}`);
    return Response.json({revision},{headers});
  });
 }catch(e){return Response.json({message:e instanceof Error?e.message:'Opslaan mislukt.'},{status:e instanceof ProductionStoreError?e.status:e instanceof ConcurrentChangeError?409:400,headers});}
}
