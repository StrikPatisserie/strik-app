"use client";
/* eslint-disable @next/next/no-img-element -- local vector brand artwork. */
import {Fragment,useEffect,useRef,useState,type FormEvent,type ReactNode,type CSSProperties} from "react";
import {useRouter} from "next/navigation";
import Icon from "../../../productie/ProductionIcon";
import ProductionNavigation,{ProductionMobileNavigation} from "../../../productie/ProductionNavigation";
import type {ProductionView} from "../../../productie/navigation";
import useScreenLayout from "./useScreenLayout";
import {addDays,BOARDS,dateLabel,DEPARTMENTS,removePlannedTask,STATUS_LABELS,transitionTask,weekLabel,weekNumber,type DemoRecipe,type DepartmentId,type Item,type Task,type TaskStatus} from "../../../productie/planning";
import {productionDayRhythm} from "../../../productie/dayRhythm";
import {applyProductionRequest} from "../../../productie/requestPlanning";
import {SCREEN_STORAGE_KEY,SCREEN_WEEK,initialScreenState,planScreenTask,saveRecipeChange,setPreparation,taskRecipe,workEstimate,startWorkTimer,pauseWorkTimer,confirmTaskCompletion,reopenTimedTask,elapsedMilliseconds,timerLabel,type ScreenState,type WorkTimer} from "./model";
import s from "./screen.module.css";

const number=(n:number)=>n.toLocaleString("nl-NL",{maximumFractionDigits:2});
const stamp=(at:string)=>new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(at));
const uid=()=>crypto.randomUUID();
type Modal={type:"task";id:string}|{type:"complete";id:string}|{type:"plan";date:string;department:DepartmentId;requestId?:string}|{type:"request"}|{type:"recipe";itemId:string;taskId?:string}|{type:"agreements"}|{type:"offer"}|{type:"reset"}|null;

