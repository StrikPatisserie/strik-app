import { addDays, addTask, dateLabel, DEPARTMENTS, requiredTaskIds, type DemoRecipe, type DepartmentId, type PreviewState, type Task, type PreparationChoice } from "./planning";

export type { PreparationChoice } from "./planning";
export type PlanCommand = {
  task: Omit<Task,"quantity"|"requires"|"generatedFor">;
  amount: number; amountMode: "quantity" | "batches";
  preparation?: { daysBefore: number; choices: Record<string,PreparationChoice> };
};
export type PreparationRow = {
  recipeId: string; itemId: string; name: string; quantity: number; unit: string;
  recipeCount: number; date: string; latestDate: string; departmentId: DepartmentId; departmentUnconfirmed: boolean;
  included: boolean; requires: string[];
};
export type PreparationProposal = { quantity: number; recipeCount?: number; rows: PreparationRow[]; errors: string[] };

function convert(quantity:number,from:string,to:string):number {
  const aliases:Record<string,string>={stuk:"stuks",g:"gram",l:"liter"};
  from=aliases[from] || from;to=aliases[to] || to;
  if(from===to)return quantity;
  if(["gram","kg"].includes(from) && ["gram","kg"].includes(to))return quantity*(from==="kg"?1000:1)/(to==="kg"?1000:1);
  if(["ml","liter"].includes(from) && ["ml","liter"].includes(to))return quantity*(from==="liter"?1000:1)/(to==="liter"?1000:1);
  throw Error(`Eenheid ${from} kan niet zonder extra gegevens naar ${to} worden omgerekend.`);
}
const stableQuantity=(n:number)=>Math.round(n*1e9)/1e9;

/** Exact recipe requirements, without assuming stock, density or whole batches.
 * Repeated references are summed by recipe ID. Every level can be dated and
 * assigned separately; excluded preparation is explicitly already available.
 */
