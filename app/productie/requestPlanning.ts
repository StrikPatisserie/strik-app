import {validProductionRequests,addItem,addTask,addDays,DEPARTMENTS,departmentsFor,type PreviewState,type BoardId,type DepartmentId,type DemoRecipe,type Item,type ItemUnit,type ItemKind,type Task,recipeProductionTasks,requiredTaskIds} from './planning';
import {buildRecipePlan} from './recipePlanning';
import {recipeMaterialNeeds} from './materialPlanning';
import {combineTaskOperation} from './taskOperations';
export type ProductionRequest={id:string;itemId:string;quantity:number;departmentId?:DepartmentId|null;neededBy?:string;note:string;createdBy:string;createdAt:string;updatedBy?:string;updatedAt?:string;cancelledAt?:string;plannedTaskId?:string;returnedPlan?:{date:string;operation:string;recordsOutput?:boolean;minutes?:number;preparation?:NonNullable<Task['recipePlan']>['preparation'];steps?:{daysAfter:number;departmentId:DepartmentId;operation:string;quantityFactor:number;recordsOutput?:boolean;minutes?:number;note:string}[]}};
type RequestDetails={itemId:string;quantity:number;departmentId?:DepartmentId|null;neededBy?:string;note:string;newItem?:{name:string;unit:ItemUnit;kind:ItemKind;departmentId?:DepartmentId}};
export type RequestCommand=({kind:'create'}&RequestDetails)|({kind:'edit';id:string}&RequestDetails)|{kind:'return';id:string}|{kind:'cancel';id:string}|{kind:'move';id:string;departmentId:DepartmentId|null}|{kind:'plan';id:string;date:string;departmentId:DepartmentId;minutes?:number;pour?:boolean};
export function requestDepartmentId(request:ProductionRequest,item?:Pick<Item,'departmentId'>):DepartmentId|null{
 // Older requests inherited the product's department. Null is explicitly unassigned.
 return request.departmentId===undefined?item?.departmentId??null:request.departmentId;
}
export function requestsForBoard<T extends ProductionRequest>(requests:T[],items:Pick<Item,'id'|'departmentId'>[],board?:BoardId):T[]{
 const catalog=new Map(items.map(item=>[item.id,item]));
 const boardDepartments=board?new Set<DepartmentId>(departmentsFor(board).map(department=>department.id)):null;
 return requests.filter(request=>{
  const departmentId=requestDepartmentId(request,catalog.get(request.itemId));
  return !request.cancelledAt&&(!boardDepartments||departmentId===null||boardDepartments.has(departmentId));
 });
}
export function requestPlanningTask(state:PreviewState,request:ProductionRequest):Task|undefined{
 if(!request.plannedTaskId)return undefined;
 return state.tasks.find(task=>task.id===request.plannedTaskId)||state.tasks.find(task=>task.generatedFor===request.plannedTaskId);
}
export function canEditProductionRequest(state:PreviewState,request:ProductionRequest){
 if(request.cancelledAt||requestPlanningTask(state,request))return false;
 const root=request.plannedTaskId;
 if(!root)return true;
 const related=(id:string)=>id===root||id.startsWith(`${root}:prep:`);
 const work=state.productionWork;
 return !Object.keys(work?.timers||{}).some(related)&&!Object.keys(work?.completions||{}).some(related)&&!Object.keys(work?.stockFulfillments||{}).some(related)&&!work?.work?.some(row=>related(row.taskId));
}
export function requestPlanningUrl(state:PreviewState,request:ProductionRequest){
 const task=requestPlanningTask(state,request)||state.removedTasks?.find(row=>row.task.id===request.plannedTaskId)?.task;
 if(!task)return undefined;
 const query=new URLSearchParams({view:'planning',date:task.date,department:task.departmentId,task:task.id});
 return `/bakkerij/productie?${query}`;
}
/** Move an unstarted production back without erasing work or another order's batch. */
export function returnProductionTask(state:PreviewState,recipes:DemoRecipe[],taskId:string,actor:string,now:string,id:string):PreviewState {
 const root=state.tasks.find(task=>task.id===taskId),item=state.items.find(item=>item.id===root?.itemId);
 if(!root||!item||item.kind==='activity'||root.weddingCode)throw Error('Kies een geplande productietaak.');
 if(root.generatedFor||root.dependsOn)throw Error('Open het bijbehorende eindproduct om de hele productie terug te zetten.');
 const group=recipeProductionTasks(state.tasks,root.id),groupIds=new Set(group.map(task=>task.id));
 const batchSteps=group.filter(task=>task.batchId===root.batchId&&task.id!==root.id).sort((a,b)=>a.date.localeCompare(b.date));
 let previousStep=root.id;
 for(const step of batchSteps){if(step.dependsOn!==previousStep||step.requires?.length)throw Error('Deze batch heeft aparte afhankelijkheden. Verplaats de stappen samen in de planning.');previousStep=step.id;}
 const work=state.productionWork;
 const touched=(task:Task)=>task.status!=='planned'||!!work?.timers?.[task.id]||!!work?.completions?.[task.id]||!!work?.stockFulfillments?.[task.id]||!!work?.overrides?.[task.id]||!!work?.recipeDrafts?.[task.id]||!!work?.work?.some(row=>row.taskId===task.id)||!!work?.history?.some(row=>row.taskId===task.id);
 if(group.some(touched))throw Error('Deze productie is al gestart of heeft registraties. De gemaakte aantallen blijven in de planning.');
 const affected=new Set(groupIds);
 const includeRequired=(task:Task)=>{for(const id of requiredTaskIds(task)){if(affected.has(id))continue;affected.add(id);const part=state.tasks.find(row=>row.id===id);if(part)includeRequired(part);}};
 for(const task of group)includeRequired(task);
 const kept=new Set<string>();
 const keep=(id:string)=>{if(kept.has(id)||!affected.has(id))return;kept.add(id);for(const required of requiredTaskIds(state.tasks.find(task=>task.id===id)!))keep(required);};
 for(const id of affected)if(!groupIds.has(id))keep(id);
 for(const task of state.tasks.filter(task=>!groupIds.has(task.id)))for(const required of requiredTaskIds(task))keep(required);
 if(kept.has(root.id))throw Error('Een andere productie gebruikt deze taak. Verplaats de taak in de planning.');
 const removed=new Set(group.filter(task=>!kept.has(task.id)).map(task=>task.id));
 const quantities=new Map<string,number>(),changes=new Map<string,Task>(),visiting=new Set<string>();
 function resize(task:Task):number {
  if(removed.has(task.id))return 0;
  if(quantities.has(task.id))return quantities.get(task.id)!;
  if(!kept.has(task.id))return task.quantity;
  if(visiting.has(task.id))throw Error('Controleer de gekoppelde productiestappen.');
  visiting.add(task.id);let reduction=0;
  for(const consumer of state.tasks.filter(row=>requiredTaskIds(row).includes(task.id))){
   const after=resize(consumer);
   if(after===consumer.quantity)continue;
   const need=(consumer.materialNeeds||recipeMaterialNeeds(state,recipes,consumer))[task.id];
   if(!need||consumer.dependsOn===task.id)throw Error('De verdeling van deze gedeelde batch moet eerst worden gecontroleerd.');
   reduction+=need*(1-after/consumer.quantity);
  }
  const quantity=Math.round((task.quantity-reduction)*1e9)/1e9;
  if(!(quantity>0))throw Error('Controleer eerst de hoeveelheid van de gedeelde batch.');
  quantities.set(task.id,quantity);visiting.delete(task.id);
  if(quantity!==task.quantity||removed.has(task.generatedFor||'')){
   if(touched(task))throw Error('Een gedeelde batch is al gestart. Verplaats het eindproduct in de planning.');
   const owner=state.tasks.find(row=>!removed.has(row.id)&&row.requires?.includes(task.id));
   changes.set(task.id,{...task,quantity,materialNeeds:Object.fromEntries(Object.entries(task.materialNeeds||recipeMaterialNeeds(state,recipes,task)).map(([key,amount])=>[key,Math.round(amount*quantity/task.quantity*1e9)/1e9])),...(task.minutes!==undefined?{minutes:task.minutes*quantity/task.quantity}:{}),...(removed.has(task.generatedFor||'')?{generatedFor:owner?.id}: {})});
  }
  return quantity;
 }
 for(const task of state.tasks.filter(task=>kept.has(task.id)))resize(task);
 // Keep each preparation's actual date; shift all dates equally when replanning.
 const preparation=root.recipePlan?.preparation?structuredClone(root.recipePlan.preparation):undefined;
 if(preparation){
  for(const part of state.tasks.filter(task=>affected.has(task.id)&&task.id!==root.id&&task.batchId!==root.batchId)){
   const recipeId=state.items.find(item=>item.id===part.itemId)?.recipeId;
   if(recipeId)preparation.choices[recipeId]={...preparation.choices[recipeId],include:true,date:part.date,departmentId:part.departmentId,operation:part.operation};
  }
  preparation.combine=true;
 }
 const previous=(state.productionRequests||[]).find(request=>!request.cancelledAt&&request.plannedTaskId===root.id);
 const request:ProductionRequest={...(previous||{id,itemId:item.id,createdBy:actor,createdAt:now}),quantity:root.quantity,departmentId:root.departmentId,note:(previous?.note||root.note).slice(0,2000),updatedBy:actor,updatedAt:now,returnedPlan:{date:root.date,operation:root.operation,recordsOutput:root.recordsOutput,...(root.minutes!==undefined?{minutes:root.minutes}:{}),...(preparation?{preparation}:{}),...(batchSteps.length?{steps:batchSteps.map(step=>({daysAfter:Math.round((Date.parse(step.date)-Date.parse(root.date))/86400000),departmentId:step.departmentId,operation:step.operation,quantityFactor:step.quantity/root.quantity,recordsOutput:step.recordsOutput??true,note:step.note,...(step.minutes!==undefined?{minutes:step.minutes}:{})}))}:{})},...(root.dueDate?{neededBy:root.dueDate}:{})};
 delete request.plannedTaskId;
 return {...state,tasks:state.tasks.filter(task=>!removed.has(task.id)).map(task=>changes.get(task.id)||task),removedTasks:[...(state.removedTasks||[]),...state.tasks.filter(task=>removed.has(task.id)).map(task=>({task,removedAt:now,removedBy:actor}))],productionRequests:previous?(state.productionRequests||[]).map(row=>row.id===previous.id?request:row):[...(state.productionRequests||[]),request]};
}
export function applyProductionRequest(state:PreviewState,recipes:DemoRecipe[],command:RequestCommand,actor:string,now:string,id:string):PreviewState{
 const requests=state.productionRequests||[];
 if(!validProductionRequests(requests))throw Error('De bestaande verzoeken moeten eerst worden gecontroleerd.');
 if(command.kind==='return')return returnProductionTask(state,recipes,command.id,actor,now,id);
 let next=state;
 if(command.kind==='create'||command.kind==='edit'){
  if(command.neededBy!==undefined&&typeof command.neededBy!=='string')throw Error('Controleer de gewenste datum.');
  const existing=command.kind==='edit'?requests.find(request=>request.id===command.id):undefined;
  if(command.kind==='edit'&&(!existing||existing.cancelledAt))throw Error('Dit verzoek bestaat niet meer of is ingetrokken. Ververs de lijst.');
  if(existing&&!canEditProductionRequest(state,existing))throw Error('Dit verzoek staat al in de planning of heeft productieregistraties. Pas de taak aan in de weekplanning.');
  let departmentId=command.departmentId;
  if(departmentId===undefined)departmentId=existing?requestDepartmentId(existing,state.items.find(item=>item.id===existing.itemId)):command.newItem?.departmentId??null;
  if(departmentId!==null&&!DEPARTMENTS.some(department=>department.id===departmentId))throw Error('Kies een geldige afdeling of nog geen afdeling.');
  if(command.newItem?.departmentId!==undefined&&!DEPARTMENTS.some(department=>department.id===command.newItem?.departmentId))throw Error('Kies een geldige afdeling of nog geen afdeling.');
  let itemId=command.itemId;
  if(command.newItem){if(command.newItem.kind==='activity')throw Error('Kies een product of halffabricaat.');state=addItem(state,{id:`item:${id}`,name:command.newItem.name,unit:command.newItem.unit,kind:command.newItem.kind,departmentId:departmentId??'dessert',departmentUnconfirmed:departmentId===null,note:'',stock:0,stockKnown:false});itemId=`item:${id}`;}
  const item=state.items.find(i=>i.id===itemId&&i.kind!=='activity');
  if(!item||item.productionBlocked)throw Error('Kies een beschikbaar product of halffabricaat.');
  const request:ProductionRequest=existing?{...existing,itemId:item.id,quantity:command.quantity,departmentId,note:command.note,updatedBy:actor,updatedAt:now}:{id,itemId:item.id,quantity:command.quantity,departmentId,note:command.note,createdBy:actor,createdAt:now};
  if(command.neededBy)request.neededBy=command.neededBy;else delete request.neededBy;
  if(existing){delete request.plannedTaskId;if(existing.itemId!==item.id)delete request.returnedPlan;}
  const nextRequests=existing?requests.map(row=>row.id===existing.id?request:row):[...requests,request];
  if(!validProductionRequests(nextRequests))throw Error('Controleer de hoeveelheid, gewenste datum en opmerking.');
  return {...state,productionRequests:nextRequests};
 }
 const request=requests.find(r=>r.id===command.id);
 if(!request||request.cancelledAt)throw Error('Dit verzoek bestaat niet meer of is ingetrokken. Ververs de lijst.');
 if(!canEditProductionRequest(state,request))throw Error('Dit verzoek staat al in de planning of heeft productieregistraties. Open de weekplanning.');
 if(command.kind==='move'){
  if(command.departmentId!==null&&!DEPARTMENTS.some(department=>department.id===command.departmentId))throw Error('Kies een geldige afdeling of nog geen afdeling.');
  return {...state,productionRequests:requests.map(row=>row.id===request.id?{...row,departmentId:command.departmentId,updatedBy:actor,updatedAt:now}:row)};
 }
 if(command.kind==='cancel')return {...state,productionRequests:requests.map(r=>r.id===request.id?{...r,cancelledAt:now}:r)};
 if(command.kind!=='plan'||!DEPARTMENTS.some(d=>d.id===command.departmentId))throw Error('Kies een geldige productiedag en afdeling.');
 if(command.pour!==undefined&&typeof command.pour!=='boolean')throw Error('Controleer de keuze voor storten.');
 if(command.minutes!==undefined&&(!Number.isFinite(command.minutes)||command.minutes<0||command.minutes>1440))throw Error('Vul een geschatte tijd tussen 0 en 1440 minuten in.');
 addDays(command.date,0);
 if(request.neededBy&&command.date>request.neededBy)throw Error('Plan uiterlijk op de gewenste datum, of laat logistiek het verzoek aanpassen.');
 state={...state,items:state.items.map(item=>item.id===request.itemId&&item.departmentUnconfirmed?{...item,departmentId:command.departmentId,departmentUnconfirmed:false}:item)};
 next=buildRecipePlan(state,recipes,{task:{id,itemId:request.itemId,departmentId:command.departmentId,date:command.date,operation:combineTaskOperation(request.returnedPlan?.operation||'Produceren',command.pour?['storten']:[]),status:'planned',note:`Productieverzoek${request.note?`: ${request.note}`:''}`,source:'order',batchId:`batch:${id}`,recordsOutput:request.returnedPlan?.recordsOutput??true,...((command.minutes??request.returnedPlan?.minutes)!==undefined?{minutes:command.minutes??request.returnedPlan?.minutes}:{}),...(request.neededBy?{dueDate:request.neededBy}:{})},amount:request.quantity,amountMode:'quantity',...(request.returnedPlan?.preparation?{preparation:{...request.returnedPlan.preparation,choices:Object.fromEntries(Object.entries(request.returnedPlan.preparation.choices).map(([recipeId,choice])=>[recipeId,{...choice,...(choice.date?{date:addDays(choice.date,Math.round((Date.parse(command.date)-Date.parse(request.returnedPlan!.date))/86400000))}:{})}]))}}:{})});
 let priorId=id;
 for(const [index,step] of (request.returnedPlan?.steps||[]).entries()){
  const nextId=`${id}:step:${index+1}`;
  next=addTask(next,{id:nextId,itemId:request.itemId,departmentId:step.departmentId,date:addDays(command.date,step.daysAfter),quantity:request.quantity*step.quantityFactor,operation:step.operation,status:'planned',note:step.note,source:'order',batchId:`batch:${id}`,dependsOn:priorId,recordsOutput:step.recordsOutput??true,...(step.minutes!==undefined?{minutes:step.minutes}:{})});
  priorId=nextId;
 }
 return {...next,productionRequests:requests.map(r=>r.id===request.id?{...r,departmentId:command.departmentId,plannedTaskId:id}:r)};
}