export default function ScreenPreview({offers={}}:{offers?:Record<string,string>}){
  const router=useRouter();
  const [state,setState]=useState<ScreenState>(initialScreenState),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false);
  const [week,setWeek]=useState(SCREEN_WEEK),[xl,setXl]=useState(false),[modal,setModal]=useState<Modal>(null),[message,setMessage]=useState("");
  const [status,setStatus]=useState("all"),[mobileDay,setMobileDay]=useState("2026-11-06");
  const {frameRef,workspaceRef}=useScreenLayout(xl);
  useEffect(()=>{try{const raw=localStorage.getItem(SCREEN_STORAGE_KEY);if(raw){const saved=JSON.parse(raw) as ScreenState;if(saved.version===1&&Array.isArray(saved.planner?.tasks)&&Array.isArray(saved.planner?.items)&&Array.isArray(saved.recipes)&&Array.isArray(saved.history)&&Array.isArray(saved.work)&&saved.overrides&&saved.preparation)setState(saved);}}catch{setStorageError(true);}setReady(true);},[]);
  useEffect(()=>{if(!ready)return;try{localStorage.setItem(SCREEN_STORAGE_KEY,JSON.stringify(state));setStorageError(false);}catch{setStorageError(true);}},[state,ready]);
  function update(next:ScreenState,notice="Lokaal opgeslagen."){setState(next);setMessage(notice);}
  function statusChange(task:Task,next:TaskStatus){try{
    if(next==="done"){update(pauseWorkTimer(state,task.id,new Date().toISOString()),"Controleer tijd en hoeveelheid.");setModal({type:"complete",id:task.id});return;}
    if(task.status==="done"&&next==="planned"){update(reopenTimedTask(state,task.id),"Taak heropend; eerdere registratie blijft in de historie.");return;}
    const paused=pauseWorkTimer(state,task.id,new Date().toISOString());update({...paused,planner:{...paused.planner,tasks:transitionTask(paused.planner.tasks,task.id,next,paused.planner.items)}});
  }catch(e){setMessage((e as Error).message);}}
  function removeTask(task:Task){try{update({...state,planner:{...state.planner,tasks:removePlannedTask(state.planner.tasks,task.id)}},"Taak lokaal verwijderd.");setModal(null);}catch(e){setMessage((e as Error).message);}}
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{setMessage("Deze browser laat volledig scherm niet toe. Open het Chrome-menu en kies Volledig scherm.");}}
  const days=Array.from({length:6},(_,i)=>addDays(week,i)),departments=DEPARTMENTS.filter(d=>d.board==="patisserie");
  const weekTasks=state.planner.tasks.filter(t=>t.date>=week&&t.date<=addDays(week,5)&&departments.some(d=>d.id===t.departmentId));
  const selected=modal?.type==="task"?state.planner.tasks.find(t=>t.id===modal.id):undefined;
  const completing=modal?.type==="complete"?state.planner.tasks.find(t=>t.id===modal.id):undefined;
  const recipeItem=modal?.type==="recipe"?state.planner.items.find(i=>i.id===modal.itemId):undefined;
  const requests=(state.planner.productionRequests||[]).filter(r=>!r.cancelledAt&&!state.planner.tasks.some(t=>t.id===r.plannedTaskId));
  const offerImage=offers[week];
  function navigate(view:ProductionView){if(view!=="planning")router.push(`/preview/productie?view=${view}`);}
  return <div ref={frameRef} className={s.screenFrame}><div ref={workspaceRef} className={`${s.workspace} ${xl?s.expanded:""}`}>
    {!xl&&<div className={s.navigation}><ProductionNavigation active="planning" canManage demo boards={BOARDS} activeBoard="patisserie" onNavigate={navigate} onBoard={board=>{if(board!=="patisserie")router.push(`/preview/productie?board=${board}`);}}/></div>}
    <div className={`${s.root} ${xl?s.xl:""}`}>
    {!xl&&<div className={s.mobileNavigation}><ProductionMobileNavigation active="planning" canManage demo onNavigate={navigate}/></div>}
    <header className={s.topbar}>
      <img src="/strak-gepland/wordmark.svg" alt="STRAK gepland" width="149" height="58"/>
      <span className={s.demo}>Preview</span>
      <button className={s.quiet} onClick={()=>setModal({type:"agreements"})}><Icon name="settings" size={17}/>Werkafspraken</button>
      <button className={s.quiet} aria-pressed={xl} onClick={()=>setXl(!xl)}><Icon name="screen" size={18}/>XL weergave</button>
      <button className={s.fullscreen} onClick={()=>void fullscreen()} title="Verberg de Chrome-balk met volledig scherm" aria-label="Volledig scherm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg></button>
    </header>
    <section className={s.toolbar} aria-label="Week en filters">
      <div className={s.week}><button aria-label="Vorige week" onClick={()=>setWeek(addDays(week,-7))}><Icon name="back" size={18}/></button><div><strong>Week {weekNumber(week)}</strong><span>{weekLabel(week)}</span></div><button aria-label="Volgende week" onClick={()=>setWeek(addDays(week,7))}><Icon name="arrow" size={18}/></button></div>
      <button className={s.todayButton} onClick={()=>setWeek(SCREEN_WEEK)}>Deze week</button>
      <div className={s.legend}><span><i/>Te maken</span><span><i/>Bezig</span><span><i/>Klaar</span></div>
      <label className={s.filter}><span className={s.sr}>Taakstatus</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Alle taken</option><option value="open">Nog te doen</option><option value="done">Klaar</option></select></label>
      <button className={s.primary} onClick={()=>setModal({type:"plan",date:week,department:"dessert"})}><Icon name="plus" size={18}/>Inplannen</button>
    </section>
    <div className={s.mobileDays}>{days.map(d=><button key={d} aria-pressed={mobileDay===d} onClick={()=>setMobileDay(d)}>{dateLabel(d)}</button>)}</div>
    <main className={s.viewport}><div className={s.canvas}>
      <div className={s.planningLayout}><section className={s.board} aria-label="Weekplanning" style={{"--days":days.length} as CSSProperties}>
        <div className={s.dayHeaders}><div aria-hidden="true"/>{days.map(date=><div className={`${s.dayHeading} ${date==="2026-11-06"?s.currentDay:""}`} key={date}><div><strong>{dateLabel(date)}</strong>{date==="2026-11-06"&&<span>Vandaag</span>}</div><div className={s.rhythm}>{productionDayRhythm("patisserie",date).map(b=><span key={b.id}><b>{b.label}</b>{b.start}–{b.end}</span>)}</div></div>)}</div>
        {departments.map(dep=><div className={s.lane} key={dep.id} data-department={dep.id}>
          <div className={s.laneLabel}><h2>{dep.name}</h2></div>
          {days.map(date=><div key={date} className={`${s.cell} ${date===mobileDay?s.selectedDay:""} ${date==="2026-11-06"?s.todayCell:""}`} aria-label={`${dep.name} · ${dateLabel(date,true)}`}>
            {weekTasks.filter(t=>t.departmentId===dep.id&&t.date===date&&(status==="all"||status==="done"&&t.status==="done"||status==="open"&&t.status!=="done")).map(task=>{
              const item=state.planner.items.find(i=>i.id===task.itemId)!,recipe=taskRecipe(state,task);
              return <article className={`${s.card} ${s[task.status]}`} key={task.id}>
                <button className={s.check} aria-label={`${task.status==="done"?"Heropen":state.timers?.[task.id]?"Afronden":"Timer starten"}: ${item.name}`} onClick={()=>task.status==="done"?statusChange(task,"planned"):state.timers?.[task.id]?statusChange(task,"done"):setModal({type:"task",id:task.id})}>{task.status==="done"?<Icon name="check" size={15}/>:task.status==="active"?<Icon name="play" size={13}/>:null}</button>
                <button className={s.cardOpen} aria-label={`${number(state.completions?.[task.id]?.quantity??task.quantity)} ${item.unit} ${item.name} · ${task.operation} · ${STATUS_LABELS[task.status]}`} onClick={()=>setModal({type:"task",id:task.id})}><strong data-fit-text><b data-fit-word>{number(state.completions?.[task.id]?.quantity??task.quantity)}{item.unit==="stuks"?"×":` ${item.unit}`}</b> <Words text={item.name}/></strong><span>{task.operation}{state.timers?.[task.id]&&task.status!=="done"?<CardClock timer={state.timers[task.id]}/>:task.status==="active"&&<em className={s.stateChip}>Bezig</em>}{task.status==="blocked"&&<em className={s.stateChip}>Controleren</em>}</span>{state.overrides[task.id]&&<small>Eenmalig aangepast</small>}</button>
                {item.kind!=="activity"&&!recipe&&<button className={s.nudge} aria-label={`Recept aanvullen: ${item.name}`} title="Recept ontbreekt · aanvullen" onClick={()=>setModal({type:"recipe",itemId:item.id,taskId:task.id})}><Icon name="warning" size={15}/></button>}
              </article>;
            })}
            <button className={s.cellAdd} aria-label={`Toevoegen · ${dep.name} · ${dateLabel(date,true)}`} onClick={()=>setModal({type:"plan",date,department:dep.id})}><Icon name="plus" size={15}/><span>Inplannen</span></button>
          </div>)}
        </div>)}
        <div className={`${s.lane} ${s.cleaning}`}><div className={s.laneLabel}><h2>Schoonmaak</h2><Icon name="cleaning" size={17}/></div>{days.map((d,i)=><div key={d} className={`${s.cell} ${d===mobileDay?s.selectedDay:""}`}><span className={s.cleaningLabel}>{i===4?"Werkbanken & koelingen":"Dagelijkse ronde"}</span><label><input type="checkbox"/>Werkplek schoon</label></div>)}</div>
      </section><aside className={s.rail}>
        <section className={s.requestPanel} aria-label="Productieverzoeken"><header><h2>Productieverzoeken</h2><button aria-label="Productieverzoek toevoegen" onClick={()=>setModal({type:"request"})}><Icon name="plus" size={19}/></button></header>{requests.map(r=>{const item=state.planner.items.find(i=>i.id===r.itemId);return <div key={r.id} className={s.requestRow}><div><strong data-fit-text><b data-fit-word>{number(r.quantity)}{item?.unit==="stuks"?"×":` ${item?.unit}`}</b> <Words text={item?.name||""}/></strong>{r.neededBy&&<small>{dateLabel(r.neededBy,true)}</small>}</div><button aria-label={`Verzoek inplannen: ${item?.name}`} onClick={()=>setModal({type:"plan",date:r.neededBy||week,department:item?.departmentId||"dessert",requestId:r.id})}><Icon name="plus" size={17}/></button></div>;})}</section>
        <OfferTile key={`${week}:${offerImage||""}`} image={offerImage} week={week} open={()=>setModal({type:"offer"})}/>
      </aside></div>
      <footer className={s.footer}><span>{storageError?"Lokaal bewaren mislukt.":"Preview · lokaal opgeslagen"}</span><button onClick={()=>setModal({type:"reset"})}>Herstel</button></footer>
    </div></main>
    {message&&<div className={s.toast} role="status"><span>{message}</span><button aria-label="Melding sluiten" onClick={()=>setMessage("")}><Icon name="close" size={16}/></button></div>}
    {modal?.type==="plan"&&<Dialog title="Inplannen" close={()=>setModal(null)}><PlanForm state={state} date={modal.date} department={modal.department} requestId={modal.requestId} save={next=>{update(next,"Ingepland.");setModal(null);}}/></Dialog>}
    {modal?.type==="request"&&<Dialog title="Productieverzoek" close={()=>setModal(null)}><RequestForm state={state} save={next=>{update(next,"Verzoek toegevoegd.");setModal(null);}}/></Dialog>}
    {selected&&<TaskDialog key={selected.id} state={state} task={selected} close={()=>setModal(null)} edit={()=>setModal({type:"recipe",itemId:selected.itemId,taskId:selected.id})} save={next=>update(next)} onStatus={next=>statusChange(selected,next)} remove={()=>removeTask(selected)}/>}
    {completing&&<Dialog title="Klopt dit?" subtitle={state.planner.items.find(i=>i.id===completing.itemId)?.name} close={()=>setModal({type:"task",id:completing.id})}><CompletionForm state={state} task={completing} back={()=>setModal({type:"task",id:completing.id})} save={next=>{update(next,"Tijd en gemaakte hoeveelheid bevestigd. Klaar!");setModal(null);}}/></Dialog>}
    {recipeItem&&modal?.type==="recipe"&&<Dialog title={recipeItem.recipeId?"Werkrecept aanpassen":"Recept snel invoeren"} subtitle={recipeItem.name} close={()=>setModal(null)}><RecipeForm state={state} item={recipeItem} taskId={modal.taskId} save={next=>{update(next,"Recept en wijzigingshistorie lokaal opgeslagen.");setModal(modal.taskId?{type:"task",id:modal.taskId}:null);}}/></Dialog>}
    {modal?.type==="agreements"&&<Dialog title="Zo werken we hier" subtitle="Vaste voorbereiding per halffabricaat. 0 = op de dag van gebruik." close={()=>setModal(null)}><PreparationForm state={state} save={next=>update(next,"Werkafspraak opgeslagen. Nieuwe planningen nemen deze over.")}/></Dialog>}
    {modal?.type==="offer"&&offerImage&&<Dialog title={`Week ${weekNumber(week)}`} close={()=>setModal(null)}><img className={s.offerLarge} src={offerImage} alt="Weekaanbieding"/></Dialog>}
    {modal?.type==="reset"&&<Dialog title="Voorbeeld herstellen?" subtitle="Alleen de lokale proefwijzigingen worden gewist." close={()=>setModal(null)}><button className={s.primary} onClick={()=>{update(initialScreenState(),"Het voorbeeld is hersteld.");setWeek(SCREEN_WEEK);setModal(null);}}>Herstel voorbeeld</button></Dialog>}
  </div></div></div>;
}

