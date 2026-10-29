"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import Icon from "../productie/ProductionIcon";
import {addTask,editTaskText,resolveTask,addTaskCategory,removeTaskCategory,taskCategories,moveTaskCategory,setTaskPriority,taskLines,toggleTask,TASK_FALLBACK_CATEGORY,taskPriorityGroups,type TaskPriority} from "./model";
import s from "./personal.module.css";
function Pencil(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z"/></svg>;}
export default function TaskOrganizer({body,disabled,onChange}:{body:string;disabled:boolean;onChange:(body:string)=>Promise<boolean|undefined>}){
 const [text,setText]=useState(""),[parent,setParent]=useState<number>(),[editingTask,setEditingTask]=useState<number>(),[error,setError]=useState(""),[category,setCategory]=useState(""),[newCategory,setNewCategory]=useState(""),[addingCategory,setAddingCategory]=useState(false);
 const input=useRef<HTMLInputElement>(null),categoryInput=useRef<HTMLInputElement>(null);
 const tasks=taskLines(body),categories=[TASK_FALLBACK_CATEGORY,...taskCategories(body)],selected=categories.includes(category)?category:"";
 useEffect(()=>{if(parent!==undefined||editingTask!==undefined)input.current?.focus();},[parent,editingTask]);
 useEffect(()=>{if(addingCategory)categoryInput.current?.focus();},[addingCategory]);
 function resetComposer(){setParent(undefined);setEditingTask(undefined);setText("");}
 async function change(next:string){setError("");return onChange(next);}
 async function createCategory(event:FormEvent){event.preventDefault();try{const name=newCategory.trim();if(await change(addTaskCategory(body,name))){setCategory(name);setNewCategory("");setAddingCategory(false);resetComposer();}}catch(e){setError((e as Error).message);}}
 async function removeCategory(){if(!selected||selected===TASK_FALLBACK_CATEGORY||disabled)return;try{if(await change(removeTaskCategory(body,selected))){setCategory(TASK_FALLBACK_CATEGORY);resetComposer();}}catch(e){setError((e as Error).message);}}
 async function resolve(index:number){if(disabled)return;try{if(await change(resolveTask(body,index)))resetComposer();}catch(e){setError((e as Error).message);}}
 async function submit(event:FormEvent){event.preventDefault();try{if(await change(editingTask===undefined?addTask(body,text,parent,selected||TASK_FALLBACK_CATEGORY):editTaskText(body,editingTask,text)))resetComposer();}catch(e){setError((e as Error).message);}}
 function composer(){const inline=editingTask!==undefined||parent!==undefined;return <form className={`${s.taskComposer} ${inline?s.inlineComposer:""}`} onSubmit={event=>void submit(event)}>
  <Icon name={editingTask!==undefined?"check":"plus"} size={18}/><input ref={input} aria-label={editingTask!==undefined?"Taak wijzigen":parent!==undefined?"Nieuwe subtaak":"Nieuwe to-do"} value={text} maxLength={2000} disabled={disabled} onChange={event=>setText(event.target.value)} placeholder={parent!==undefined?"Nieuwe subtaak…":editingTask!==undefined?"Taak wijzigen…":"Nieuwe to-do…"}/>
  <button className={s.iconButton} type="submit" disabled={disabled||!text.trim()} title={editingTask!==undefined?"Opslaan":"Toevoegen"} aria-label={editingTask!==undefined?"Opslaan":"Toevoegen"}><Icon name="arrow" size={17}/></button>{inline&&<button className={s.iconButton} type="button" disabled={disabled} onClick={resetComposer} title="Annuleren" aria-label="Annuleren"><Icon name="close" size={16}/></button>}
 </form>;}
 return <section className={s.taskOrganizer} aria-label="Taken en subtaken">
  <div className={s.taskToolbar}>
   <select aria-label="Taakcategorie kiezen" value={selected} disabled={disabled} onChange={event=>{setCategory(event.target.value);resetComposer();}}><option value="">Alle categorieën</option>{categories.map(name=><option key={name} value={name}>{name}</option>)}</select>
   <button className={s.iconButton} disabled={disabled} onClick={()=>setAddingCategory(value=>!value)} aria-expanded={addingCategory} aria-label="Categorie toevoegen" title="Categorie toevoegen"><Icon name="plus" size={17}/></button>
   {selected&&selected!==TASK_FALLBACK_CATEGORY&&<button className={`${s.iconButton} ${s.resolveButton}`} disabled={disabled} onClick={()=>void removeCategory()} aria-label={`Categorie ${selected} verwijderen; taken naar Dagelijkse to do’s`} title="Categorie verwijderen · taken gaan naar Dagelijkse to do’s"><Icon name="trash" size={16}/></button>}
   <small>{tasks.filter(task=>!selected||task.category===selected).length} taken</small>
  </div>
  {addingCategory&&<form className={s.compactCategoryForm} onSubmit={event=>void createCategory(event)}><input ref={categoryInput} aria-label="Naam nieuwe categorie" placeholder="Naam categorie…" value={newCategory} maxLength={100} disabled={disabled} onChange={event=>setNewCategory(event.target.value)}/><button className={s.iconButton} type="submit" disabled={disabled||!newCategory.trim()} aria-label="Categorie opslaan" title="Categorie opslaan"><Icon name="check" size={17}/></button><button className={s.iconButton} type="button" disabled={disabled} onClick={()=>setAddingCategory(false)} aria-label="Annuleren" title="Annuleren"><Icon name="close" size={16}/></button></form>}
  {error&&<p role="alert" className={s.error}>{error}</p>}
  {parent===undefined&&editingTask===undefined&&composer()}
  <div className={s.taskRows}>{taskPriorityGroups(body).filter(group=>group.tasks.some(task=>!selected||task.category===selected)).map(group=><section key={group.priority} className={s.prioritySection}>
   <h3 className={s.priorityHeading}>{group.label}</h3>
   {categories.filter(name=>(!selected||selected===name)&&group.tasks.some(task=>task.category===name)).map(name=><section key={name}>
   {!selected&&<h4>{name}</h4>}
   {group.tasks.filter(task=>task.category===name).map(task=><div key={task.index} className={s.taskItem} style={{marginInlineStart:`min(${Math.min(task.depth,8)*16}px, 18%)`}}>
    <div className={`${s.taskRow} ${task.done?s.completedTask:""}`}>
     <label className={s.taskCheck}><input type="checkbox" checked={task.done} disabled={disabled} onChange={()=>void change(toggleTask(body,task.index))}/><span>{task.text}{task.priority!=="normal"&&<small className={s.taskBadge}>{task.priority==="priority"?"★ Prioriteit":"Later"}</small>}</span></label>
     <div className={s.taskTools}>
      <details className={s.taskOptions}><summary aria-label={`Opties voor ${task.text}`} title="Categorie en prioriteit"><Icon name="settings" size={16}/></summary><div>{task.depth===0&&<label>Categorie<select aria-label={`Categorie van ${task.text}`} value={task.category} disabled={disabled} onChange={event=>{event.currentTarget.closest("details")?.removeAttribute("open");resetComposer();void change(moveTaskCategory(body,task.index,event.target.value));}}>{categories.map(value=><option key={value} value={value}>{value}</option>)}</select></label>}<label>Prioriteit<select aria-label={`Prioriteit van ${task.text}`} value={task.priority} disabled={disabled} onChange={event=>void change(setTaskPriority(body,task.index,event.target.value as TaskPriority))}><option value="normal">Normaal</option><option value="priority">Prioriteit</option><option value="later">Voor later</option></select></label><div className={s.mobileTaskActions}><button disabled={disabled} onClick={event=>{event.currentTarget.closest("details")?.removeAttribute("open");setParent(undefined);setEditingTask(task.index);setText(task.text);}}>Bewerken</button><button disabled={disabled||task.depth>=8} onClick={event=>{event.currentTarget.closest("details")?.removeAttribute("open");setEditingTask(undefined);setParent(task.index);setText("");}}>Subtaak toevoegen</button></div></div></details>
      <button className={`${s.iconButton} ${s.taskEditAction}`} disabled={disabled} aria-label={`Bewerken: ${task.text}`} title="Bewerken" onClick={()=>{setParent(undefined);setEditingTask(task.index);setText(task.text);}}><Pencil/></button>
      <button className={`${s.iconButton} ${s.taskChildAction}`} disabled={disabled||task.depth>=8} aria-label={`Subtaak toevoegen aan ${task.text}`} title="Subtaak toevoegen" onClick={()=>{setEditingTask(undefined);setParent(task.index);setText("");}}><Icon name="plus" size={17}/></button>
      <button className={`${s.iconButton} ${s.resolveButton}`} disabled={disabled} aria-label={`Oplossen: ${task.text}, inclusief subtaken verwijderen`} title="Oplossen · taak en subtaken verwijderen" onClick={()=>void resolve(task.index)}><Icon name="trash" size={16}/></button>
     </div>
    </div>
    {(editingTask===task.index||parent===task.index)&&composer()}
   </div>)}
  </section>)}</section>)}</div>
  {!tasks.some(task=>!selected||task.category===selected)&&<p className={s.empty}>Nog geen taken in deze categorie.</p>}
 </section>;
}