export function preparationProposal(state:PreviewState,recipes:DemoRecipe[],command:PlanCommand):PreparationProposal {
  const result:PreparationProposal={quantity:command.amount,rows:[],errors:[]};
  const rootItem=state.items.find(i=>i.id===command.task.itemId);
  const root=recipes.find(r=>r.id===rootItem?.recipeId);
  try {
    addDays(command.task.date,0);
    if(!rootItem)throw Error("Kies een bestaand product of halffabricaat.");
    if(!["quantity","batches"].includes(command.amountMode) || !Number.isFinite(command.amount) || command.amount<=0)throw Error("Vul een geldig aantal groter dan nul in.");
    if(command.amountMode==="batches") {
      if(!root || !(root.yield>0))throw Error("Vul eerst de basisopbrengst van dit recept in.");
      result.quantity=command.amount*root.yield;
    }
    if(!(result.quantity>0) || result.quantity>1000000)throw Error("De berekende hoeveelheid is te groot of ongeldig.");
    if(root?.yield && root.yield>0)result.recipeCount=result.quantity/root.yield;
    if(!command.preparation)return result;
    if(!root || !(root.yield>0))throw Error("Halffabricaten meeplannen vereist een recept met een bekende basisopbrengst.");
    if(root.unit!==rootItem.unit)throw Error("Controleer de eenheid van het gekoppelde recept.");
    if(root.reviewRequired || rootItem.productionBlocked)throw Error("Het bronrecept bevat ontbrekende verwijzingen. Controleer dit eerst.");
    if(command.task.dependsOn)throw Error("Plan de halffabricaten bij de eerste stap van een nieuwe productieopdracht mee.");
    const {daysBefore,choices}=command.preparation;
    if(!Number.isInteger(daysBefore) || daysBefore<0 || daysBefore>30 || !choices || typeof choices!=="object" || Array.isArray(choices))throw Error("Kies nul tot dertig dagen voorbereiding.");
    const nodes=new Map<string,PreparationRow>();let visits=0;
    function expand(recipe:DemoRecipe,amount:number,date:string,path:string[],consumer?:PreparationRow) {
      if(++visits>2500 || path.length>20 || nodes.size>250)throw Error("De receptketen is te groot of te diep om automatisch te plannen.");
      for(const line of recipe.semiFinishedItems || []) {
        if(path.includes(line.recipeId))throw Error("De receptkoppelingen vormen een kring. Herstel deze vóór automatisch plannen.");
        if(!Number.isFinite(line.quantity) || line.quantity<=0)throw Error(`Vul de hoeveelheid van een halffabricaat in bij ${recipe.name}.`);
        const child=recipes.find(r=>r.id===line.recipeId);
        if(!child || (child.type && child.type!=="semiFinished"))throw Error(`Een halffabricaat bij ${recipe.name} ontbreekt of heeft een onjuist type.`);
        const item=state.items.find(i=>i.id===`recipe:${child.id}` && i.recipeId===child.id) || state.items.find(i=>i.recipeId===child.id && i.kind==="component");
        if(!item || item.unit!==child.unit)throw Error(`Controleer het onderdeel en de eenheid van ${child.name}.`);
        const choice=choices[child.id] || {};
        if(typeof choice!=="object" || choice===null || (choice.include!==undefined && typeof choice.include!=="boolean"))throw Error("Ongeldige keuze voor een halffabricaat.");
        const included=choice.include!==false;
        if(included && (!(child.yield>0) || child.reviewRequired || item.productionBlocked))throw Error(`Controleer de basisopbrengst en grondstofkoppelingen van ${child.name}.`);
        const needed=convert(line.quantity*amount/recipe.yield,line.unit,child.unit);
        if(!Number.isFinite(needed) || needed<=0 || needed>1000000)throw Error(`Ongeldige benodigde hoeveelheid bij ${child.name}.`);
        const plannedDate=choice.date || addDays(date,-daysBefore);addDays(plannedDate,0);
        const departmentId=choice.departmentId || item.departmentId;
        if(!DEPARTMENTS.some(d=>d.id===departmentId))throw Error("Kies een geldige afdeling voor ieder halffabricaat.");
        let row=nodes.get(child.id);
        if(!row) {row={recipeId:child.id,itemId:item.id,name:child.name,quantity:0,unit:item.unit,recipeCount:0,date:plannedDate,latestDate:date,departmentId,departmentUnconfirmed:!!item.departmentUnconfirmed&&!choice.departmentId,included,requires:[]};nodes.set(child.id,row);}
        row.quantity+=needed;row.recipeCount=child.yield>0?row.quantity/child.yield:0;
        if(plannedDate<row.date)row.date=plannedDate;
        if(date<row.latestDate)row.latestDate=date;
        if(included) {
          if(consumer && !consumer.requires.includes(child.id))consumer.requires.push(child.id);
          expand(child,needed,plannedDate,[...path,child.id],row);
        }
      }
    }
    expand(root,result.quantity,command.task.date,[root.id]);
    result.rows=[...nodes.values()].map(row=>({...row,quantity:stableQuantity(row.quantity),recipeCount:stableQuantity(row.recipeCount)}));
    if(result.rows.some(row=>row.quantity>1000000))throw Error("De totale benodigde hoeveelheid is te groot.");
    // Keep the complete proposal editable when a date is too late. Saving still
    // rejects every error, including the earliest use of shared preparations.
    for(const row of result.rows) {
      if(row.included && row.date>row.latestDate)result.errors.push(`${row.name} moet op of vóór de gebruiksdatum ${dateLabel(row.latestDate,true)} worden ingepland. Pas de datum bij dit halffabricaat aan.`);
    }
  } catch(error) { result.errors.push(error instanceof Error?error.message:"Het voorstel kon niet worden berekend."); }
  return result;
}

