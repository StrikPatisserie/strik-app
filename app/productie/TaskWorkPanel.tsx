"use client";
import {useEffect,useState} from 'react';
import type {Item,PreviewState,Task} from './planning';
import {elapsedMilliseconds,timerLabel,type WorkCommand} from './productionWork';
import Icon from './ProductionIcon';
import s from './work.module.css';
export function WorkClock({state,taskId}:{state:PreviewState;taskId:string}){
 const [now,setNow]=useState(()=>Date.now()),timer=state.productionWork?.timers?.[taskId];
 useEffect(()=>{if(!timer?.runningSince)return;const interval=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(interval);},[timer?.runningSince]);
 return timer?<time data-layout-clock className={s.clock}><Icon name="clock" size={12}/>{timerLabel(elapsedMilliseconds(timer,now))}</time>:null;
}
export default function TaskWorkPanel({state,task,item,busy,onCommand}:{state:PreviewState;task:Task;item:Item;busy:boolean;onCommand:(command:WorkCommand)=>Promise<string|undefined>}){
 const timer=state.productionWork?.timers?.[task.id],completion=state.productionWork?.completions?.[task.id];
 const [who,setWho]=useState(timer?.who||''),[checking,setChecking]=useState(false),[minutes,setMinutes]=useState(''),[quantity,setQuantity]=useState(String(task.quantity)),[error,setError]=useState('');
 const history=(state.productionWork?.history||[]).filter(row=>row.taskId===task.id||row.itemId===item.id&&!row.taskId).slice(-8).reverse();
 async function act(command:WorkCommand){const result=await onCommand(command);setError(result||'');return result;}
 async function finish(){const error=timer?.runningSince?await act({kind:'pause',taskId:task.id}):undefined;if(error)return;setMinutes(String(Math.max(1,Math.round(elapsedMilliseconds(timer,Date.now())/60000))));setQuantity(String(task.quantity));setWho(timer?.who||who);setChecking(true);}
 return <section className={s.panel} aria-label="Productietijd">
  {task.status==='done'?<div className={s.done}><Icon name="check"/>Klaar{completion&&<span> · {completion.quantity.toLocaleString('nl-NL')} {item.unit} · {completion.minutes.toLocaleString('nl-NL')} min · {completion.who}</span>}<button disabled={busy} onClick={()=>void act({kind:'reopen',taskId:task.id})}>Heropen</button></div>:checking?<form className={s.confirm} onSubmit={async event=>{event.preventDefault();if(!await act({kind:'complete',taskId:task.id,who,minutes:Number(minutes.replace(',','.')),quantity:Number(quantity.replace(',','.')),timerId:timer?.id}))setChecking(false);}}>
   <strong>Klopt dit?</strong><div className={s.numbers}><label>Werktijd (minuten)<input required inputMode="decimal" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label><label>Gemaakt ({item.unit})<input required inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label></div>
   <label>Jouw naam<input required minLength={2} maxLength={80} value={who} onChange={e=>setWho(e.target.value)}/></label><small>Gepland: {task.quantity.toLocaleString('nl-NL')} {item.unit}{timer&&<> · gemeten <WorkClock state={state} taskId={task.id}/></>}</small><div className={s.buttons}><button type="button" disabled={busy} onClick={()=>setChecking(false)}>Terug</button><button className={s.primary} disabled={busy} type="submit">Bevestig & klaar</button></div>
  </form>:timer?<div className={s.running}><div><WorkClock state={state} taskId={task.id}/><small>{timer.who}{!timer.runningSince?' · gepauzeerd':''}</small></div><div className={s.buttons}><button disabled={busy} onClick={()=>void act(timer.runningSince?{kind:'pause',taskId:task.id}:{kind:'start',taskId:task.id,who:timer.who})}>{timer.runningSince?'Pauze':'Hervat'}</button><button className={s.primary} disabled={busy} onClick={()=>void finish()}>Af</button></div></div>:<div className={s.start}><label>Jouw naam<input value={who} minLength={2} maxLength={80} placeholder="Naam bakker" onChange={e=>setWho(e.target.value)}/></label><button className={s.primary} disabled={busy||who.trim().length<2} onClick={()=>void act({kind:'start',taskId:task.id,who})}><Icon name="play" size={16}/>Start</button><button disabled={busy} onClick={()=>void finish()}>Al klaar</button></div>}
  {error&&<p role="alert" className={s.error}>{error}</p>}
  {!!history.length&&<details><summary>Wijzigingen</summary>{history.map(row=><p key={row.id}><strong>{row.who}</strong> · {new Date(row.at).toLocaleString('nl-NL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Amsterdam'})} · {row.summary}</p>)}</details>}
 </section>;
}
export function PreparationControl({recipeId,state,busy,onCommand}:{recipeId:string;state:PreviewState;busy:boolean;onCommand:(command:WorkCommand)=>Promise<string|undefined>}){
 const [editing,setEditing]=useState(false),[error,setError]=useState('');
 return <details className={s.preparation} open={editing} onToggle={event=>setEditing(event.currentTarget.open)}><summary>Voorbereiding · {state.productionWork?.preparation?.[recipeId]??1} dagen vooraf</summary><form onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);const error=await onCommand({kind:'preparation',recipeId,days:Number(data.get('days')),who:String(data.get('who'))});setError(error||'');if(!error)setEditing(false);}}><label>Dagen vóór gebruik<input name="days" type="number" min="0" max="30" required defaultValue={state.productionWork?.preparation?.[recipeId]??1}/></label><label>Jouw naam<input name="who" minLength={2} maxLength={80} required/></label><small>Voor nieuwe producties. Bestaande taken behouden hun datum.</small><button disabled={busy}>Bewaren</button>{error&&<p role="alert" className={s.error}>{error}</p>}</form></details>;
}
