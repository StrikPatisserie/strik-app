import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { productionDepartments, mergeWorkspaceForEmployee, visibleWorkspace } from "@/app/productie/access";
import { ProductionStoreError, readDocument, saveDocument } from "@/app/productie/documents.server";
import { ingredientViews, recipeViews, syncRecipeCatalog, todayAmsterdam, validWorkspace } from "@/app/productie/workspaceData";
import type { RecepturenData } from "@/app/bakkerij/recepturen/recepturenApi";
import type { PreviewState } from "@/app/productie/planning";
import { requiredTaskIds } from "@/app/productie/planning";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};

export async function GET() {
  const profile=await getCurrentProfile(), allowed=productionDepartments(profile);
  if (!profile || !allowed.length) return Response.json({message:"Geen toegang tot Strik Productie."},{status:403,headers});
  try {
    const [recipes,planner]=await Promise.all([readDocument<RecepturenData>("recipes"),readDocument<PreviewState>("planner")]);
    if (!recipes || !planner) return Response.json({message:"De receptenoverdracht moet eerst worden afgerond.",setupRequired:true,canManage:hasFullAccess(profile)},{status:503,headers});
    const state=syncRecipeCatalog(planner.data,recipes.data);
    return Response.json({state:visibleWorkspace(state),revision:planner.revision,recipeRevision:recipes.revision,updatedAt:planner.updated_at,today:todayAmsterdam(),recipes:recipeViews(recipes.data),ingredients:ingredientViews(recipes.data),canManage:hasFullAccess(profile),departments:allowed,weeklyOffers:(recipes.data.bakeryHome?.offers || []).map(o=>({id:o.id,weekStart:o.weekStart,weekEnd:o.weekEnd,label:o.label,imageUrl:o.imageUrl}))},{headers});
  } catch (error) { return Response.json({message:error instanceof ProductionStoreError?error.message:"Strik Productie is tijdelijk niet bereikbaar."},{status:503,headers}); }
}
export async function PUT(request:Request) {
  const profile=await getCurrentProfile(), allowed=productionDepartments(profile);
  if (!profile || !allowed.length) return Response.json({message:"Geen toegang tot Strik Productie."},{status:403,headers});
  try {
    if (Number(request.headers.get("content-length") || 0)>4000000) return Response.json({message:"De planning is te groot."},{status:413,headers});
    const incoming=await request.json();
    const [recipes,planner]=await Promise.all([readDocument<RecepturenData>("recipes"),readDocument<PreviewState>("planner")]);
    if (!recipes || !planner) throw new ProductionStoreError("De gedeelde opslag is nog niet ingericht.");
    if (incoming.revision!==planner.revision) throw new ProductionStoreError("Deze planning is intussen gewijzigd. Ververs eerst; je wijziging is niet opgeslagen.",409);
    const views=recipeViews(recipes.data);
    if (!validWorkspace(incoming.state,views)) throw new ProductionStoreError("De wijziging bevat een ongeldige taak, receptkoppeling of dubbele batchregistratie.",400);
    const current=syncRecipeCatalog(planner.data,recipes.data);
    if(JSON.stringify(incoming.state.staffing)!==JSON.stringify(current.staffing))throw new ProductionStoreError("Roosterinstellingen worden apart beheerd. Ververs de planning om met de actuele versie te werken.",409);
    if(JSON.stringify(incoming.state.cleaning)!==JSON.stringify(current.cleaning))throw new ProductionStoreError("De schoonmaaklijst is intussen gewijzigd. Ververs de planning om met de actuele versie te werken.",409);
    let next:PreviewState;
    try { next=hasFullAccess(profile)?incoming.state:mergeWorkspaceForEmployee(current,incoming.state,allowed); }
    catch(error) { throw new ProductionStoreError((error as Error).message,403); }
    // Recipe review flags come from canonical source data, never the browser.
    next=syncRecipeCatalog(next,recipes.data);
    if (current.items.some(i=>!next.items.some(n=>n.id===i.id))) throw new ProductionStoreError("Bestaande onderdelen kunnen niet via deze wijziging worden verwijderd.",400);
    // Deleting a planned task removes it from the board, not from the history.
    // The server owns the recovery records; clients cannot erase or rewrite them.
    const removed=current.tasks.filter(t=>!next.tasks.some(n=>n.id===t.id));
    for (const task of removed) {
      if(task.status!=="planned")throw new ProductionStoreError("Alleen geplande taken kunnen worden verwijderd.",400);
      if(next.tasks.some(t=>requiredTaskIds(t).includes(task.id)))throw new ProductionStoreError("Verwijder eerst de gekoppelde vervolgstap.",400);
    }
    const restored=next.tasks.filter(t=>!current.tasks.some(n=>n.id===t.id) && current.removedTasks?.some(r=>r.task.id===t.id));
    for (const task of restored) {
      const original=current.removedTasks!.find(r=>r.task.id===task.id)!.task;
      if (JSON.stringify(original)!==JSON.stringify(task)) throw new ProductionStoreError("Herstel de oorspronkelijke geplande taak voordat je deze aanpast.",400);
    }
    next={...next,removedTasks:[...(current.removedTasks || []).filter(r=>!restored.some(t=>t.id===r.task.id)),...removed.map(task=>({task,removedAt:new Date().toISOString(),removedBy:profile.id}))]};
    for(const task of next.tasks) if(!current.tasks.some(t=>t.id===task.id) && next.items.find(i=>i.id===task.itemId)?.productionBlocked) throw new ProductionStoreError("Het bronrecept heeft ontbrekende verwijzingen en moet eerst gecontroleerd worden.",400);
    for (const task of current.tasks) {
      const changed=next.tasks.find(t=>t.id===task.id);
      if (!changed) continue;
      if (task.itemId!==changed.itemId || task.batchId!==changed.batchId || task.dependsOn!==changed.dependsOn || task.recordsOutput!==changed.recordsOutput || JSON.stringify(task.requires || [])!==JSON.stringify(changed.requires || []) || task.generatedFor!==changed.generatedFor || task.weddingCode!==changed.weddingCode || task.weddingDeliveryDate!==changed.weddingDeliveryDate || JSON.stringify(task.recipePlan)!==JSON.stringify(changed.recipePlan)) throw new ProductionStoreError("De identiteit, afhankelijkheden en voorraadregistratie van bestaande productiestappen blijven behouden.",400);
      if (task.status!==changed.status) {
        // Apply the same dependency/blocking checks for managers as employees.
        const { transitionTask }=await import("@/app/productie/planning");
        transitionTask(current.tasks,task.id,changed.status,current.items);
      }
    }
    const revision=await saveDocument("planner",planner.revision,next,profile.id,removed.length ? `${removed.length} geplande taak/taken verwijderd` : restored.length ? "Geplande taak hersteld" : "Productieplanning bijgewerkt");
    return Response.json({state:visibleWorkspace(next),revision,updatedAt:new Date().toISOString()},{headers});
  } catch(error) { return Response.json({message:error instanceof Error?error.message:"Opslaan is mislukt."},{status:error instanceof ProductionStoreError?error.status:400,headers}); }
}
