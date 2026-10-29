"use client";
import {useState} from "react";
import {addTask,editTaskText,addTaskCategory,removeTaskCategory,taskCategories,moveTaskCategory,setTaskPriority,taskLines,toggleTask,type TaskPriority} from "./model";
import s from "./personal.module.css";
type Filter="open"|"priority"|"later"|"done"|"all";
const filters:{id:Filter;label:string}[]=[{id:"open",label:"Nu doen"},{id:"priority",label:"Prioriteit"},{id:"later",label:"Voor later"},{id:"done",label:"Afgerond"},{id:"all",label:"Alles"}];
export default function TaskOrganizer({body,disabled,onChange}:{body:string;disabled:boolean;onChange:(body:string)=>Promise<boolean|undefined>}){
 const [filter,setFilter]=useState<Filter>("open"),[text,setText]=useState(""),[parent,setParent]=useState<number|undefined>(),[error,setError]=useState(""),[category,setCategory]=useState(""),[newCategory,setNewCategory]=useState(""),[editingTask,setEditingTask]=useState<number|undefined>();
 const tasks=taskLines(body),categories=["Algemeen",...taskCategories(body)],matches=(task:typeof tasks[number],view:Filter)=>view==="all"||view==="done"&&task.done||!task.done&&(view==="open"?task.priority!=="later":view==="priority"?task.priority==="priority":task.priority==="later");
 const visible=new Set<number>();
 for(let i=0;i<tasks.length;i++)if(matches(tasks[i],filter)&&(!category||tasks[i].category===category)){visible.add(tasks[i].index);let depth=tasks[i].depth;for(let j=i-1;j>=0&&depth>0;j--)if(tasks[j].depth<depth){visible.add(tasks[j].index);depth=tasks[j].depth;}}
 const parentTask=tasks.find(t=>t.index===parent);
 async function createCategory(event:React.FormEvent){event.preventDefault();setError("");try{const name=newCategory.trim();if(await onChange(addTaskCategory(body,name))){setCategory(name);setNewCategory("");}}catch(e){setError((e as Error).message);}}
 async function removeCategory(){
  if(!category||category==='Algemeen'||disabled)return;setError("");
  try{if(await onChange(removeTaskCategory(body,category))){setCategory('Algemeen');setParent(undefined);setEditingTask(undefined);setText('');setFilter('all');}}catch(e){setError((e as Error).message);}
 }
 async function submit(event:React.FormEvent){event.preventDefault();setError("");try{if(await onChange(editingTask===undefined?addTask(body,text,parent,category||"Algemeen"):editTaskText(body,editingTask,text))){setText("");setParent(undefined);setEditingTask(undefined);setFilter("all");}}catch(e){setError((e as Error).message);}}
 return <section className={s.taskOrganizer} aria-label="Taken en subtaken">
  <h3>To-do’s <small>{tasks.filter(t=>!t.done).length} open · {tasks.filter(t=>t.done).length} afgerond</small></h3>
  <div className={s.categoryFilters} aria-label="Taakcategorieën"><button disabled={disabled} aria-pressed={!category} onClick={()=>{setCategory("");setParent(undefined);}}>Alle categorieën</button>{categories.map(name=><button key={name} disabled={disabled} aria-pressed={category===name} onClick={()=>{setCategory(name);setParent(undefined);}}>{name}</button>)}</div>
  {category&&category!=="Algemeen"&&<div className={s.categoryRemoval}><span>Categorie verwijderen verplaatst alle taken en subtaken naar Algemeen.</span><button disabled={disabled} onClick={()=>void removeCategory()}>Categorie verwijderen</button></div>}
  <form className={s.categoryForm} onSubmit={event=>void createCategory(event)}><input aria-label="Nieuwe subcategorie" placeholder="Eigen subcategorie…" maxLength={100} value={newCategory} disabled={disabled} onChange={e=>setNewCategory(e.target.value)}/><button type="submit" disabled={disabled||!newCategory.trim()}>+ Categorie</button></form>
  <div className={s.taskFilters} aria-label="Taken filteren">{filters.map(item=><button key={item.id} disabled={disabled} aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.label} <span>{tasks.filter(t=>matches(t,item.id)&&(!category||t.category===category)).length}</span></button>)}</div>
  <div className={s.taskRows}>{categories.filter(name=>tasks.some(t=>t.category===name&&visible.has(t.index))).map(name=><section key={name}><h4>{name}</h4>{tasks.filter(t=>t.category===name&&visible.has(t.index)).map(task=><div key={task.index} className={`${s.taskRow} ${task.done?s.completedTask:""}`} style={{marginInlineStart:`${Math.min(task.depth,8)*18}px`}} data-context={!matches(task,filter)||undefined}>
   <label className={s.taskCheck}><input type="checkbox" checked={task.done} disabled={disabled} onChange={()=>void onChange(toggleTask(body,task.index))}/><span>{task.text}</span></label>
   <div className={s.taskTools}>{task.depth===0&&<select aria-label={`Categorie van ${task.text}`} value={task.category} disabled={disabled} onChange={e=>{setParent(undefined);setEditingTask(undefined);setText("");void onChange(moveTaskCategory(body,task.index,e.target.value));}}>{categories.map(name=><option key={name} value={name}>{name}</option>)}</select>}<select aria-label={`Prioriteit van ${task.text}`} value={task.priority} disabled={disabled} onChange={e=>void onChange(setTaskPriority(body,task.index,e.target.value as TaskPriority))}><option value="normal">Normaal</option><option value="priority">★ Prioriteit</option><option value="later">Voor later</option></select><button disabled={disabled} onClick={()=>{setEditingTask(task.index);setParent(undefined);setText(task.text);document.getElementById("personal-new-task")?.focus();}}>Bewerken</button><button disabled={disabled||task.depth>=8} onClick={()=>{setEditingTask(undefined);setParent(task.index);setText("");document.getElementById("personal-new-task")?.focus();}}>+ Subtaak</button></div>
  </div>)}</section>)}</div>
  {!visible.size&&<p className={s.hint}>Geen taken in deze selectie.</p>}
  <form className={s.taskForm} onSubmit={event=>void submit(event)}><label htmlFor="personal-new-task">{editingTask!==undefined?"Taak wijzigen":parentTask?`Subtaak onder: ${parentTask.text}`:`Nieuwe to-do · ${category||"Algemeen"}`}</label><div><input id="personal-new-task" value={text} disabled={disabled} maxLength={2000} onChange={e=>setText(e.target.value)} placeholder={parentTask?"Wat moet er voor deze taak gebeuren?":"Wat wil je doen?"}/><button className={s.primary} disabled={disabled||!text.trim()} type="submit">{editingTask!==undefined?"Opslaan":"Toevoegen"}</button>{(parent!==undefined||editingTask!==undefined)&&<button type="button" disabled={disabled} onClick={()=>{setParent(undefined);setEditingTask(undefined);setText("");}}>Annuleren</button>}</div></form>
  {error&&<p role="alert" className={s.hint}>{error}</p>}
  <p className={s.hint}>‘Nu doen’ toont open taken zonder ‘Voor later’. Subtaken vink je afzonderlijk af.</p>
 </section>;
}
