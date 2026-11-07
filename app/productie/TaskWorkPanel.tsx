"use client";
import {useEffect,useState} from 'react';
import type {DemoRecipe,Item,PreviewState,Task} from './planning';
import {elapsedMilliseconds,learnedWorkEstimate,timerLabel,workView,type WorkCommand} from './productionWork';
import Icon from './ProductionIcon';
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
 const [who,setWho]=useState(timer?.who||''),[crew,setCrew]=useState(String(timer?.crewSize??1));
 const [checking,setChecking]=useState(false),[minutes,setMinutes]=useState(''),[quantity,setQuantity]=useState(String(task.quantity)),[error,setError]=useState('');
 const [countingStock,setCountingStock]=useState(false),[stockCount,setStockCount]=useState('');
 const [stockConfirmed,setStockConfirmed]=useState(false);
 const countedStock=Number(stockCount.replace(',','.'));
 const validStock=stockCount.trim()!==''&&Number.isFinite(countedStock)&&countedStock>=task.quantity&&countedStock<=1000000;
 const stockRemaining=Math.round((countedStock-task.quantity)*1000000)/1000000;
 const crewSize=Number(crew),validCrew=Number.isInteger(crewSize)&&crewSize>=1&&crewSize<=20;
 const history=(state.productionWork?.history||[]).filter(row=>row.taskId===task.id||row.itemId===item.id&&!row.taskId).slice(-8).reverse();
 const estimate=state.productionWork?.overrides?.[task.id]?null:learnedWorkEstimate(workView(state,recipes),item.id,task.operation,task.quantity,crewSize);
 const plannedMinutes=Number.isFinite(task.minutes)&&task.minutes!>0?task.minutes:undefined;
 const confirmedLabor=Number(minutes.replace(',','.'))*crewSize;
 async function act(command:WorkCommand){
  const result=await onCommand(command);
  if(result&&command.kind==='stock'){setStockCount('');setStockConfirmed(false);}
  setError(result||'');return result;
 }
 async function finish(){
  const error=timer?.runningSince?await act({kind:'pause',taskId:task.id}):undefined;
  if(error)return;
  setMinutes(String(Math.max(1,Math.round(elapsedMilliseconds(timer,Date.now())/60000))));
  setQuantity(String(task.quantity));setWho(timer?.who||who);setCrew(String(timer?.crewSize??crewSize));setChecking(true);
 }
 const crewField=<label className={s.crew}>Medewerkers<input type="number" min="1" max="20" step="1" required disabled={busy} value={crew} onChange={event=>setCrew(event.target.value)}/></label>;
 return <section className={s.panel} aria-label="Productietijd">
  {task.status!=='done'&&!checking&&estimate&&<p className={s.estimate}>Richttijd: ca. <strong>{number(estimate.minutes)} min met {crewSize} {crewSize===1?'persoon':'personen'}</strong> · {number(estimate.laborMinutes)} arbeidsmin · {estimate.measurements} {estimate.measurements===1?'meting':'metingen'}</p>}
  {task.status!=='done'&&!checking&&!estimate&&plannedMinutes!==undefined&&<p className={`${s.estimate} ${s.plannedEstimate}`}>Geschatte tijd <strong>{number(plannedMinutes)} min</strong><small>{task.operation} · voor {stockNumber(task.quantity)} {item.unit}</small></p>}
  {task.status==='done'?<div className={s.done}>
   <Icon name="check"/>Klaar{stock?<span> · uit voorraad · {stockNumber(stock.quantity)} {stock.unit} · {stock.who}<small>{stockNumber(stock.countedQuantity)} geteld − {stockNumber(stock.quantity)} gebruikt = {stockNumber(stock.remainingQuantity)} over</small></span>:completion&&<span> · {number(completion.quantity)} {item.unit} · {number(completion.minutes)} min{completion.crewSize!==undefined&&<> × {completion.crewSize} pers. = {number(completion.laborMinutes!)} arbeidsmin</>} · {completion.who}</span>}
   {!stock&&<button disabled={busy} onClick={()=>void act({kind:'reopen',taskId:task.id})}>Heropen</button>}
  </div>:countingStock?<form className={s.confirm} onSubmit={async event=>{
   event.preventDefault();
   if(stockConfirmed&&!await act({kind:'stock',taskId:task.id,who,countedQuantity:countedStock,confirmed:true}))setCountingStock(false);
  }}>
   <strong>Uit voorraad gebruiken</strong>
   <div className={s.numbers}><label>Totaal geteld vóór gebruik ({item.unit})<input required disabled={busy} inputMode="decimal" value={stockCount} onChange={event=>setStockCount(event.target.value)}/></label><label>Jouw naam<input required disabled={busy} minLength={2} maxLength={80} value={who} onChange={event=>setWho(event.target.value)}/></label></div>
   <p className={s.stockBalance}>{validStock?<>{stockNumber(countedStock)} geteld − <strong>{stockNumber(task.quantity)} {item.unit} nodig</strong> = {stockNumber(stockRemaining)} over</>:<>Voor deze taak is <strong>{stockNumber(task.quantity)} {item.unit}</strong> nodig.</>}</p>
   <label className={s.stockCheck}><input type="checkbox" required disabled={busy} checked={stockConfirmed} onChange={event=>setStockConfirmed(event.target.checked)}/>Ik heb de totaalvoorraad geteld en neem de benodigde hoeveelheid eruit.</label>
   <div className={s.buttons}><button type="button" disabled={busy} onClick={()=>setCountingStock(false)}>Terug</button><button className={s.primary} disabled={busy||!validStock||who.trim().length<2||!stockConfirmed} type="submit">Gebruik & klaar</button></div>
  </form>:checking?<form className={s.confirm} onSubmit={async event=>{
   event.preventDefault();
   if(!await act({kind:'complete',taskId:task.id,who,crewSize,minutes:Number(minutes.replace(',','.')),quantity:Number(quantity.replace(',','.')),timerId:timer?.id}))setChecking(false);
  }}>
   <strong>Klopt dit?</strong>
   <div className={s.numbers}>
    <label>Werktijd (minuten)<input required disabled={busy} inputMode="decimal" value={minutes} onChange={event=>setMinutes(event.target.value)}/></label>
    <label>Gemaakt ({item.unit})<input required disabled={busy} inputMode="decimal" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>
   </div>
   <div className={s.people}><label>Jouw naam<input required disabled={busy} minLength={2} maxLength={80} value={who} onChange={event=>setWho(event.target.value)}/></label>{crewField}</div>
   {validCrew&&Number.isFinite(confirmedLabor)&&confirmedLabor>0&&<p className={s.labor}>{number(Number(minutes.replace(',','.')))} min × {crewSize} {crewSize===1?'persoon':'personen'} = <strong>{number(confirmedLabor)} arbeidsminuten</strong></p>}
   <small>Gepland: {number(task.quantity)} {item.unit}{timer&&<> · gemeten <WorkClock state={state} taskId={task.id}/></>}</small>
   <div className={s.buttons}><button type="button" disabled={busy} onClick={()=>setChecking(false)}>Terug</button><button className={s.primary} disabled={busy||!validCrew} type="submit">Bevestig & klaar</button></div>
  </form>:timer?<div className={s.running}>
   <div><WorkClock state={state} taskId={task.id}/><small>{timer.who}{timer.crewSize!==undefined&&<> · {timer.crewSize} {timer.crewSize===1?'persoon':'personen'}</>}{!timer.runningSince?' · gepauzeerd':''}</small></div>
   <div className={s.buttons}>
    <button disabled={busy} onClick={()=>void act(timer.runningSince?{kind:'pause',taskId:task.id}:{kind:'start',taskId:task.id,who:timer.who,crewSize:timer.crewSize})}>{timer.runningSince?'Pauze':'Hervat'}</button>
    <button className={s.primary} disabled={busy} onClick={()=>void finish()}>Af</button>
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
