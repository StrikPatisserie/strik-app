"use client";
import {useEffect,useState} from 'react';
import {convertRecipeQuantity,type DemoRecipe,type Item,type PreviewState,type Task} from './planning';
import {elapsedMilliseconds,learnedWorkEstimate,timerLabel,workView,type WorkCommand} from './productionWork';
import Icon from './ProductionIcon';
import CompletedQuantityForm from './CompletedQuantityForm';
import s from './work.module.css';
const number=(value:number)=>value.toLocaleString('nl-NL',{maximumFractionDigits:1});
const stockNumber=(value:number)=>value.toLocaleString('nl-NL',{maximumFractionDigits:6});
export function WorkClock({state,taskId}:{state:PreviewState;taskId:string}){
 const [now,setNow]=useState(()=>Date.now()),timer=state.productionWork?.timers?.[taskId];
 useEffect(()=>{if(!timer?.runningSince)return;const interval=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(interval);},[timer?.runningSince]);
 return timer?<time data-layout-clock className={s.clock}><Icon name="clock" size={12}/>{timerLabel(elapsedMilliseconds(timer,now))}</time>:null;
}
export default function TaskWorkPanel({state,task,item,recipes,busy,onCommand}:{state:PreviewState;task:Task;item:Item;recipes:DemoRecipe[];busy:boolean;onCommand:(command:WorkCommand)=>Promise<string|undefined>}){
 const timer=state.productionWork?.timers?.[task.id],completion=state.productionWork?.completions?.[task.id];
 const stock=state.productionWork?.stockFulfillments?.[task.id];
 const recipe=state.productionWork?.overrides?.[task.id]||recipes.find(recipe=>recipe.id===item.recipeId);
 let baseQuantity:number|undefined;
 if(recipe&&recipe.yield>0){
  try{baseQuantity=convertRecipeQuantity(recipe.yield,recipe.unit,item.unit);}
  catch{ /* Only offer base recipes when their yield matches the task unit. */ }
 }
 const [who,setWho]=useState(timer?.who||''),[crew,setCrew]=useState(String(timer?.crewSize??1));
 const [checking,setChecking]=useState(false),[enteredMinutes,setMinutes]=useState<string|null>(null),[quantity,setQuantity]=useState(String(task.quantity)),[error,setError]=useState('');
 const [correctingQuantity,setCorrectingQuantity]=useState(false);
 const [countingStock,setCountingStock]=useState(false),[stockCount,setStockCount]=useState('');
 const [stockConfirmed,setStockConfirmed]=useState(false);
 const countedStock=Number(stockCount.replace(',','.'));
 const validStock=stockCount.trim()!==''&&Number.isFinite(countedStock)&&countedStock>=task.quantity&&countedStock<=1000000;
 const stockRemaining=Math.round((countedStock-task.quantity)*1000000)/1000000;
 const crewSize=Number(crew),validCrew=Number.isInteger(crewSize)&&crewSize>=1&&crewSize<=20;
 const history=(state.productionWork?.history||[]).filter(row=>row.taskId===task.id||row.itemId===item.id&&!row.taskId).slice(-8).reverse();
 const estimate=state.productionWork?.overrides?.[task.id]?null:learnedWorkEstimate(workView(state,recipes),item.id,task.operation,checking?Number(quantity.replace(',','.')):task.quantity,crewSize);
 const plannedMinutes=Number.isFinite(task.minutes)&&task.minutes!>0?task.minutes:undefined;
 const minutes=enteredMinutes??String(estimate?.minutes??plannedMinutes??'');
 const workedMinutes=Number(minutes.replace(',','.')),madeQuantity=Number(quantity.replace(',','.'));
 const validCompletion=who.trim().length>=2&&who.trim().length<=80&&validCrew
  &&Number.isFinite(workedMinutes)&&workedMinutes>0&&workedMinutes<=1440
  &&Number.isFinite(madeQuantity)&&madeQuantity>0&&madeQuantity<=1000000;
 const confirmedLabor=workedMinutes*crewSize;
 async function act(command:WorkCommand){
  const result=await onCommand(command);
  if(result&&command.kind==='stock'){setStockCount('');setStockConfirmed(false);}
  setError(result||'');return result;
 }
 async function finish(){
  const error=timer?.runningSince?await act({kind:'pause',taskId:task.id}):undefined;
  if(error)return;
  setMinutes(timer?String(Math.max(1,Math.round(elapsedMilliseconds(timer,Date.now())/60000))):null);
  setQuantity(String(task.quantity));setWho(timer?.who||who);setCrew(String(timer?.crewSize??crewSize));setChecking(true);
 }
 const crewField=<label className={s.crew}>Medewerkers<input type="number" min="1" max="20" step="1" required disabled={busy} value={crew} onChange={event=>setCrew(event.target.value)}/></label>;
 return <section className={s.panel} aria-label="Productietijd">
  {task.status!=='done'&&!checking&&estimate&&<p className={s.estimate}>Richttijd: ca. <strong>{number(estimate.minutes)} min met {crewSize} {crewSize===1?'persoon':'personen'}</strong> · {number(estimate.laborMinutes)} arbeidsmin · {estimate.measurements} {estimate.measurements===1?'meting':'metingen'}</p>}
  {task.status!=='done'&&!checking&&!estimate&&plannedMinutes!==undefined&&<p className={`${s.estimate} ${s.plannedEstimate}`}>Geschatte tijd <strong>{number(plannedMinutes)} min</strong><small>{task.operation} · voor {stockNumber(task.quantity)} {item.unit}</small></p>}
  {task.status==='done'?<div className={s.done}>
   <Icon name="check"/>Klaar{stock?<span> · uit voorraad · {stockNumber(stock.quantity)} {stock.unit} · {stock.who}<small>{stockNumber(stock.countedQuantity)} geteld − {stockNumber(stock.quantity)} gebruikt = {stockNumber(stock.remainingQuantity)} over</small></span>:<span> · {stockNumber(task.completedQuantity??completion?.quantity??task.quantity)} {item.unit}{completion&&<> · {number(completion.minutes)} min{completion.crewSize!==undefined&&<> × {completion.crewSize} pers. = {number(completion.laborMinutes!)} arbeidsmin</>} · {completion.who}</>}</span>}
   {!stock&&<><button disabled={busy} onClick={()=>setCorrectingQuantity(true)}>Aantal corrigeren</button><button disabled={busy} onClick={()=>void act({kind:'reopen',taskId:task.id})}>Heropen</button></>}
   {correctingQuantity&&!stock&&<CompletedQuantityForm key={task.id} task={task} item={item} recipe={recipe} busy={busy} onCommand={onCommand} onClose={()=>setCorrectingQuantity(false)}/>}
  </div>:countingStock?<form className={s.confirm} onSubmit={async event=>{
   event.preventDefault();
   if(stockConfirmed&&!await act({kind:'stock',taskId:task.id,who,countedQuantity:countedStock,confirmed:true}))setCountingStock(false);
  }}>
   <strong>Uit voorraad gebruiken</strong>
   <div className={s.numbers}><label>Totaal geteld vóór gebruik ({item.unit})<input required disabled={busy} inputMode="decimal" value={stockCount} onChange={event=>setStockCount(event.target.value)}/></label><label>Jouw naam<input required disabled={busy} minLength={2} maxLength={80} value={who} onChange={event=>setWho(event.target.value)}/></label></div>
   <p className={s.stockBalance}>{validStock?<>{stockNumber(countedStock)} geteld − <strong>{stockNumber(task.quantity)} {item.unit} nodig</strong> = {stockNumber(stockRemaining)} over</>:<>Voor deze taak is <strong>{stockNumber(task.quantity)} {item.unit}</strong> nodig.</>}</p>
   <label className={s.stockCheck}><input type="checkbox" required disabled={busy} checked={stockConfirmed} onChange={event=>setStockConfirmed(event.target.checked)}/>Ik heb de totaalvoorraad geteld en neem de benodigde hoeveelheid eruit.</label>
   <div className={s.buttons}><button type="button" disabled={busy} onClick={()=>setCountingStock(false)}>Terug</button><button className={s.primary} disabled={busy||!validStock||who.trim().length<2||!stockConfirmed} type="submit">Gebruik & klaar</button></div>
  </form>:checking?<form className={`${s.confirm} ${s.completionForm}`} aria-label="Productie afronden" onSubmit={async event=>{
   event.preventDefault();
   if(busy||!validCompletion)return;
   if(!await act({kind:'complete',taskId:task.id,who,crewSize,minutes:workedMinutes,quantity:madeQuantity,timerId:timer?.id}))setChecking(false);
  }}>
   <strong>Klopt dit?</strong>
   {!timer&&estimate&&<p className={s.estimate}>Advies ± {number(estimate.minutes)} min · {crewSize} {crewSize===1?'persoon':'personen'} · {estimate.measurements} eerdere {estimate.measurements===1?'productie':'producties'}</p>}
   <div className={s.numbers}>
    <label>Werktijd (minuten)<input required disabled={busy} inputMode="decimal" value={minutes} onChange={event=>setMinutes(event.target.value)}/></label>
    <label>Gemaakt ({item.unit})<input required disabled={busy} inputMode="decimal" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>
   </div>
   {baseQuantity!==undefined&&<div className={s.batchButtons}>
    {[baseQuantity,baseQuantity*2].map((batchQuantity,index)=><button key={index} type="button" disabled={busy} onClick={()=>setQuantity(String(batchQuantity))}>{index+1}× basisrecept · {number(batchQuantity)} {item.unit}</button>)}
   </div>}
   <div className={s.people}><label>Jouw naam<input required disabled={busy} minLength={2} maxLength={80} value={who} onChange={event=>setWho(event.target.value)}/></label>{crewField}</div>
   {validCrew&&Number.isFinite(confirmedLabor)&&confirmedLabor>0&&<p className={s.labor}>{number(Number(minutes.replace(',','.')))} min × {crewSize} {crewSize===1?'persoon':'personen'} = <strong>{number(confirmedLabor)} arbeidsminuten</strong></p>}
   <small>Gepland: {number(task.quantity)} {item.unit}{timer&&<> · gemeten <WorkClock state={state} taskId={task.id}/></>}</small>
   <div className={`${s.buttons} ${s.completionActions}`}><button className={s.adjust} type="button" disabled={busy} onClick={()=>setChecking(false)}>Nog aanpassen</button><button className={s.primary} disabled={busy||!validCompletion} type="submit"><Icon name="check" size={16}/>{busy?'Opslaan…':'Opslaan & klaar'}</button></div>
  </form>:timer?<div className={s.running}>
   <div><WorkClock state={state} taskId={task.id}/><small>{timer.who}{timer.crewSize!==undefined&&<> · {timer.crewSize} {timer.crewSize===1?'persoon':'personen'}</>}{!timer.runningSince?' · gepauzeerd':''}</small></div>
   <div className={s.buttons}>
    <button disabled={busy} onClick={()=>void act(timer.runningSince?{kind:'pause',taskId:task.id}:{kind:'start',taskId:task.id,who:timer.who,crewSize:timer.crewSize})}>{timer.runningSince?'Pauze':'Hervat'}</button>
    <button className={s.primary} disabled={busy} onClick={()=>void finish()}>Klaar</button>
   </div>
  </div>:<div className={s.start}>
   <label>Jouw naam<input value={who} disabled={busy} minLength={2} maxLength={80} placeholder="Naam bakker" onChange={event=>setWho(event.target.value)}/></label>{crewField}
   <button className={s.primary} disabled={busy||who.trim().length<2||!validCrew} onClick={()=>void act({kind:'start',taskId:task.id,who,crewSize})}><Icon name="play" size={16}/>Start</button>
   <button disabled={busy} onClick={()=>void finish()}>Al klaar</button>
   {task.status==='planned'&&task.recordsOutput&&item.kind!=='activity'&&<button disabled={busy} onClick={()=>{setError('');setStockCount('');setStockConfirmed(false);setCountingStock(true);}}>Uit voorraad gebruiken</button>}
  </div>}
  {error&&<p role="alert" className={s.error}>{error}</p>}
  {!!history.length&&<details><summary>Wijzigingen</summary>{history.map(row=><p key={row.id}><strong>{row.who}</strong> · {new Date(row.at).toLocaleString('nl-NL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Amsterdam'})} · {row.summary}</p>)}</details>}
 </section>;
}
export function RecipeWorkHistory({state,recipes,itemId,quantity,unit}:{state:PreviewState;recipes:DemoRecipe[];itemId:string;quantity:number;unit:string}){
 const view=workView(state,recipes),operations=[...new Set(view.work.filter(row=>row.itemId===itemId).map(row=>row.operation))];
 const estimates=operations.map(operation=>({operation,estimate:learnedWorkEstimate(view,itemId,operation,quantity)})).filter(row=>row.estimate);
 if(!estimates.length)return null;
 return <details className={s.estimates}><summary>Opgeslagen werktijden</summary><small>Richttijden voor {number(quantity)} {unit}, op basis van bevestigde producties.</small>{estimates.map(({operation,estimate})=><p key={operation}><strong>{operation}</strong> · ca. {number(estimate!.laborMinutes)} arbeidsmin · {estimate!.measurements} {estimate!.measurements===1?'meting':'metingen'}</p>)}</details>;
}
export function PreparationControl({recipeId,state,busy,onCommand}:{recipeId:string;state:PreviewState;busy:boolean;onCommand:(command:WorkCommand)=>Promise<string|undefined>}){
 const [editing,setEditing]=useState(false),[error,setError]=useState('');
 return <details className={s.preparation} open={editing} onToggle={event=>setEditing(event.currentTarget.open)}><summary>Voorbereiding · {state.productionWork?.preparation?.[recipeId]??1} dagen vooraf</summary><form onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);const error=await onCommand({kind:'preparation',recipeId,days:Number(data.get('days')),who:String(data.get('who'))});setError(error||'');if(!error)setEditing(false);}}><label>Dagen vóór gebruik<input name="days" type="number" min="0" max="30" required defaultValue={state.productionWork?.preparation?.[recipeId]??1}/></label><label>Jouw naam<input name="who" minLength={2} maxLength={80} required/></label><small>Voor nieuwe producties. Bestaande taken behouden hun datum.</small><button disabled={busy}>Bewaren</button>{error&&<p role="alert" className={s.error}>{error}</p>}</form></details>;
}