function Words({text}:{text:string}){return text.split(/\s+/).map((word,i)=><Fragment key={i}>{i>0?" ":null}<span className={s.word} data-fit-word>{word}</span></Fragment>);}

function Dialog({title,subtitle,close,children}:{title:string;subtitle?:string;close:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className={s.dialog} aria-label={title} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}><header><div><span>STRAK gepland · lokale preview</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button aria-label="Sluiten" onClick={close}><Icon name="close" size={22}/></button></header><div className={s.dialogBody}>{children}</div></dialog>;
}
function FormError({error}:{error:string}){return error?<p className={s.error} role="alert">{error}</p>:null;}
function NameField({defaultName}:{defaultName?:string}){return <label>Jouw naam<input name="who" required minLength={2} maxLength={80} defaultValue={defaultName} autoComplete="off" placeholder="Wie legt dit vast?"/></label>;}
function useTimerNow(timer?:WorkTimer){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{if(!timer?.runningSince)return;const tick=()=>setNow(Date.now());tick();const interval=setInterval(tick,1000);return()=>clearInterval(interval);},[timer?.runningSince]);
  return now;
}
function CardClock({timer}:{timer:WorkTimer}){const now=useTimerNow(timer);return <em className={s.cardClock} data-layout-clock><Icon name="clock" size={10}/>{timerLabel(elapsedMilliseconds(timer,now))}{!timer.runningSince&&" · pauze"}</em>;}
function TaskTimer({state,task,save,finish,reopen}:{state:ScreenState;task:Task;save:(state:ScreenState)=>void;finish:()=>void;reopen:()=>void}){
  const timer=state.timers?.[task.id],now=useTimerNow(timer),[error,setError]=useState("");
  const completion=state.completions?.[task.id];
  if(task.status==="done")return <div className={s.timerComplete}><Icon name="check" size={17}/><span>{completion?`${number(completion.quantity)} ${state.planner.items.find(i=>i.id===task.itemId)?.unit} · ${number(completion.minutes)} min · ${completion.who}`:"Klaar"}</span><button className={s.textButton} onClick={reopen}>Heropen</button></div>;
  function start(who:string){try{save(startWorkTimer(state,task.id,who,uid(),new Date().toISOString()));setError("");}catch(e){setError((e as Error).message);}}
  return <section className={s.timerPanel} aria-label="Productietimer">
    {timer?<><div className={s.timerReading}><Icon name="clock" size={21}/><div><output role="timer" aria-live="off" aria-label="Verstreken werktijd">{timerLabel(elapsedMilliseconds(timer,now))}</output><small>{timer.runningSince?"Timer loopt":"Gepauzeerd"} · {timer.who}</small></div></div><div className={s.timerButtons}>{timer.runningSince?<button className={s.quiet} onClick={()=>save(pauseWorkTimer(state,task.id,new Date().toISOString()))}>Pauze</button>:<button className={s.quiet} onClick={()=>start(timer.who)}><Icon name="play" size={15}/>Hervatten</button>}<button className={s.primary} onClick={finish}><Icon name="check" size={16}/>Af</button></div></>:<form className={s.timerStart} onSubmit={e=>{e.preventDefault();start(String(new FormData(e.currentTarget).get("who")));}}><NameField/><button className={s.primary} type="submit"><Icon name="play" size={15}/>Start timer</button><button className={s.textButton} type="button" onClick={finish}>Af zonder timer</button></form>}
    <FormError error={error}/>
  </section>;
}
function CompletionForm({state,task,save,back}:{state:ScreenState;task:Task;save:(state:ScreenState)=>void;back:()=>void}){
  const timer=state.timers?.[task.id],item=state.planner.items.find(i=>i.id===task.itemId)!,measured=timer?.elapsedMs,[error,setError]=useState("");
  return <form className={s.form} onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);try{save(confirmTaskCompletion(state,{taskId:task.id,who:String(data.get("who")),minutes:Number(String(data.get("minutes")).replace(",",".")),quantity:Number(String(data.get("quantity")).replace(",",".")),timerId:timer?.id},uid(),new Date().toISOString()));}catch(e){setError((e as Error).message);}}}>
    <p className={s.completionPrompt}>Controleer je werktijd en wat je hebt gemaakt.</p>
    <div className={s.confirmNumbers}><label>Werktijd (minuten)<input name="minutes" aria-label="Bevestigde werktijd in minuten" inputMode="decimal" required defaultValue={measured!==undefined?String(Math.max(.01,Math.round(measured/600)/100)).replace(".",","):""}/><small>{measured!==undefined?`Gemeten: ${timerLabel(measured)}`:"Geen timer gebruikt · vul de werktijd in"}</small></label><label>Gemaakt ({item.unit})<input name="quantity" aria-label={`Bevestigde hoeveelheid in ${item.unit}`} inputMode="decimal" required defaultValue={String(task.quantity).replace(".",",")}/><small>Gepland: {number(task.quantity)} {item.unit}</small></label></div>
    <NameField defaultName={timer?.who}/><FormError error={error}/>
    <div className={s.confirmActions}><button className={s.quiet} type="button" onClick={back}>Terug</button><button className={s.primary} type="submit"><Icon name="check" size={18}/>Bevestig & rond af</button></div>
  </form>;
}
function OfferTile({image,week,open}:{image?:string;week:string;open:()=>void}){
  const [failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
  return <button className={s.offerTile} disabled={!image||failed} aria-label={image&&!failed?`Vergroot weekaanbieding week ${weekNumber(week)}`:`Geen weekaanbieding voor week ${weekNumber(week)}`} onClick={open}>{image&&!failed?<>{!loaded&&<span className={s.spinner} role="status" aria-label="Aanbieding laden"/>}<img style={{visibility:loaded?"visible":"hidden"}} src={image} alt="Weekaanbieding" onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/></>:<span>Nog geen aanbieding</span>}</button>;
}

function RequestForm({state,save}:{state:ScreenState;save:(state:ScreenState)=>void}){
  const [error,setError]=useState("");
  return <form className={s.form} onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);try{save({...state,planner:applyProductionRequest(state.planner,state.recipes,{kind:"create",itemId:String(data.get("item")),quantity:Number(data.get("quantity")),neededBy:String(data.get("date"))||undefined,note:""},"Logistiek · voorbeeld",new Date().toISOString(),uid())});}catch(e){setError((e as Error).message);}}}><label>Product<select name="item" required><option value="">Kies product…</option>{state.planner.items.filter(i=>i.kind!=="activity").map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><div className={s.formGrid}><label>Aantal<input name="quantity" type="number" min="0.000001" max="1000000" step="any" required/></label><label>Uiterlijk (optioneel)<input name="date" type="date"/></label></div><FormError error={error}/><button className={s.primary}>Toevoegen</button></form>;
}

