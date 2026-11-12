import {validProductionRequests,addItem,addDays,DEPARTMENTS,departmentsFor,type PreviewState,type BoardId,type DepartmentId,type DemoRecipe,type Item,type ItemUnit,type ItemKind,type Task} from './planning';
import {buildRecipePlan} from './recipePlanning';
import {combineTaskOperation} from './taskOperations';
export type ProductionRequest={id:string;itemId:string;quantity:number;departmentId?:DepartmentId|null;neededBy?:string;note:string;createdBy:string;createdAt:string;updatedBy?:string;updatedAt?:string;cancelledAt?:string;plannedTaskId?:string};
type RequestDetails={itemId:string;quantity:number;departmentId?:DepartmentId|null;neededBy?:string;note:string;newItem?:{name:string;unit:ItemUnit;kind:ItemKind;departmentId?:DepartmentId}};
export type RequestCommand=({kind:'create'}&RequestDetails)|({kind:'edit';id:string}&RequestDetails)|{kind:'cancel';id:string}|{kind:'move';id:string;departmentId:DepartmentId|null}|{kind:'plan';id:string;date:string;departmentId:DepartmentId;minutes?:number;pour?:boolean};
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
export function applyProductionRequest(state:PreviewState,recipes:DemoRecipe[],command:RequestCommand,actor:string,now:string,id:string):PreviewState{
 const requests=state.productionRequests||[];
 if(!validProductionRequests(requests))throw Error('De bestaande verzoeken moeten eerst worden gecontroleerd.');
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
  if(existing)delete request.plannedTaskId;
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
 next=buildRecipePlan(state,recipes,{task:{id,itemId:request.itemId,departmentId:command.departmentId,date:command.date,operation:combineTaskOperation('Produceren',command.pour?['storten']:[]),status:'planned',note:`Productieverzoek logistiek${request.note?`: ${request.note}`:''}`,source:'order',batchId:`batch:${id}`,recordsOutput:true,...(command.minutes!==undefined?{minutes:command.minutes}:{}),...(request.neededBy?{dueDate:request.neededBy}:{})},amount:request.quantity,amountMode:'quantity'});
 return {...next,productionRequests:requests.map(r=>r.id===request.id?{...r,departmentId:command.departmentId,plannedTaskId:id}:r)};
}
