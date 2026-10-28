"use client";
import { useState,type ComponentType,type ReactNode,type FormEvent } from "react";
import Icon from "./ProductionIcon";
import { addDays,mondayOf,dateLabel,cleaningProgress,type CleaningDay,type CleaningCommand } from "./planning";
import s from "../preview/productie/production.module.css";

type Selection={date:string;edit?:boolean};
type DialogProps={title:string;subtitle?:string;onClose:()=>void;children:ReactNode};
type Props={days:string[];day:string;today:string;rows:CleaningDay[];canManage:boolean;canCheck:boolean;saving:boolean;statusFilter:string;selected:Selection|null;Dialog:ComponentType<DialogProps>;onOpen:(selection:Selection|null)=>void;onCommand:(command:CleaningCommand)=>Promise<string|undefined>};

export default function CleaningWeekLane({days,day,today,rows,canManage,canCheck,saving,statusFilter,selected,Dialog,onOpen,onCommand}:Props){
  const [error,setError]=useState("");
  const visible=rows.filter(r=>days.includes(r.date)),done=visible.filter(r=>cleaningProgress(r).complete).length;
  const current=selected?rows.find(r=>r.date===selected.date):undefined;
  const open=(selection:Selection|null)=>{setError("");onOpen(selection);};
  const save=async(command:CleaningCommand)=>{const message=await onCommand(command);setError(message || "");return message;};
  return <>
    <div className={`${s.departmentRow} ${s.cleaningLane}`} aria-label="Schoonmaak Patisserie">
      <div className={s.departmentLabel}><span className={s.departmentMark}/><h2><Icon name="cleaning" size={15}/>Schoonmaak</h2><span>{visible.length?`${done}/${visible.length} dagen klaar`:"Nog niet ingepland"}</span>{canManage && <button className={s.textLink} onClick={()=>open({date:days.includes(day)?day:days[0],edit:true})}><Icon name="plus" size={13}/>Inplannen</button>}</div>
      {days.map(date=>{const row=rows.find(r=>r.date===date),progress=row?cleaningProgress(row):undefined;
        const show=row && (statusFilter==="all" || (statusFilter==="done"?progress!.complete:statusFilter==="open"?!progress!.complete:statusFilter==="active"?progress!.done>0 && !progress!.complete:false));
        return <div key={date} className={`${s.dayCell} ${date===day?s.mobileSelectedDay:""} ${date===today?s.todayCell:""}`} aria-label={`Schoonmaak · ${dateLabel(date,true)}`} onDragOver={event=>{if(canManage && !saving && event.dataTransfer.types.includes("application/x-strik-cleaning")){event.preventDefault();event.dataTransfer.dropEffect="move";}}} onDrop={event=>{const from=event.dataTransfer.getData("application/x-strik-cleaning");if(canManage && !saving && from){event.preventDefault();void save({kind:"move",date:from,to:date});}}}>
          {show && <article className={`${s.cleaningCard} ${progress!.complete?s.cleaningComplete:""}`} draggable={canManage && !saving && progress!.done===0} onDragStart={event=>{event.dataTransfer.setData("application/x-strik-cleaning",date);event.dataTransfer.effectAllowed="move";}}>
            {row.main?<button className={s.cleaningMainCheck} aria-label={`Hoofdtaak afvinken: ${row.main.label} · ${dateLabel(date,true)}`} aria-pressed={row.main.done} disabled={!canCheck || saving} onClick={()=>void save({kind:"check",date,checkId:row.main!.id,done:!row.main!.done})}><span className={s.cleaningCheckBox}>{row.main.done && <Icon name="check" size={12}/>}</span></button>:<Icon name="cleaning" size={15}/>}
            <button className={s.cleaningOpen} aria-label={`Open schoonmaak · ${dateLabel(date,true)}`} onClick={()=>open({date})}><strong>{row.main?.label || "Dagelijkse schoonmaak"}</strong><small>{progress!.done}/{progress!.total} afgevinkt</small></button>
          </article>}
          {!row && canManage && <button className={s.cellAdd} aria-label={`Schoonmaak plannen · ${dateLabel(date,true)}`} onClick={()=>open({date,edit:true})}><Icon name="plus" size={14}/><span>Schoonmaak</span></button>}
        </div>;
      })}
    </div>
    {error && !selected && <p role="alert" className={s.formError}>{error}</p>}
    {selected && (selected.edit || !current) && canManage && <CleaningEditor key={`${selected.date}:edit`} date={selected.date} current={current} saving={saving} Dialog={Dialog} onClose={()=>open(null)} onSave={async command=>{const message=await save(command);if(!message)open(null);return message;}}/>}
    {selected && !selected.edit && current && <Dialog title="Schoonmaak Patisserie" subtitle={dateLabel(current.date,true)} onClose={()=>open(null)}><div className={s.dialogBody}>
      {current.main && <><h3 className={s.cleaningListHeading}>Hoofdtaak</h3><CleaningCheckRow check={current.main} saving={saving || !canCheck} onChange={done=>void save({kind:"check",date:current.date,checkId:current.main!.id,done})}/></>}
      {!!current.daily.length && <><h3 className={s.cleaningListHeading}>Dagelijkse taken</h3>{current.daily.map(check=><CleaningCheckRow key={check.id} check={check} saving={saving || !canCheck} onChange={done=>void save({kind:"check",date:current.date,checkId:check.id,done})}/>)}</>}
      {error && <p role="alert" className={s.formError}>{error}</p>}
    </div><footer className={s.dialogFooter}>{canManage && <><button disabled={saving} className={s.secondaryButton} onClick={()=>open({date:current.date,edit:true})}>Planning aanpassen</button><button disabled={saving || cleaningProgress(current).done>0} className={`${s.taskIconButton} ${s.taskDeleteButton}`} aria-label="Schoonmaakdag verwijderen" title={cleaningProgress(current).done?"Heropen eerst de afgevinkte taken":"Schoonmaakdag verwijderen"} onClick={async()=>{if(!await save({kind:"remove",date:current.date}))open(null);}}><Icon name="trash" size={19}/></button></>}<button className={`${s.taskIconButton} ${s.taskBackButton}`} aria-label="Terug naar het bord" title="Terug naar het bord" onClick={()=>open(null)}><Icon name="back" size={20}/></button></footer></Dialog>}
  </>;
}

