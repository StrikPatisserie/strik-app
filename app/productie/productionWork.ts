import { addDays, addItem, transitionTask, type DemoRecipe, type DepartmentId, type PreviewState, type Task } from "./planning";
import { buildRecipePlan, type PlanCommand } from "./recipePlanning";

export type Change = { id:string; itemId:string; taskId?:string; who:string; at:string; actorId?:string; kind:"recipe"|"time"|"preparation"; scope:"once"|"permanent"; summary:string; before?:DemoRecipe; after?:DemoRecipe };
export type WorkTime = { id:string; taskId:string; itemId:string; operation:string; quantity:number; minutes:number; who:string; at:string; actorId?:string; timerId?:string; measuredMs?:number; plannedQuantity?:number;crewSize?:number;laborMinutes?:number;recipeKey?:string;estimateEligible?:boolean };
export type WorkTimer = {id:string;who:string;startedAt:string;runningSince?:string;elapsedMs:number;actorId?:string;crewSize?:number;recipeKey?:string};
export type Completion = {id:string;who:string;at:string;minutes:number;quantity:number;plannedQuantity:number;measuredMs?:number;timerId?:string;actorId?:string;crewSize?:number;laborMinutes?:number;measuredCrewSize?:number};
export type ScreenState = { version:1; planner:PreviewState; recipes:DemoRecipe[]; overrides:Record<string,DemoRecipe>; preparation:Record<string,number>; history:Change[]; work:WorkTime[];timers?:Record<string,WorkTimer>;completions?:Record<string,Completion> };
function validCrew(value:number|undefined){if(value!==undefined&&(!Number.isInteger(value)||value<1||value>20))throw Error("Kies 1 tot 20 medewerkers.");return value;}
function actor(value:string) { const name=value.trim();if(name.length<2||name.length>80)throw Error("Vul je naam in (2–80 tekens).");return name; }
function timestamp(at:string){const value=Date.parse(at);if(!Number.isFinite(value))throw Error("Ongeldig tijdstip.");return value;}
export function elapsedMilliseconds(timer:WorkTimer|undefined,now:number){
  if(!timer)return 0;
  return Math.max(0,timer.elapsedMs+(timer.runningSince?Math.max(0,now-timestamp(timer.runningSince)):0));
}
export function timerLabel(ms:number){const total=Math.floor(Math.max(0,ms)/1000),seconds=String(total%60).padStart(2,"0"),minutes=String(Math.floor(total/60)%60).padStart(2,"0"),hours=Math.floor(total/3600);return hours?`${String(hours).padStart(2,"0")}:${minutes}:${seconds}`:`${minutes}:${seconds}`;}
export function startWorkTimer(state:ScreenState,taskId:string,name:string,id:string,at:string,crewSize?:number):ScreenState{
  const who=actor(name);validCrew(crewSize);timestamp(at);const task=state.planner.tasks.find(t=>t.id===taskId);
  if(!task||task.status==="done")throw Error("Heropen de taak voordat je opnieuw begint.");
  const current=state.timers?.[taskId];if(current?.runningSince)return state;
  const tasks=transitionTask(state.planner.tasks,taskId,"active",state.planner.items);
  const timer:WorkTimer=current?{...current,runningSince:at}:{id,who,startedAt:at,runningSince:at,elapsedMs:0,crewSize,recipeKey:productionRecipeKey(state,task.itemId)};
  return {...state,planner:{...state.planner,tasks},timers:{...state.timers,[taskId]:timer}};
}
export function pauseWorkTimer(state:ScreenState,taskId:string,at:string):ScreenState{
  const now=timestamp(at),timer=state.timers?.[taskId];if(!timer?.runningSince)return state;
  const paused:WorkTimer={...timer,elapsedMs:elapsedMilliseconds(timer,now)};delete paused.runningSince;
  return {...state,timers:{...state.timers,[taskId]:paused}};
}
export function confirmTaskCompletion(state:ScreenState,input:{taskId:string;who:string;minutes:number;quantity:number;timerId?:string;crewSize?:number},id:string,at:string):ScreenState{
  const who=actor(input.who);timestamp(at);const task=state.planner.tasks.find(t=>t.id===input.taskId),existing=state.completions?.[input.taskId];
  if(!task)throw Error("Deze taak bestaat niet meer.");
  if(task.status==="done"){if(existing&&(existing.id===id||input.timerId&&existing.timerId===input.timerId))return state;throw Error("Deze productie is al afgerond.");}
  if(!Number.isFinite(input.minutes)||input.minutes<=0||input.minutes>1440)throw Error("Controleer de werktijd: meer dan 0 en maximaal 1440 minuten.");
  if(!Number.isFinite(input.quantity)||input.quantity<=0||input.quantity>1000000)throw Error("Controleer de gemaakte hoeveelheid.");
  const timer=state.timers?.[task.id];if(timer?.runningSince)throw Error("Stop de timer eerst en controleer de gemeten tijd.");
  if(timer?.id!==input.timerId)throw Error("De timer is intussen gewijzigd. Open de controle opnieuw.");
  const crewSize=validCrew(input.crewSize??timer?.crewSize),laborMinutes=crewSize===undefined?undefined:Math.round(input.minutes*crewSize*1000000)/1000000;
  const tasks=transitionTask(state.planner.tasks,task.id,"done",state.planner.items).map(t=>t.id===task.id?{...t,completedQuantity:input.quantity}:t);
  const completion:Completion={id,who,at,minutes:input.minutes,quantity:input.quantity,plannedQuantity:task.quantity,crewSize,laborMinutes,...(timer?{timerId:timer.id,measuredMs:timer.elapsedMs,measuredCrewSize:timer.crewSize}:{})};
  const recipeKey=productionRecipeKey(state,task.itemId);
  const log:WorkTime={...completion,taskId:task.id,itemId:task.itemId,operation:task.operation,recipeKey,estimateEligible:crewSize!==undefined&&!state.overrides[task.id]&&(!timer||timer.recipeKey===recipeKey)};
  return {...state,planner:{...state.planner,tasks},completions:{...state.completions,[task.id]:completion},work:[...state.work,log],history:[...state.history,{id,itemId:task.itemId,taskId:task.id,who,at,kind:"time",scope:"once",summary:`Afgerond: ${input.minutes.toLocaleString("nl-NL")} min${crewSize?` × ${crewSize} medewerkers = ${laborMinutes!.toLocaleString("nl-NL")} arbeidsmin`:""} · ${input.quantity.toLocaleString("nl-NL")} ${state.planner.items.find(i=>i.id===task.itemId)?.unit} gemaakt (gepland ${task.quantity.toLocaleString("nl-NL")}).`}]};
}
export function reopenTimedTask(state:ScreenState,taskId:string):ScreenState{
  const tasks=transitionTask(state.planner.tasks,taskId,"planned",state.planner.items).map(t=>{if(t.id!==taskId)return t;const copy={...t};delete copy.completedQuantity;return copy;}),timers={...state.timers},completions={...state.completions};delete timers[taskId];delete completions[taskId];
  return {...state,planner:{...state.planner,tasks},timers,completions};
}
export function taskRecipe(state:ScreenState,task:Task) {return state.overrides[task.id] || state.recipes.find(r=>r.id===state.planner.items.find(i=>i.id===task.itemId)?.recipeId);}
export function saveRecipeChange(state:ScreenState,input:{itemId:string;taskId?:string;scope:"once"|"permanent";who:string;recipe:DemoRecipe},id:string,at:string):ScreenState {
  const who=actor(input.who),item=state.planner.items.find(i=>i.id===input.itemId),task=state.planner.tasks.find(t=>t.id===input.taskId);
  if(!item||item.kind==="activity"||!["once","permanent"].includes(input.scope))throw Error("Kies een bestaand product of halffabricaat.");
  if(input.scope==="once"&&(!task||task.itemId!==item.id))throw Error("Een eenmalige wijziging hoort bij één productie.");
  const draft=input.recipe;
  if(!Number.isFinite(draft.yield)||draft.yield<=0||draft.yield>1000000||!draft.ingredients.length||draft.ingredients.length>100||!draft.steps.some(s=>s.trim()))throw Error("Vul de opbrengst, grondstoffen en werkwijze in.");
  if(draft.ingredients.some(l=>!l.name.trim()||!Number.isFinite(l.quantity)||l.quantity<=0||!l.unit.trim()))throw Error("Controleer de grondstofregels.");
  const before=input.scope==="once"?taskRecipe(state,task!):state.recipes.find(r=>r.id===item.recipeId);
  const recipe:DemoRecipe={...before,id:input.scope==="once"?`once:${task!.id}`:item.recipeId||`local:${item.id}`,name:item.name,type:item.kind==="component"?"semiFinished":"finalProduct",unit:item.unit,yield:draft.yield,ingredients:draft.ingredients.map(l=>({...l,name:l.name.trim()})),steps:draft.steps.map(s=>s.trim()).filter(Boolean),allergens:[...new Set([...(before?.allergens||[]),...(draft.allergens||[])])],semiFinishedItems:draft.semiFinishedItems||before?.semiFinishedItems||[],reviewRequired:draft.reviewRequired};
  const differences:string[]=[];
  if(before){
    if(before.yield!==recipe.yield)differences.push(`Basisopbrengst: ${before.yield} → ${recipe.yield} ${item.unit}`);
    for(const line of recipe.ingredients){const old=before.ingredients.find(l=>l.name===line.name);if(!old)differences.push(`${line.name} toegevoegd`);else if(old.quantity!==line.quantity||old.unit!==line.unit)differences.push(`${line.name}: ${old.quantity} ${old.unit} → ${line.quantity} ${line.unit}`);}
    for(const old of before.ingredients)if(!recipe.ingredients.some(l=>l.name===old.name))differences.push(`${old.name} verwijderd`);
    if(JSON.stringify(before.steps)!==JSON.stringify(recipe.steps))differences.push("Werkwijze aangepast");
    if(!differences.length)throw Error("Er zijn nog geen receptwijzigingen om te bewaren.");
  }
  const summary=before?`${differences.slice(0,4).join(" · ")}${differences.length>4?` · +${differences.length-4} wijzigingen`:""}`:"Werkrecept toegevoegd.";
  const change:Change={id,itemId:item.id,...(input.scope==="once"?{taskId:task!.id}:{}),who,at,kind:"recipe",scope:input.scope,summary,before:before?structuredClone(before):undefined,after:structuredClone(recipe)};
  return {...state,planner:input.scope==="permanent"?{...state.planner,items:state.planner.items.map(i=>i.id===item.id?{...i,recipeId:recipe.id}:i)}:state.planner,
    recipes:input.scope==="permanent"?[...state.recipes.filter(r=>r.id!==recipe.id),recipe]:state.recipes,
    overrides:input.scope==="once"?{...state.overrides,[task!.id]:recipe}:state.overrides,history:[...state.history,change]};
}
export function recordWorkTime(state:ScreenState,taskId:string,minutes:number,name:string,id:string,at:string):ScreenState {
  const who=actor(name),task=state.planner.tasks.find(t=>t.id===taskId);
  if(!task||!Number.isInteger(minutes)||minutes<=0||minutes>1440)throw Error("Vul 1 tot 1440 minuten in.");
  return {...state,work:[...state.work,{id,taskId,itemId:task.itemId,operation:task.operation,quantity:task.quantity,minutes,who,at}],history:[...state.history,{id,itemId:task.itemId,taskId,who,at,kind:"time",scope:"once",summary:`${minutes} minuten gewerkt · ${task.quantity} ${state.planner.items.find(i=>i.id===task.itemId)?.unit} · ${task.operation}`} ]};
}
export function setPreparation(state:ScreenState,recipeId:string,days:number,name:string,id:string,at:string):ScreenState {
  const who=actor(name),recipe=state.recipes.find(r=>r.id===recipeId),item=state.planner.items.find(i=>i.recipeId===recipeId);
  if(!recipe||recipe.type!=="semiFinished"||!item||!Number.isInteger(days)||days<0||days>30)throw Error("Kies een halffabricaat en 0 tot 30 dagen vooraf.");
  return {...state,preparation:{...state.preparation,[recipeId]:days},history:[...state.history,{id,itemId:item.id,who,at,kind:"preparation",scope:"permanent",summary:`Voorbereiding: ${state.preparation[recipeId]??1} → ${days} dagen vóór gebruik.`}]};
}
export function planScreenTask(state:ScreenState,input:{itemId?:string;name?:string;departmentId:DepartmentId;date:string;quantity:number;id:string;prepare:boolean}):ScreenState {
  let planner=state.planner,item=planner.items.find(i=>i.id===input.itemId);
  if(!item){if(!input.name?.trim())throw Error("Kies een product of geef een nieuwe naam op.");item={id:`item:${input.id}`,name:input.name.trim(),kind:"product",departmentId:input.departmentId,unit:"stuks",stock:0,note:"Recept nog aanvullen."};planner=addItem(planner,item);}
  const recipe=state.recipes.find(r=>r.id===item.recipeId),choices:Record<string,{date:string}>={};
  function dates(root:DemoRecipe,date:string,path:string[]) {
    if(path.length>20||path.includes(root.id))throw Error("Controleer de halffabricaatkoppelingen.");
    for(const line of root.semiFinishedItems||[]){const child=state.recipes.find(r=>r.id===line.recipeId);if(!child)throw Error("Een halffabricaat ontbreekt.");const next=addDays(date,-(state.preparation[child.id]??1));if(!choices[child.id]||next<choices[child.id].date)choices[child.id]={date:next};dates(child,next,[...path,root.id]);}
  }
  if(input.prepare&&recipe)dates(recipe,input.date,[]);
  const command:PlanCommand={task:{id:input.id,itemId:item.id,departmentId:input.departmentId,date:input.date,operation:recipe?.semiFinishedItems?.length?"Afwerken":"Produceren",status:"planned",note:"",source:"manual",batchId:`batch:${input.id}`,recordsOutput:true},amount:input.quantity,amountMode:"quantity",...(input.prepare&&recipe?.semiFinishedItems?.length?{preparation:{daysBefore:1,choices}}:{})};
  return {...state,planner:buildRecipePlan(planner,state.recipes,command)};
}
export function workEstimate(state:ScreenState,itemId:string,operation:string,quantity:number){
  const records=state.work.filter(w=>w.itemId===itemId&&w.operation===operation),units=records.reduce((n,w)=>n+w.quantity,0);
  return records.length&&units>0?{minutes:Math.round(records.reduce((n,w)=>n+w.minutes,0)/units*quantity),measurements:records.length}:null;
}

