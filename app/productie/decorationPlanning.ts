import { addDays, convertRecipeQuantity, productionRoute, type PreviewState, type DemoRecipe, type Task } from "./planning";

export type DecorationDecision = { fingerprint:string; status:"enough"|"planned"; actorId:string; at:string; productionTaskId?:string; productionQuantity?:number };
export type DecorationCheck = { id:string; fingerprint:string; taskId:string; ingredientId:string; code:string; name:string; product:string; date:string; quantity:number; method:"homemade"|"purchased"; status:"open"|"enough"|"planned"|"made"; productionTask?:Task };
export type DecorationCommand = { checkId:string; fingerprint:string; kind:"enough"|"reopen"|"plan"; date?:string; quantity?:number; minutes?:number };

/** A check belongs to one finishing task, never to a running stock balance. */
export function decorationChecks(state:PreviewState, recipes:DemoRecipe[]):DecorationCheck[] {
  const catalog=new Map(recipes.map(r=>[r.id,r]));
  return state.tasks.flatMap(task=>{
    if(task.status==="done" || task.stockFulfillmentId) return [];
    const item=state.items.find(i=>i.id===task.itemId);
    if(!item?.recipeId) return [];
    const recipe=state.productionWork?.overrides?.[task.id] || catalog.get(item.recipeId);
    if(!recipe?.yield || !recipe.decorations?.length) return [];
    const route=productionRoute(item,task);
    const finish=route && task.productionStage ? task.productionStage.stepId===route.steps.at(-1) : /afwerk|afmak|decor|finish/i.test(task.operation) || task.recordsOutput;
    if(!finish) return [];
    let amount:number;
    try {amount=convertRecipeQuantity(task.quantity,item.unit,recipe.unit)/recipe.yield;}catch{return [];}
    const grouped=new Map<string,NonNullable<DemoRecipe['decorations']>[number]>();
    for(const line of recipe.decorations) grouped.set(line.ingredientId,{...line,quantity:line.quantity+(grouped.get(line.ingredientId)?.quantity||0)});
    return [...grouped.values()].filter(line=>line.quantity>0).map(line=>{
      const quantity=Math.round(line.quantity*amount*1e6)/1e6;
      const id=JSON.stringify([task.id,line.ingredientId]);
      const fingerprint=JSON.stringify([task.id,task.itemId,item.unit,task.date,task.quantity,task.operation,recipe.id,recipe.yield,recipe.unit,line.ingredientId,line.quantity,line.signature]);
      const decision=state.decorationChecks?.[id];
      const valid=decision?.fingerprint===fingerprint;
      const producer=valid && decision.productionTaskId?state.tasks.find(t=>t.id===decision.productionTaskId):undefined;
      const status=valid && decision.status==="enough"?"enough":producer && producer.itemId===`decoration-work:${line.ingredientId}` && producer.status!=="blocked" && producer.date<=task.date && (producer.completedQuantity??producer.quantity)>=(decision?.productionQuantity??quantity)?(producer.status==="done"?"made":"planned"):"open";
      return {id,fingerprint,taskId:task.id,ingredientId:line.ingredientId,code:line.code,name:line.name,product:item.name,date:task.date,quantity,method:line.method,status,productionTask:producer} as DecorationCheck;
    });
  }).sort((a,b)=>a.date.localeCompare(b.date)||a.code.localeCompare(b.code,"nl",{numeric:true})||a.product.localeCompare(b.product));
}

export function applyDecorationCommand(state:PreviewState,recipes:DemoRecipe[],command:DecorationCommand,actorId:string,at:string,createId:()=>string):PreviewState {
  if(!command || !["enough","reopen","plan"].includes(command.kind))throw Error("Kies een geldige decoratieactie.");
  const check=decorationChecks(state,recipes).find(row=>row.id===command.checkId);
  if(!check || check.fingerprint!==command.fingerprint)throw Error("Deze afwerking of decoratie is gewijzigd. Ververs de controlelijst.");
  const decisions={...state.decorationChecks};
  if(command.kind==="reopen") {delete decisions[check.id];return {...state,decorationChecks:decisions};}
  if(command.kind==="enough") {
    if(check.status==="enough")return state;
    decisions[check.id]={fingerprint:check.fingerprint,status:"enough",actorId,at};
    return {...state,decorationChecks:decisions};
  }
  if(check.status==="planned" || check.status==="made")return state;
  const date=command.date || check.date;addDays(date,0);
  if(date>check.date)throw Error("Plan de decoratie op of vóór de afwerkdatum.");
  const quantity=command.quantity;
  // The chocolatier may choose only the missing amount. This decision is not
  // a count of existing stock and does not create a balance or reservation.
  if(!Number.isSafeInteger(quantity) || quantity!<1 || quantity!>1000000)throw Error("Vul een positief, heel aantal te maken decoraties in.");
  if(command.minutes!==undefined && (!Number.isFinite(command.minutes)||command.minutes<0||command.minutes>1440))throw Error("Vul een tijd tussen 0 en 1440 minuten in.");
  const id=createId(),itemId=`decoration-work:${check.ingredientId}`;
  const item={id:itemId,name:check.name,kind:"activity" as const,departmentId:"chocolade" as const,unit:"stuks" as const,note:"Chocoladedecoratie",stock:0,stockKnown:false};
  const task:Task={id,itemId,departmentId:"chocolade",date,quantity:quantity!,operation:check.method==="purchased"?"Klaarzetten / bestellen":"Decoraties maken",status:"planned",note:`Voor ${check.product} · afwerken ${check.date} · ${check.quantity.toLocaleString("nl")} stuks nodig.`,source:"manual",dueDate:check.date,batchId:`batch:${id}`,recordsOutput:false,...(command.minutes!==undefined?{minutes:command.minutes}:{})};
  decisions[check.id]={fingerprint:check.fingerprint,status:"planned",productionTaskId:id,productionQuantity:quantity,actorId,at};
  return {...state,items:state.items.some(i=>i.id===itemId)?state.items:[...state.items,item],tasks:[...state.tasks,task],decorationChecks:decisions};
}

export function validDecorationDecisions(value:unknown):boolean {
  if(!value || typeof value!=="object" || Array.isArray(value) || Object.keys(value).length>30000)return false;
  return Object.entries(value).every(([id,d])=>id.length<=600 && d && typeof d==="object" && typeof d.fingerprint==="string" && d.fingerprint.length<=4000 && ["enough","planned"].includes(d.status) && typeof d.actorId==="string" && d.actorId.length>0 && d.actorId.length<=200 && typeof d.at==="string" && Number.isFinite(Date.parse(d.at)) && (d.status==="enough"?d.productionTaskId===undefined:typeof d.productionTaskId==="string"&&d.productionTaskId.length<=250));
}