function PlanForm({state,date,department,requestId,save}:{state:ScreenState;date:string;department:DepartmentId;requestId?:string;save:(state:ScreenState)=>void}){
  const request=state.planner.productionRequests?.find(r=>r.id===requestId);
  const [itemId,setItemId]=useState(request?.itemId||""),[custom,setCustom]=useState(false),[prepare,setPrepare]=useState(true),[error,setError]=useState(""),[amount,setAmount]=useState(String(request?.quantity||1)),[when,setWhen]=useState(date);
  const item=state.planner.items.find(i=>i.id===itemId),recipe=state.recipes.find(r=>r.id===item?.recipeId);
  const preview=()=>{try{const next=planScreenTask(state,{itemId,name:custom?"Nieuw product":"",departmentId:department,date:when,quantity:Number(amount),id:"preview",prepare});return next.planner.tasks.filter(t=>t.generatedFor==="preview");}catch{return [];}};
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget);try{if(request){save({...state,planner:applyProductionRequest(state.planner,state.recipes,{kind:"plan",id:request.id,date:when,departmentId:String(data.get("department")) as DepartmentId},"Proefbakker",new Date().toISOString(),uid())});return;}save(planScreenTask(state,{itemId:custom?undefined:itemId,name:String(data.get("new-name")||""),departmentId:String(data.get("department")) as DepartmentId,date:when,quantity:Number(amount),id:uid(),prepare}));}catch(e){setError((e as Error).message);}}
  return <form className={s.form} onSubmit={submit}>{!request&&<div className={s.choice}><button type="button" aria-pressed={!custom} onClick={()=>{setCustom(false);setError("");}}>Bestaand product</button><button type="button" aria-pressed={custom} onClick={()=>{setCustom(true);setItemId("");setError("");}}>+ Nieuw zonder recept</button></div>}
    {custom?<label>Productnaam<input name="new-name" required maxLength={120} placeholder="Bijvoorbeeld: pistache slof"/></label>:<label>Product of halffabricaat<select required disabled={!!request} value={itemId} onChange={e=>{setItemId(e.target.value);setError("");}}><option value="">Kies een product…</option>{state.planner.items.filter(i=>i.kind!=="activity").map(i=><option key={i.id} value={i.id}>{i.name}{!i.recipeId?" · zonder recept":""}</option>)}</select></label>}
    <div className={s.formGrid}><label>Aantal ({custom?"stuks":item?.unit||"stuks"})<input type="number" required disabled={!!request} min="0.000001" max="1000000" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Productiedatum<input type="date" required max={request?.neededBy} value={when} onChange={e=>setWhen(e.target.value)}/></label><label>Rij<select name="department" defaultValue={department}>{DEPARTMENTS.filter(d=>d.board==="patisserie").map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div>
    {(custom||item&&!recipe)&&<p className={s.notice}><Icon name="warning" size={17}/>Je kunt direct inplannen. Op de kaart verschijnt een tip om het recept aan te vullen.</p>}
    {!request&&recipe?.semiFinishedItems?.length? <section className={s.preparations}><label className={s.checkbox}><input type="checkbox" checked={prepare} onChange={e=>setPrepare(e.target.checked)}/>Halffabricaten meeplannen</label>{prepare&&preview().map(t=><div key={t.id}><span>{state.planner.items.find(i=>i.id===t.itemId)?.name}<small>{number(t.quantity)} {state.planner.items.find(i=>i.id===t.itemId)?.unit}</small></span><b>{dateLabel(t.date,true)}</b></div>)}<small>Volgens Werkafspraken.</small></section>:null}
    <FormError error={error}/><button type="submit" className={s.primary}><Icon name="plus" size={18}/>Inplannen</button>
  </form>;
}

