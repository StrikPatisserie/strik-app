"use client";
import {useState} from "react";
import {addTask,setTaskPriority,taskLines,toggleTask,type TaskPriority} from "./model";
import s from "./personal.module.css";
type Filter="open"|"priority"|"later"|"done"|"all";
const filters:{id:Filter;label:string}[]=[{id:"open",label:"Nu doen"},{id:"priority",label:"Prioriteit"},{id:"later",label:"Voor later"},{id:"done",label:"Afgerond"},{id:"all",label:"Alles"}];
export default function TaskOrganizer({body,disabled,onChange}:{body:string;disabled:boolean;onChange:(body:string)=>Promise<boolean|undefined>}){
 const [filter,setFilter]=useState<Filter>("open"),[text,setText]=useState(""),[parent,setParent]=useState<number|undefined>(),[error,setError]=useState("");
 const tasks=taskLines(body),matches=(task:typeof tasks[number],view:Filter)=>view==="all"||view==="done"&&task.done||!task.done&&(view==="open"?task.priority!=="later":view==="priority"?task.priority==="priority":task.priority==="later");
 const visible=new Set<number>();
 for(let i=0;i<tasks.length;i++)if(matches(tasks[i],filter)){visible.add(tasks[i].index);let depth=tasks[i].depth;for(let j=i-1;j>=0&&depth>0;j--)if(tasks[j].depth<depth){visible.add(tasks[j].index);depth=tasks[j].depth;}}
 const parentTask=tasks.find(t=>t.index===parent);
 async function submit(event:React.FormEvent){event.preventDefault();setError("");try{if(await onChange(addTask(body,text,parent))){setText("");setParent(undefined);setFilter("all");}}catch(e){setError((e as Error).message);}}
 return <section className={s.taskOrganizer} aria-label="Taken en subtaken">
  <h3>To-do’s <small>{tasks.filter(t=>!t.done).length} open · {tasks.filter(t=>t.done).length} afgerond</small></h3>
  <div className={s.taskFilters} aria-label="Taken filteren">{filters.map(item=><button key={item.id} disabled={disabled} aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.label} <span>{tasks.filter(t=>matches(t,item.id)).length}</span></button>)}</div>
  <div className={s.taskRows}>{tasks.filter(t=>visible.has(t.index)).map(task=><div key={task.index} className={`${s.taskRow} ${task.done?s.completedTask:""}`} style={{marginInlineStart:`${Math.min(task.depth,8)*18}px`}} data-context={!matches(task,filter)||undefined}>
   <label className={s.taskCheck}><input type="checkbox" checked={task.done} disabled={disabled} onChange={()=>void onChange(toggleTask(body,task.index))}/><span>{task.text}</span></label>
   <div className={s.taskTools}><select aria-label={`Prioriteit van ${task.text}`} value={task.priority} disabled={disabled} onChange={e=>void onChange(setTaskPriority(body,task.index,e.target.value as TaskPriority))}><option value="normal">Normaal</option><option value="priority">★ Prioriteit</option><option value="later">Voor later</option></select><button disabled={disabled||task.depth>=8} onClick={()=>{setParent(task.index);setText("");document.getElementById("personal-new-task")?.focus();}}>+ Subtaak</button></div>
  </div>)}</div>
  {!visible.size&&<p className={s.hint}>Geen taken in deze selectie.</p>}
  <form className={s.taskForm} onSubmit={event=>void submit(event)}><label htmlFor="personal-new-task">{parentTask?`Subtaak onder: ${parentTask.text}`:"Nieuwe to-do"}</label><div><input id="personal-new-task" value={text} disabled={disabled} maxLength={2000} onChange={e=>setText(e.target.value)} placeholder={parentTask?"Wat moet er voor deze taak gebeuren?":"Wat wil je doen?"}/><button className={s.primary} disabled={disabled||!text.trim()} type="submit">Toevoegen</button>{parent!==undefined&&<button type="button" disabled={disabled} onClick={()=>setParent(undefined)}>Annuleren</button>}</div></form>
  {error&&<p role="alert" className={s.hint}>{error}</p>}
  <p className={s.hint}>‘Nu doen’ toont open taken zonder ‘Voor later’. Subtaken vink je afzonderlijk af.</p>
 </section>;
}