function CleaningCheckRow({check,saving,onChange}:{check:CleaningDay["daily"][number];saving:boolean;onChange:(done:boolean)=>void}){
  return <label className={`${s.cleaningCheckRow} ${check.done?s.cleaningChecked:""}`}><input type="checkbox" checked={check.done} disabled={saving} onChange={event=>onChange(event.target.checked)}/><span><strong>{check.label}</strong>{check.completedAt && <small>Afgevinkt {new Intl.DateTimeFormat("nl-NL",{timeZone:"Europe/Amsterdam",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(check.completedAt))}</small>}</span></label>;
}

function CleaningEditor({date:initialDate,current,saving,Dialog,onClose,onSave}:{date:string;current?:CleaningDay;saving:boolean;Dialog:ComponentType<DialogProps>;onClose:()=>void;onSave:(command:CleaningCommand)=>Promise<string|undefined>}){
  const [date,setDate]=useState(initialDate),[repeat,setRepeat]=useState(false),[error,setError]=useState("");
  const week=mondayOf(initialDate),days=Array.from({length:7},(_,i)=>addDays(week,i));
  const [repeatDates,setRepeatDates]=useState(days.slice(0,5));
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const data=new FormData(event.currentTarget),main=String(data.get("main")).trim(),daily=String(data.get("daily")).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(!main && !daily.length){setError("Vul een hoofdtaak of dagelijkse taken in.");return;}
    setError(await onSave({kind:"plan",date,main,daily,repeatDates:repeat?repeatDates.filter(d=>d!==date):[]}) || "");
  }
  return <Dialog title={current?"Schoonmaak aanpassen":"Schoonmaak inplannen"} subtitle="Patisserie" onClose={onClose}><form onSubmit={submit} onChangeCapture={()=>setError("")}><div className={s.dialogBody}>
    <label className={s.field}>Dag<input type="date" value={date} readOnly={!!current} min={week} max={addDays(week,6)} required onChange={event=>setDate(event.target.value)}/></label>
    <label className={s.field}>Hoofdtaak van deze dag<input name="main" maxLength={300} defaultValue={current?.main?.label || ""} placeholder="Bijvoorbeeld: koelcel grondig reinigen"/></label>
    <label className={s.field}>Dagelijkse taken · één per regel<textarea name="daily" aria-label="Dagelijkse taken · één per regel" rows={5} maxLength={12040} defaultValue={current?.daily.map(c=>c.label).join("\n") || ""} placeholder={"Werkbanken reinigen\nVloer schoonmaken"}/></label>
    <label className={s.cleaningRepeat}><input type="checkbox" checked={repeat} onChange={event=>setRepeat(event.target.checked)}/><span>Dagelijkse taken ook op andere dagen deze week</span></label>
    {repeat && <fieldset className={s.cleaningRepeatDays}><legend>Hoofdtaken en extra dagelijkse taken blijven staan</legend>{days.map(day=><label key={day}><input type="checkbox" checked={day===date || repeatDates.includes(day)} disabled={day===date} onChange={event=>setRepeatDates(current=>event.target.checked?[...current,day]:current.filter(d=>d!==day))}/>{dateLabel(day)}</label>)}</fieldset>}
    {error && <p role="alert" className={s.formError}>{error}</p>}
  </div><footer className={s.dialogFooter}><button type="button" className={s.secondaryButton} onClick={onClose}>Annuleren</button><button type="submit" className={s.primaryButton} disabled={saving}>{saving?"Opslaan…":"Schoonmaak opslaan"}</button></footer></form></Dialog>;
}