function TaskDialog({state,task,close,edit,save,onStatus,remove}:{state:ScreenState;task:Task;close:()=>void;edit:()=>void;save:(state:ScreenState)=>void;onStatus:(s:TaskStatus)=>void;remove:()=>void}){
  const item=state.planner.items.find(i=>i.id===task.itemId)!,recipe=taskRecipe(state,task),[tab,setTab]=useState("recipe");
  const displayedQuantity=state.completions?.[task.id]?.quantity??task.quantity;
  const logs=state.work.filter(l=>l.taskId===task.id),estimate=workEstimate(state,item.id,task.operation,displayedQuantity);
  const changes=state.history.filter(h=>h.itemId===item.id&&(!h.taskId||h.taskId===task.id)).slice().reverse();
  return <Dialog title={`${number(displayedQuantity)} ${item.unit} ${item.name}`} subtitle={`${dateLabel(task.date,true)} · ${task.operation}`} close={close}>
    <div className={s.taskActions}><TaskTimer state={state} task={task} save={save} finish={()=>onStatus("done")} reopen={()=>onStatus("planned")}/><button onClick={remove} disabled={task.status!=="planned"} className={s.remove} aria-label="Taak verwijderen"><Icon name="trash" size={17}/></button></div>
    <div className={s.tabs} role="group" aria-label="Productiedetails">{[["recipe","Werkrecept"],["time","Werktijd"],["preparation","Voorbereiding"],["history",`Historie${changes.length?` (${changes.length})`:""}`]].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {tab==="recipe"&&<>{state.overrides[task.id]&&<p className={s.notice}>Eenmalig aangepast · alleen voor deze productie.</p>}{recipe?<><div className={s.recipeHeader}><span>Recept voor <b>{number(displayedQuantity)} {item.unit}</b></span><small>{number(displayedQuantity/recipe.yield)} × basisrecept</small></div><div className={s.ingredients}>{recipe.ingredients.map((line,i)=><div key={i}><span>{line.name}</span><b>{number(line.quantity*displayedQuantity/recipe.yield)} {line.unit}</b></div>)}</div><ol className={s.steps}>{recipe.steps.map((step,i)=><li key={i}>{step}</li>)}</ol></>:<div className={s.emptyRecipe}><Icon name="warning" size={24}/><h3>Dit recept ontbreekt nog.</h3><p>De productie is ingepland. Voeg jullie werkwijze en grondstoffen toe zodra het kan.</p></div>}<button className={s.primary} onClick={edit}><Icon name="book" size={17}/>{recipe?"Recept aanpassen":"Recept snel invoeren"}</button></>}
    {tab==="time"&&<>{!logs.length&&<p className={s.hint}>Nog geen bevestigde werktijd.</p>}{estimate&&<p className={s.estimate}>Indicatie uit {estimate.measurements} proefregistratie(s): <b>{estimate.minutes} min</b> voor {number(displayedQuantity)} {item.unit}.</p>}<div className={s.history}>{logs.slice().reverse().map(l=><div key={l.id}><strong>{l.who} · {number(l.minutes)} min</strong><span>{stamp(l.at)} · {number(l.quantity)} {item.unit}{l.measuredMs!==undefined&&` · timer ${timerLabel(l.measuredMs)}`}</span></div>)}</div></>}
    {tab==="preparation"&&<PreparationForm state={state} save={save} recipeIds={recipe?.semiFinishedItems?.map(l=>l.recipeId) || (recipe?.type==="semiFinished"?[recipe.id]:[])}/>}
    {tab==="history"&&<div className={s.history}>{changes.length?changes.map(c=><details key={c.id}><summary><strong>{c.who}</strong><span>{stamp(c.at)} · {c.scope==="once"?"Eenmalig":"Vast"}</span><p>{c.summary}</p></summary>{c.kind==="recipe"&&<div className={s.beforeAfter}><div><h4>Voor wijziging</h4><RecipeSnapshot recipe={c.before}/></div><div><h4>Na wijziging</h4><RecipeSnapshot recipe={c.after}/></div></div>}</details>):<p className={s.hint}>Nog geen proefwijzigingen vastgelegd.</p>}</div>}
  </Dialog>;
}

function RecipeSnapshot({recipe}:{recipe?:DemoRecipe}){return recipe?<><small>Basis: {number(recipe.yield)} {recipe.unit}</small>{recipe.ingredients.map((l,i)=><p key={i}>{l.name} · {number(l.quantity)} {l.unit}</p>)}{recipe.steps.map((step,i)=><p key={`s${i}`}>{step}</p>)}</>:<p>Nog geen recept.</p>;}

function RecipeForm({state,item,taskId,save}:{state:ScreenState;item:Item;taskId?:string;save:(state:ScreenState)=>void}){
  const task=state.planner.tasks.find(t=>t.id===taskId),source=task?taskRecipe(state,task):state.recipes.find(r=>r.id===item.recipeId);
  const [scope,setScope]=useState<"once"|"permanent">(task?"once":"permanent"),[error,setError]=useState("");
  const [draft,setDraft]=useState<DemoRecipe>(source||{id:"draft",name:item.name,type:item.kind==="component"?"semiFinished":"finalProduct",yield:1,unit:item.unit,ingredients:[{name:"",quantity:0,unit:"gram"}],steps:[""],allergens:[]});
  function changeScope(next:"once"|"permanent"){setScope(next);}
  function line(index:number,patch:Partial<DemoRecipe["ingredients"][number]>){setDraft({...draft,ingredients:draft.ingredients.map((l,i)=>i===index?{...l,...patch}:l)});}
  return <form className={s.form} onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);try{save(saveRecipeChange(state,{itemId:item.id,taskId,scope,who:String(data.get("who")),recipe:draft},uid(),new Date().toISOString()));}catch(e){setError((e as Error).message);}}}>
    {task&&<div className={s.choice}><button type="button" aria-pressed={scope==="once"} onClick={()=>changeScope("once")}>Alleen deze productie</button><button type="button" aria-pressed={scope==="permanent"} onClick={()=>changeScope("permanent")}>Vast recept aanpassen</button></div>}
    <p className={s.notice}>{scope==="once"?"Alleen deze productiekaart verandert. Het vaste recept blijft bewaard.":"Het vaste voorbeeldrecept wordt aangepast. Nieuwe producties gebruiken deze versie; bestaande taken blijven op hun plek."}</p>
    <div className={s.formGrid}><NameField/><label>Basisopbrengst ({item.unit})<input type="number" min="0.000001" max="1000000" step="any" required value={draft.yield||""} onChange={e=>setDraft({...draft,yield:Number(e.target.value)})}/></label></div>
    <h3 className={s.subheading}>Grondstoffen</h3><div className={s.editIngredients}>{draft.ingredients.map((l,i)=><div key={i}><label><span className={s.sr}>Grondstof {i+1}</span><input required value={l.name} placeholder="Grondstof" onChange={e=>line(i,{name:e.target.value})}/></label><label><span className={s.sr}>Hoeveelheid {i+1}</span><input required type="number" step="any" min="0.000001" value={l.quantity||""} placeholder="Aantal" onChange={e=>line(i,{quantity:Number(e.target.value)})}/></label><label><span className={s.sr}>Eenheid {i+1}</span><select value={l.unit} onChange={e=>line(i,{unit:e.target.value})}>{["gram","g","kg","ml","liter","stuks"].map(u=><option key={u}>{u}</option>)}</select></label><button type="button" aria-label={`Grondstof ${i+1} verwijderen`} disabled={draft.ingredients.length===1} onClick={()=>setDraft({...draft,ingredients:draft.ingredients.filter((_,j)=>i!==j)})}><Icon name="close" size={17}/></button></div>)}</div><button className={s.textButton} type="button" onClick={()=>setDraft({...draft,ingredients:[...draft.ingredients,{name:"",quantity:0,unit:"gram"}]})}><Icon name="plus" size={16}/>Grondstof toevoegen</button>
    {draft.semiFinishedItems?.length? <p className={s.hint}>Gekoppelde halffabricaten blijven behouden. Hun planning stel je in via Voorbereiding.</p>:null}
    <label>Werkwijze<textarea rows={5} required value={draft.steps.join("\n")} onChange={e=>setDraft({...draft,steps:e.target.value.split("\n")})}/></label>
    <FormError error={error}/><button className={s.primary}><Icon name="check" size={17}/>{scope==="once"?"Eenmalige wijziging bewaren":"Vast werkrecept opslaan"}</button>
  </form>;
}

