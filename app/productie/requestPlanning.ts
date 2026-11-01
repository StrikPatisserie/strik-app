import {validProductionRequests,addItem,addDays,DEPARTMENTS,type PreviewState,type DepartmentId,type DemoRecipe,type ItemUnit,type ItemKind} from './planning';
import {buildRecipePlan} from './recipePlanning';
export type ProductionRequest={id:string;itemId:string;quantity:number;neededBy?:string;note:string;createdBy:string;createdAt:string;cancelledAt?:string;plannedTaskId?:string};
export type RequestCommand={kind:'create';itemId:string;quantity:number;neededBy?:string;note:string;newItem?:{name:string;unit:ItemUnit;kind:ItemKind;departmentId:DepartmentId}}|{kind:'cancel';id:string}|{kind:'plan';id:string;date:string;departmentId:DepartmentId};
export function applyProductionRequest(state:PreviewState,recipes:DemoRecipe[],command:RequestCommand,actor:string,now:string,id:string):PreviewState{
 const requests=state.productionRequests||[];
 if(!validProductionRequests(requests))throw Error('De bestaande verzoeken moeten eerst worden gecontroleerd.');
 let next=state;
 if(command.kind==='create'){
  let itemId=command.itemId;
  if(command.newItem){if(command.newItem.kind==='activity')throw Error('Kies een product of halffabricaat.');state=addItem(state,{id:`item:${id}`,name:command.newItem.name,unit:command.newItem.unit,kind:command.newItem.kind,departmentId:command.newItem.departmentId,note:'',stock:0,stockKnown:false});itemId=`item:${id}`;}
  const item=state.items.find(i=>i.id===itemId&&i.kind!=='activity');
  if(!item||item.productionBlocked)throw Error('Kies een beschikbaar product of halffabricaat.');
  const request:ProductionRequest={id,itemId:item.id,quantity:command.quantity,note:command.note,createdBy:actor,createdAt:now,...(command.neededBy?{neededBy:command.neededBy}:{})};
  if(!validProductionRequests([...requests,request]))throw Error('Controleer de hoeveelheid, gewenste datum en opmerking.');
  return {...state,productionRequests:[...requests,request]};
 }
 const request=requests.find(r=>r.id===command.id);
 if(!request||request.cancelledAt)throw Error('Dit verzoek bestaat niet meer of is ingetrokken. Ververs de lijst.');
 if(request.plannedTaskId&&state.tasks.some(t=>t.id===request.plannedTaskId))throw Error('Dit verzoek staat al in de planning.');
 if(command.kind==='cancel')return {...state,productionRequests:requests.map(r=>r.id===request.id?{...r,cancelledAt:now}:r)};
 if(command.kind!=='plan'||!DEPARTMENTS.some(d=>d.id===command.departmentId))throw Error('Kies een geldige productiedag en afdeling.');
 addDays(command.date,0);
 if(request.neededBy&&command.date>request.neededBy)throw Error('Plan uiterlijk op de gewenste datum, of laat logistiek het verzoek aanpassen.');
 next=buildRecipePlan(state,recipes,{task:{id,itemId:request.itemId,departmentId:command.departmentId,date:command.date,operation:'Produceren',status:'planned',note:`Productieverzoek logistiek${request.note?`: ${request.note}`:''}`,source:'order',batchId:`batch:${id}`,recordsOutput:true,...(request.neededBy?{dueDate:request.neededBy}:{})},amount:request.quantity,amountMode:'quantity'});
 return {...next,productionRequests:requests.map(r=>r.id===request.id?{...r,plannedTaskId:id}:r)};
}
