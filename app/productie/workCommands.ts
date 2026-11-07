import type {DemoRecipe,DepartmentId,PreviewState} from './planning';
import {confirmTaskCompletion,fulfillTaskFromStock,pauseWorkTimer,reopenTimedTask,setPreparation,startWorkTimer,storeWork,workView,type WorkCommand} from './productionWork';

/** Only called with server time/identity. Browser snapshots never own work logs. */
export function applyWorkCommand(state:PreviewState,recipes:DemoRecipe[],command:WorkCommand,allowed:DepartmentId[],actorId:string,id:string,at:string):PreviewState{
 if(!command||!['start','pause','complete','reopen','preparation','stock'].includes(command.kind))throw Error('Onbekende productieactie.');
 const item=command.kind==='preparation'?state.items.find(i=>i.recipeId===command.recipeId):state.items.find(i=>i.id===state.tasks.find(t=>t.id===command.taskId)?.itemId);
 const task=command.kind==='preparation'?undefined:state.tasks.find(t=>t.id===command.taskId);
 if(!item||!allowed.includes(task?.departmentId||item.departmentId))throw Error('Geen toegang tot deze productie.');
 if(task?.weddingCode)throw Error('Pas deze bruidstaart via de bruidstaartplanning aan.');
 if(command.kind==='stock'){
  const receipt=state.productionWork?.receipts?.find(row=>row.id===id);
  if(receipt){
   if(receipt.actorId===actorId)return state;
   throw Error('Deze voorraadactie is al gebruikt. Ververs de planning.');
  }
  const existing=Object.values(state.productionWork?.stockFulfillments||{}).find(row=>row.id===id);
  if(existing){
   if(existing.actorId===actorId&&existing.taskId===command.taskId)return state;
   throw Error('Deze voorraadactie is al gebruikt. Ververs de planning.');
  }
 }
 let view=workView(state,recipes);
 switch(command.kind){
  case 'start':view=startWorkTimer(view,command.taskId,command.who,id,at,command.crewSize);break;
  case 'pause':view=pauseWorkTimer(view,command.taskId,at);break;
  case 'complete':view=confirmTaskCompletion(view,command,id,at);break;
  case 'preparation':view=setPreparation(view,command.recipeId,command.days,command.who,id,at);break;
  case 'reopen':view=reopenTimedTask(view,command.taskId);break;
  case 'stock':view=fulfillTaskFromStock(view,command,id,at);break;
 }
 view.history=view.history.map(row=>row.id===id?{...row,actorId}:row);
 view.work=view.work.map(row=>row.id===id?{...row,actorId}:row);
 if(task&&view.timers?.[task.id]?.id===id)view.timers[task.id].actorId=actorId;
 if(task&&view.completions?.[task.id]?.id===id)view.completions[task.id].actorId=actorId;
 if(task&&view.stockFulfillments?.[task.id]?.id===id)view.stockFulfillments[task.id]={...view.stockFulfillments[task.id],actorId};
 const next=storeWork(view,state.productionWork);
 return {...next,productionWork:{...next.productionWork!,receipts:[...(state.productionWork?.receipts||[]).slice(-199),{id,actorId,at}]}};
}

export function assertWorkUnchanged(current:PreviewState,next:PreviewState){
 if(JSON.stringify(current.productionWork)!==JSON.stringify(next.productionWork))throw Error('Productietijden en recepthistorie worden apart opgeslagen. Ververs de planning.');
 if(current.tasks.some(task=>task.stockFulfillmentId&&!next.tasks.some(row=>row.id===task.id)))throw Error('Een uit voorraad afgehandelde taak blijft in de registratie bewaard.');
 for(const task of next.tasks){const before=current.tasks.find(t=>t.id===task.id);
  if(task.completedQuantity!==before?.completedQuantity)throw Error('Bevestig de gemaakte hoeveelheid via de productiecontrole.');
  if(task.stockFulfillmentId!==before?.stockFulfillmentId)throw Error('Registreer voorraadgebruik via de voorraadcontrole.');
  if(before?.stockFulfillmentId&&JSON.stringify(task)!==JSON.stringify(before))throw Error('Een uit voorraad afgehandelde taak blijft bewaard. Corrigeer de voorraad via Voorraadbeheer.');
  if(before&&(current.productionWork?.timers?.[task.id]||current.productionWork?.completions?.[task.id])&&task.status!==before.status)throw Error('Gebruik de productietimer om deze taak af te ronden of te heropenen.');
 }
}