export function buildRecipePlan(state:PreviewState,recipes:DemoRecipe[],command:PlanCommand):PreviewState {
  const proposal=preparationProposal(state,recipes,command);
  if(proposal.errors.length)throw Error(proposal.errors[0]);
  const rootItem=state.items.find(i=>i.id===command.task.itemId)!;
  const recipe=recipes.find(r=>r.id===rootItem.recipeId);
  const included=proposal.rows.filter(r=>r.included);
  const taskIds=new Map(included.map((row,index)=>[row.recipeId,`${command.task.id}:prep:${index}`]));
  let next=state;
  const added=new Set<string>();
  function addPreparation(row:PreparationRow) {
    if(added.has(row.recipeId))return;
    for(const id of row.requires) {const dependency=included.find(r=>r.recipeId===id);if(dependency)addPreparation(dependency);}
    const task:Task={id:taskIds.get(row.recipeId)!,itemId:row.itemId,departmentId:row.departmentId,date:row.date,quantity:row.quantity,
      operation:"Bereiden",status:"planned",note:`Meegepland voor ${rootItem.name} · ${proposal.quantity.toLocaleString("nl-NL",{maximumFractionDigits:1})} ${rootItem.unit} op ${command.task.date}.`,
      source:command.task.source,batchId:`batch:${taskIds.get(row.recipeId)!}`,recordsOutput:true,generatedFor:command.task.id,
      requires:row.requires.map(id=>taskIds.get(id)!).filter(Boolean)};
    next=addTask(next,task);added.add(row.recipeId);
  }
  for(const row of included)addPreparation(row);
  const directIds=new Set(recipe?.semiFinishedItems?.map(line=>line.recipeId) || []);
  // Do not spread untrusted dependency metadata from the browser into a task.
  const draft=command.task;
  const root:Task={id:draft.id,itemId:draft.itemId,departmentId:draft.departmentId,date:draft.date,quantity:proposal.quantity,operation:draft.operation,status:draft.status,
    note:draft.note,source:draft.source,batchId:draft.batchId,recordsOutput:draft.recordsOutput,
    ...(draft.minutes!==undefined?{minutes:draft.minutes}:{}),...(draft.dueDate?{dueDate:draft.dueDate}:{}),...(draft.dependsOn?{dependsOn:draft.dependsOn}:{}),
    ...(included.length?{requires:included.filter(r=>directIds.has(r.recipeId)).map(r=>taskIds.get(r.recipeId)!)}:{}),
    recipePlan:{amount:command.amount,amountMode:command.amountMode,...(command.preparation?{preparation:{daysBefore:command.preparation.daysBefore,choices:Object.fromEntries(proposal.rows.filter(r=>command.preparation!.choices[r.recipeId]).map(r=>{const c=command.preparation!.choices[r.recipeId];return [r.recipeId,{...(c.include!==undefined?{include:c.include}:{}),...(c.date?{date:c.date}:{}),...(c.departmentId?{departmentId:c.departmentId}:{})}];}))}}:{})}};
  return addTask(next,root);
}

/** Reconstruct older plans too. Existing dates/departments take precedence over
 * saved preferences because a colleague may have moved a task on the board. */