/** Operational fingerprint, not an authorization token. Recipe edits start a
 * fresh estimate group; one-off variants never silently redefine the norm. */
export function productionRecipeKey(state:ScreenState,itemId:string){
 const item=state.planner.items.find(i=>i.id===itemId),recipe=state.recipes.find(r=>r.id===item?.recipeId);
 const input=JSON.stringify({unit:item?.unit,recipe:recipe?{yield:recipe.yield,unit:recipe.unit,ingredients:recipe.ingredients,steps:recipe.steps,semiFinishedItems:recipe.semiFinishedItems}:null});
 let first=2166136261,second=5381;
 for(let i=0;i<input.length;i++){first=Math.imul(first^input.charCodeAt(i),16777619);second=Math.imul(second,33)^input.charCodeAt(i);}
 return `v1:${input.length}:${(first>>>0).toString(16)}:${(second>>>0).toString(16)}`;
}
export function learnedWorkEstimate(state:ScreenState,itemId:string,operation:string,quantity:number,crewSize=1){
 if(!Number.isFinite(quantity)||quantity<=0||!Number.isInteger(crewSize)||crewSize<1||crewSize>20)return null;
 const recipeKey=productionRecipeKey(state,itemId);
 const latest=new Map<string,WorkTime>();
 for(const row of state.work){
  if(row.itemId!==itemId||row.operation.trim().toLowerCase()!==operation.trim().toLowerCase()||row.estimateEligible!==true||row.recipeKey!==recipeKey||!Number.isFinite(row.laborMinutes)||!(row.laborMinutes!>0)||!Number.isFinite(row.quantity)||row.quantity<=0||state.completions?.[row.taskId]?.id!==row.id)continue;
  latest.delete(row.taskId);latest.set(row.taskId,row);
 }
 const records=[...latest.values()].slice(-20);
 const units=records.reduce((sum,row)=>sum+row.quantity,0);
 if(!records.length||units<=0)return null;
 const laborMinutes=records.reduce((sum,row)=>sum+row.laborMinutes!,0)/units*quantity;
 return {minutes:Math.max(.01,Math.round(laborMinutes/crewSize*100)/100),laborMinutes:Math.max(.01,Math.round(laborMinutes*100)/100),crewSize,measurements:records.length};
}

export type ProductionWorkState = Pick<ScreenState,"overrides"|"preparation"|"history"|"work"|"timers"|"completions"> & {receipts?:{id:string;actorId:string;at:string}[];recipeDrafts?:Record<string,import('./workRecipe').WorkRecipeInput>};
export type WorkCommand =
 | {kind:"start";taskId:string;who:string;crewSize?:number}
 | {kind:"pause";taskId:string}
 | {kind:"complete";taskId:string;who:string;minutes:number;quantity:number;timerId?:string;crewSize?:number}
 | {kind:"reopen";taskId:string}
 | {kind:"preparation";recipeId:string;days:number;who:string};
export function workView(state:PreviewState,recipes:DemoRecipe[]):ScreenState{return{version:1,planner:state,recipes,overrides:state.productionWork?.overrides||{},preparation:state.productionWork?.preparation||{},history:state.productionWork?.history||[],work:state.productionWork?.work||[],timers:state.productionWork?.timers||{},completions:state.productionWork?.completions||{}};}
export function storeWork(view:ScreenState,previous:PreviewState["productionWork"]):PreviewState{return{...view.planner,productionWork:{...previous,overrides:view.overrides,preparation:view.preparation,history:view.history,work:view.work,timers:view.timers,completions:view.completions}};}