function PreparationForm({state,recipeIds,save}:{state:ScreenState;recipeIds?:string[];save:(state:ScreenState)=>void}){
  const [error,setError]=useState(""),recipes=state.recipes.filter(r=>r.type==="semiFinished"&&(!recipeIds||recipeIds.includes(r.id)));
  return <div>{!recipes.length?<p className={s.hint}>Dit product heeft nog geen gekoppelde halffabricaten. Vul eerst het recept aan.</p>:<><p className={s.hint}>Aantal dagen vóór de stap waarin dit onderdeel wordt gebruikt. De dag zelf is 0. Dit wordt de standaard voor nieuwe planningen.</p>{recipes.map(recipe=><form key={recipe.id} className={s.preparationForm} onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);try{save(setPreparation(state,recipe.id,Number(data.get("days")),String(data.get("who")),uid(),new Date().toISOString()));setError("");}catch(e){setError((e as Error).message);}}}><h3>{recipe.name}</h3><div className={s.formGrid}><NameField/><label>Dagen vóór gebruik<input name="days" key={state.preparation[recipe.id]??1} type="number" min="0" max="30" required defaultValue={state.preparation[recipe.id]??1}/></label></div><button className={s.quiet}>Afspraak bewaren</button></form>)}</>}<FormError error={error}/></div>;
}