export function currentPlanCommand(state:PreviewState,task:Task):PlanCommand {
  const saved=task.recipePlan;
  const children=state.tasks.filter(t=>t.generatedFor===task.id);
  const preparation=saved?.preparation || (children.length?{daysBefore:1,choices:{}}:undefined);
  const choices={...preparation?.choices};
  for(const child of children) {
    const recipeId=state.items.find(i=>i.id===child.itemId)?.recipeId;
    if(recipeId)choices[recipeId]={...choices[recipeId],include:true,date:child.date,departmentId:child.departmentId};
  }
  return {task:{...task},amount:saved?.amount || task.quantity,amountMode:saved?.amountMode || "quantity",...(preparation?{preparation:{daysBefore:preparation.daysBefore,choices}}:{})};
}
export type PlanChange={name:string;unit:string;before?:number;after?:number;detail?:string};
export function recipePlanChanges(state:PreviewState,recipes:DemoRecipe[],task:Task,command=currentPlanCommand(state,task)) {
  const proposal=preparationProposal(state,recipes,command),changes:PlanChange[]=[];
  const children=state.tasks.filter(t=>t.generatedFor===task.id);
  const rows=proposal.rows.filter(r=>r.included);
  const item=state.items.find(i=>i.id===task.itemId);
  if(Math.abs(proposal.quantity-task.quantity)>1e-8)changes.push({name:item?.name || "Product",unit:item?.unit || "",before:task.quantity,after:proposal.quantity});
  for(const child of children) {
    const row=rows.find(r=>r.itemId===child.itemId),part=state.items.find(i=>i.id===child.itemId);
    if(!row)changes.push({name:part?.name || "Halffabricaat",unit:part?.unit || "",before:child.quantity});
    else if(Math.abs(row.quantity-child.quantity)>1e-8)changes.push({name:row.name,unit:row.unit,before:child.quantity,after:row.quantity});
    else {
      const oldRequires=requiredTaskIds(child).map(id=>state.tasks.find(t=>t.id===id)?.itemId).sort();
      const nextRequires=row.requires.map(id=>rows.find(r=>r.recipeId===id)?.itemId).sort();
      if(JSON.stringify(oldRequires)!==JSON.stringify(nextRequires))changes.push({name:row.name,unit:row.unit,before:child.quantity,after:row.quantity,detail:"Benodigde halffabricaten gewijzigd"});
    }
  }
  for(const row of rows)if(!children.some(t=>t.itemId===row.itemId))changes.push({name:row.name,unit:row.unit,after:row.quantity});
  const direct=recipes.find(r=>r.id===item?.recipeId)?.semiFinishedItems || [];
  const oldDirect=(task.requires || []).map(id=>state.tasks.find(t=>t.id===id)?.itemId).sort();
  const nextDirect=rows.filter(r=>direct.some(d=>d.recipeId===r.recipeId)).map(r=>r.itemId).sort();
  if(JSON.stringify(oldDirect)!==JSON.stringify(nextDirect) && !changes.length)changes.push({name:item?.name || "Product",unit:item?.unit || "",detail:"Volgorde van halffabricaten gewijzigd"});
  return {changes,errors:proposal.errors,changed:!!changes.length || !!proposal.errors.length};
}
export function recipePlanUpdateBlock(state:PreviewState,task:Task):string|undefined {
  const group=state.tasks.filter(t=>t.id===task.id || t.generatedFor===task.id),ids=new Set(group.map(t=>t.id));
  if(task.generatedFor || task.dependsOn)return "Werk de eerste productiestap bij; deze taak hoort bij een andere productiestap.";
  if(group.some(t=>t.status!=="planned"))return "Deze productie of een halffabricaat is al gestart, afgerond of geblokkeerd. De bestaande registratie blijft behouden; beoordeel de wijziging handmatig.";
  if(state.tasks.some(t=>!ids.has(t.id) && requiredTaskIds(t).some(id=>id!==task.id && ids.has(id))))return "Een halffabricaat wordt ook door een andere productie gebruikt. Controleer die koppeling eerst.";
}
export function refreshRecipePlan(state:PreviewState,recipes:DemoRecipe[],id:string,command:PlanCommand):PreviewState {
  const root=state.tasks.find(t=>t.id===id);if(!root)throw Error("De oorspronkelijke productietaak ontbreekt.");
  const block=recipePlanUpdateBlock(state,root);if(block)throw Error(block);
  if(command.task.id!==id || command.task.itemId!==root.itemId || command.task.batchId!==root.batchId || command.task.recordsOutput!==root.recordsOutput || command.task.status!=="planned" || command.task.dependsOn)throw Error("De oorspronkelijke productietaak en batch moeten behouden blijven.");
  const children=state.tasks.filter(t=>t.generatedFor===id),ids=new Set([id,...children.map(t=>t.id)]);
  // Build independently so old preparation IDs cannot collide with new ones.
  const proposal=buildRecipePlan({...state,tasks:[]},recipes,command);
  const used=new Set([...state.tasks.map(t=>t.id),...(state.removedTasks || []).map(r=>r.task.id)]),mapped=new Map<string,string>([[id,id]]);
  for(const task of proposal.tasks.filter(t=>t.id!==id)) {
    const old=children.find(t=>t.itemId===task.itemId);
    let nextId=old?.id || `${id}:prep:update`;let n=0;
    while(!old && used.has(nextId))nextId=`${id}:prep:update:${++n}`;
    used.add(nextId);mapped.set(task.id,nextId);
  }
  const rebuilt=proposal.tasks.map(task=>{
    const old=children.find(t=>t.itemId===task.itemId),nextId=mapped.get(task.id)!;
    return {...task,...(old?{operation:old.operation,note:old.note.startsWith("Meegepland voor ")?task.note:old.note,minutes:old.minutes,batchId:old.batchId}:{}),id:nextId,
      ...(task.generatedFor?{generatedFor:id}:{}),...(task.requires?{requires:task.requires.map(required=>mapped.get(required)!)}:{}),
      ...(!old && task.id!==id?{batchId:`batch:${nextId}`}:{})};
  });
  return {...state,tasks:[...state.tasks.filter(t=>!ids.has(t.id)),...rebuilt]};
}
