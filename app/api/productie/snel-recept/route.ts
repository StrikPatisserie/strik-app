import {readEditBase, retryConcurrentSave, assertTaskCurrent, assertRecipeCurrent} from "@/app/productie/concurrentEditing.server";
import {ConcurrentChangeError, assertUnchanged} from "@/app/productie/concurrentChanges";
import {getCurrentProfile} from '@/app/lib/auth/session';
import {canManageProduction} from '@/app/lib/auth/access';
import {productionDepartments} from '@/app/productie/access';
import {readDocument,saveQuickRecipeDocument,saveRecipePlanDocument,ProductionStoreError} from '@/app/productie/documents.server';
import {saveRecipeChange,storeWork,workView} from '@/app/productie/productionWork';
import {quickRecipe,type QuickRecipeInput} from '@/app/productie/quickRecipe';
import {editableWorkRecipe,updateWorkRecipe,workRecipeSource,type WorkRecipeInput} from '@/app/productie/workRecipe';
import {syncRecipeCatalog,validWorkspace,recipeViews} from '@/app/productie/workspaceData';
import type {PreviewState} from '@/app/productie/planning';
import type {RecepturenData} from '@/app/bakkerij/recepturen/recepturenApi';
export const dynamic='force-dynamic';const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 const profile=await getCurrentProfile();
 if(!canManageProduction(profile))return Response.json({message:'Geen toegang tot werkrecepten aanpassen.'},{status:403,headers});
 try{
  const [planner,recipes]=await Promise.all([readDocument<PreviewState>('planner'),readDocument<RecepturenData>('recipes')]);
  if(!planner||!recipes)throw new ProductionStoreError('De productieopslag is nog niet ingericht.');
  const state=syncRecipeCatalog(planner.data,recipes.data),itemId=new URL(request.url).searchParams.get('itemId')||'';
  const taskId=new URL(request.url).searchParams.get('taskId')||'';
  const source=workRecipeSource(state,recipes.data,itemId);
  const draft=!source.requiresPermanent&&state.tasks.some(t=>t.id===taskId&&t.itemId===itemId)?state.productionWork?.recipeDrafts?.[taskId]||editableWorkRecipe(state,recipes.data,itemId):editableWorkRecipe(state,recipes.data,itemId);
  return Response.json({draft,notice:source.notice,requiresPermanent:source.requiresPermanent,revision:planner.revision,recipeRevision:recipes.revision,semiFinished:recipes.data.recipes.filter(r=>r.type==='semiFinished'&&r.id!==draft.recipeId).map(r=>({id:r.id,name:r.name}))},{headers});
 }catch(e){return Response.json({message:e instanceof Error?e.message:'Laden mislukt.'},{status:e instanceof ProductionStoreError?e.status:e instanceof ConcurrentChangeError?409:400,headers});}
}
export async function POST(request:Request){
 const profile=await getCurrentProfile(),allowed=productionDepartments(profile);
 if(!profile?.active||!allowed.length)return Response.json({message:'Geen toegang tot recepten snel invoeren.'},{status:403,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({message:'Ongeldige herkomst.'},{status:403,headers});
 try{
  const raw=await request.text();if(raw.length>64000)throw new ProductionStoreError('Het werkrecept is te groot.',413);
  const input=JSON.parse(raw),command=input.command as QuickRecipeInput & Partial<WorkRecipeInput>;
  if(command?.recipeId&&!canManageProduction(profile))throw new ProductionStoreError('Geen toegang tot werkrecepten aanpassen.',403);
  return await retryConcurrentSave(async () => {
    const [planner,recipes]=await Promise.all([readDocument<PreviewState>('planner'),readDocument<RecepturenData>('recipes')]);
    if(!planner||!recipes)throw new ProductionStoreError('De productieopslag is nog niet ingericht.');
    const [basePlanner, baseRecipes] = await Promise.all([
      readEditBase(planner, "planner", input.revision), readEditBase(recipes, "recipes", input.recipeRevision)
    ]);
    assertUnchanged(basePlanner.items.find(row => row.id === command?.itemId), planner.data.items.find(row => row.id === command?.itemId));
    const recipeId = command?.recipeId || basePlanner.items.find(row => row.id === command?.itemId)?.recipeId;
    if (recipeId) assertRecipeCurrent(baseRecipes, recipes.data, recipeId);
    if (input.scope === "once" && input.taskId) assertTaskCurrent(basePlanner, planner.data, input.taskId);
    const current=syncRecipeCatalog(planner.data,recipes.data),item=current.items.find(i=>i.id===command?.itemId);
    if(!item||!allowed.includes(item.departmentId))throw new ProductionStoreError('Je kunt alleen recepten van je eigen afdelingen aanvullen.',403);
    if(typeof input.who!=='string'||input.who.trim().length<2||input.who.trim().length>80)throw Error('Vul je naam in (2–80 tekens).');
    const scope=input.scope||'permanent',task=current.tasks.find(t=>t.id===input.taskId&&t.itemId===item.id);
    if(!['once','permanent'].includes(scope)||scope==='once'&&(!task||!command.recipeId))throw Error('Een eenmalige wijziging hoort bij een bestaande productie met recept.');
    if(task&&!allowed.includes(task.departmentId))throw new ProductionStoreError('Geen toegang tot deze productie.',403);
    const source=command.recipeId?workRecipeSource(current,recipes.data,item.id):undefined;
    if(source?.requiresPermanent&&scope!=='permanent')throw Error('Herstel deze bronreceptkoppeling door het vaste recept aan te passen.');
    if(!command.recipeId&&recipes.data.recipes.some(recipe=>item.id===`recipe:${recipe.id}`))throw Error('Dit onderdeel heeft al een vast bronrecept. Open het werkrecept om de bestaande koppeling te herstellen.');
    const now=new Date().toISOString(),next=command.recipeId?updateWorkRecipe(current,recipes.data,command as WorkRecipeInput,now):quickRecipe(current,recipes.data,command,`recipe-quick-${crypto.randomUUID()}`,now);
    const views=recipeViews(next.recipes),changedItem=next.planner.items.find(i=>i.id===item.id)!,draft=views.find(r=>r.id===changedItem.recipeId)!;
    const original=recipes.data.recipes.find(recipe=>recipe.id===changedItem.recipeId);
    const changed=next.recipes.recipes.find(recipe=>recipe.id===changedItem.recipeId)!;
    const previousDraft=scope==='once'&&task?current.productionWork?.recipeDrafts?.[task.id]:undefined;
    const previousIngredients=(previousDraft?.ingredients||original?.ingredients||[]).map(line=>line.ingredientId);
    const previousSemiFinished=previousDraft?previousDraft.semiFinishedItems.map(line=>line.recipeId):(original?.semiFinishedItems||[]).map(line=>line.semiFinishedRecipeId);
    const referencesChanged=!!original&&(
     !!source?.requiresPermanent||
     JSON.stringify(previousIngredients)!==JSON.stringify(changed.ingredients.map(line=>line.ingredientId))||
     JSON.stringify(previousSemiFinished)!==JSON.stringify(changed.semiFinishedItems.map(line=>line.semiFinishedRecipeId))
    );
    const id=crypto.randomUUID();
    // Canonical ingredient IDs and existing recipe metadata are validated above.
    // One-off changes save only a task snapshot; the source recipe stays untouched.
    const auditPlanner=source&&!item.recipeId?{...current,items:current.items.map(row=>row.id===item.id?{...row,recipeId:source.recipe.id}:row)}:current;
    const view=saveRecipeChange(workView(auditPlanner,recipeViews(recipes.data)),{itemId:item.id,taskId:task?.id,scope,who:input.who,recipe:draft,referencesChanged},id,now);
    const unitSummary=source?.unitChanged?`Basisopbrengst ${original?.standardBatchQuantity || 0} ${original?.standardBatchUnit || 'onbekend'} → ${changed.standardBatchQuantity} ${changed.standardBatchUnit}. `:'';
    view.history=view.history.map(row=>row.id===id?{...row,actorId:profile.id,summary:unitSummary+row.summary}:row);
    let audited=storeWork(view,current.productionWork);
    if(scope==='once'){
     audited={...audited,productionWork:{...audited.productionWork!,recipeDrafts:{...audited.productionWork?.recipeDrafts,[task!.id]:editableWorkRecipe(next.planner,next.recipes,item.id)}}};
     await saveRecipePlanDocument(planner.revision,recipes.revision,audited,profile.id);
     return Response.json({saved:true},{headers});
    }
    next.planner=syncRecipeCatalog({...next.planner,productionWork:audited.productionWork},next.recipes);
    if(!validWorkspace(next.planner,recipeViews(next.recipes)))throw new ProductionStoreError('Controleer het onderdeel en de recepteenheden; er is niets opgeslagen.',400);
    await saveQuickRecipeDocument(planner.revision,recipes.revision,next.planner,next.recipes,profile.id);
    return Response.json({saved:true},{headers});
  });
 }catch(e){return Response.json({message:e instanceof Error?e.message:'Opslaan mislukt.'},{status:e instanceof ProductionStoreError?e.status:e instanceof ConcurrentChangeError?409:400,headers});}
}
