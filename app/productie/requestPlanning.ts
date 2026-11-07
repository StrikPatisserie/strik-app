import {validProductionRequests,addItem,addDays,DEPARTMENTS,type PreviewState,type BoardId,type DepartmentId,type DemoRecipe,type Item,type ItemUnit,type ItemKind} from './planning';
import {buildRecipePlan} from './recipePlanning';
import {combineTaskOperation} from './taskOperations';
export type ProductionRequest={id:string;itemId:string;quantity:number;departmentId?:DepartmentId|null;neededBy?:string;note:string;createdBy:string;createdAt:string;cancelledAt?:string;plannedTaskId?:string};
export type RequestCommand={kind:'create';itemId:string;quantity:number;departmentId?:DepartmentId|null;neededBy?:string;note:string;newItem?:{name:string;unit:ItemUnit;kind:ItemKind;departmentId?:DepartmentId}}|{kind:'cancel';id:string}|{kind:'plan';id:string;date:string;departmentId:DepartmentId;minutes?:number;pour?:boolean};
export function requestDepartmentId(request:ProductionRequest,item?:Pick<Item,'departmentId'>):DepartmentId|null{
 // Older requests inherited the product's department. Null is explicitly unassigned.
 return request.departmentId===undefined?item?.departmentId??null:request.departmentId;
}
export function requestsForBoard<T extends ProductionRequest>(requests:T[],items:Pick<Item,'id'|'departmentId'>[],board?:BoardId):T[]{
 const catalog=new Map(items.map(item=>[item.id,item]));
 return requests.filter(request=>{
  const departmentId=requestDepartmentId(request,catalog.get(request.itemId));
  return !request.cancelledAt&&(!board||departmentId===null||DEPARTMENTS.some(department=>department.id===departmentId&&department.board===board));
 });
}
export function applyProductionRequest(state:PreviewState,recipes:DemoRecipe[],command:RequestCommand,actor:string,now:string,id:string):PreviewState{
 const requests=state.productionRequests||[];
 if(!validProductionRequests(requests))throw Error('De bestaande verzoeken moeten eerst worden gecontroleerd.');
 let next=state;
 if(command.kind==='create'){
  const departmentId=command.departmentId===undefined?command.newItem?.departmentId??null:command.departmentId;
  if(departmentId!==null&&!DEPARTMENTS.some(department=>department.id===departmentId))throw Error('Kies een geldige afdeling of nog geen afdeling.');
  if(command.newItem?.departmentId!==undefined&&!DEPARTMENTS.some(department=>department.id===command.newItem?.departmentId))throw Error('Kies een geldige afdeling of nog geen afdeling.');
  let itemId=command.itemId;
  if(command.newItem){if(command.newItem.kind==='activity')throw Error('Kies een product of halffabricaat.');state=addItem(state,{id:`item:${id}`,name:command.newItem.name,unit:command.newItem.unit,kind:command.newItem.kind,departmentId:departmentId??'dessert',departmentUnconfirmed:departmentId===null,note:'',stock:0,stockKnown:false});itemId=`item:${id}`;}
  const item=state.items.find(i=>i.id===itemId&&i.kind!=='activity');
  if(!item||item.productionBlocked)throw Error('Kies een beschikbaar product of halffabricaat.');
  const request:ProductionRequest={id,itemId:item.id,quantity:command.quantity,departmentId,note:command.note,createdBy:actor,createdAt:now,...(command.neededBy?{neededBy:command.neededBy}:{})};
  if(!validProductionRequests([...requests,request]))throw Error('Controleer de hoeveelheid, gewenste datum en opmerking.');
  return {...state,productionRequests:[...requests,request]};
 }
 const request=requests.find(r=>r.id===command.id);
 if(!request||request.cancelledAt)throw Error('Dit verzoek bestaat niet meer of is ingetrokken. Ververs de lijst.');
 if(request.plannedTaskId&&state.tasks.some(t=>t.id===request.plannedTaskId))throw Error('Dit verzoek staat al in de planning.');
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
