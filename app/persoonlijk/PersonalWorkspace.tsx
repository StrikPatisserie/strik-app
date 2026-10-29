"use client";
import { useEffect,useRef,useState } from "react";
import Icon from "../productie/ProductionIcon";
import { personalDemo } from "./demo";
import { newPersonalNote,personalInput,taskLines,isTodoNotebook,type PersonalNote,type PersonalNoteInput } from "./model";
import s from "./personal.module.css";
import TaskOrganizer from "./TaskOrganizer";
import {startTimeline,recordTimeline,stepTimeline,acceptTimeline,reopenTimeline,type NoteTimeline} from "./undo";
type Summary=Omit<PersonalNote,"body">&{excerpt:string;tasks:ReturnType<typeof taskLines>;attachmentCount:number};
type View="all"|"pinned"|"archive";
const views:{id:View;name:string;icon:"book"|"check"|"stock"|"box"}[]=[{id:"all",name:"Alle notities",icon:"book"},{id:"pinned",name:"Vastgezet",icon:"stock"},{id:"archive",name:"Archief",icon:"box"}];
const summarize=(note:PersonalNote):Summary=>({...note,excerpt:note.body.slice(0,180),tasks:isTodoNotebook(note.notebook)?taskLines(note.body):[],attachmentCount:note.attachments.length});
function input(note:PersonalNote):PersonalNoteInput {const {id,title,notebook,body,tags,pinned,archived,attachments,source_hash,source_created_at,source_updated_at}=note;return{id,title,notebook,body,tags,pinned,archived,attachments,source_hash,source_created_at,source_updated_at};}
async function json(url:string,options?:RequestInit){const response=await fetch(url,{cache:"no-store",...options}),data=await response.json();if(!response.ok)throw Error(data.message||"Laden is mislukt.");return data;}
function Line({text}:{text:string}){return <>{text.split(/(https?:\/\/[^\s<>]+)/g).map((part,index)=>/^https?:\/\//.test(part)?<a key={index} href={part} rel="noreferrer noopener" target="_blank">{part}</a>:part)}</>;}
export default function PersonalWorkspace({ownerId="",demo=false}:{ownerId?:string;demo?:boolean}) {
 const [demoNotes,setDemoNotes]=useState(personalDemo),[notes,setNotes]=useState<Summary[]>(demo?personalDemo.map(summarize):[]),[books,setBooks]=useState<string[]>([]),[view,setView]=useState<View>("all"),[book,setBook]=useState(""),[search,setSearch]=useState(""),[offset,setOffset]=useState(0),[total,setTotal]=useState(0),[epoch,setEpoch]=useState(0),[loading,setLoading]=useState(!demo),[error,setError]=useState(""),[draft,setDraft]=useState<PersonalNote|null>(null),[saved,setSaved]=useState<PersonalNote|null>(null),[editing,setEditing]=useState(false),[saving,setSaving]=useState(false);
 const listSerial=useRef(0),noteSerial=useRef(0),savingLock=useRef(false);
 const [histories,setHistories]=useState<Record<string,NoteTimeline>>({}),[restoreSerial,setRestoreSerial]=useState(0);
 const dirty=!!draft&&(!saved||JSON.stringify(input(draft))!==JSON.stringify(input(saved)));
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty]);
 useEffect(()=>{
  const serial=++listSerial.current;let cancelled=false;
  if(demo){const filtered=demoNotes.filter(note=>note.archived===(view==="archive")&&(!book||note.notebook===book)&&(view!=="pinned"||note.pinned)&&`${note.title}\n${note.body}`.toLocaleLowerCase("nl-NL").includes(search.toLocaleLowerCase("nl-NL"))).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updated_at.localeCompare(a.updated_at));setNotes(filtered.map(summarize));setBooks([...new Set(demoNotes.map(n=>n.notebook))].sort());setTotal(filtered.length);return;}
  const timer=setTimeout(async()=>{setLoading(true);try{const params=new URLSearchParams({view,search,offset:String(offset)});if(book)params.set("notebook",book);const result=await json(`/api/persoonlijk?${params}`);if(!cancelled&&serial===listSerial.current){setNotes(result.notes);setBooks(result.notebooks.map((item:{notebook:string})=>item.notebook));setTotal(result.total);}}catch(e){if(!cancelled&&serial===listSerial.current)setError((e as Error).message);}finally{if(!cancelled&&serial===listSerial.current)setLoading(false);}},search?250:0);
  return()=>{clearTimeout(timer);cancelled=true;};
 },[demo,demoNotes,view,book,search,offset,epoch]);
 function leave(){if(savingLock.current){setError("Wacht even tot de wijziging is opgeslagen.");return false;}if(dirty){setError("Sla je wijzigingen eerst op, of kies ‘Wijzigingen verwerpen’.");return false;}setError("");return true;}
 function filter(next:View,notebook=""){if(!leave())return;setView(next);setBook(notebook);setOffset(0);setDraft(null);setSaved(null);noteSerial.current++;}
 function showNote(note:PersonalNote){setHistories(current=>({...current,[note.id]:reopenTimeline(current[note.id],note)}));setDraft(note);setSaved(note);setBook(note.notebook);setEditing(false);setError("");}
 async function selectBook(notebook:string){
  if(!leave())return;const serial=++noteSerial.current;setView('all');setBook(notebook);setSearch('');setOffset(0);setDraft(null);setSaved(null);
  try{const list=demo?demoNotes.filter(note=>!note.archived&&note.notebook===notebook):(await json(`/api/persoonlijk?notebook=${encodeURIComponent(notebook)}`)).notes;
   if(serial!==noteSerial.current||list.length!==1)return;
   const note=demo?list[0]:(await json(`/api/persoonlijk?id=${encodeURIComponent(list[0].id)}`)).note;if(serial===noteSerial.current)showNote(note);
  }catch(e){if(serial===noteSerial.current)setError((e as Error).message);}
 }
 async function open(id:string){if(!leave())return;const serial=++noteSerial.current;try{const note=demo?demoNotes.find(n=>n.id===id):(await json(`/api/persoonlijk?id=${encodeURIComponent(id)}`)).note;if(note&&serial===noteSerial.current){showNote(note);}}catch(e){if(serial===noteSerial.current)setError((e as Error).message);}}
 function add(){if(!leave())return;noteSerial.current++;const note=newPersonalNote(book||"Mijn notities");setDraft(note);setHistories(current=>({...current,[note.id]:startTimeline(note)}));setSaved(null);setEditing(true);}
 async function save(next=draft,restoring?:NoteTimeline){
  if(!next||savingLock.current)return;savingLock.current=true;setSaving(true);setError("");
  try{
   const payload=personalInput(input(next),ownerId||"00000000-0000-4000-8000-000000000000"),note:PersonalNote=demo?{...next,...payload,revision:next.revision+1,updated_at:new Date().toISOString()}:(await json("/api/persoonlijk",{method:next.revision?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,revision:next.revision})})).note;
   if(demo)setDemoNotes(current=>[note,...current.filter(n=>n.id!==note.id)]);
   setHistories(current=>({...current,[note.id]:acceptTimeline(restoring||current[note.id]||startTimeline(saved||next),note)}));
   setDraft(note);setSaved(note);setEditing(false);setEpoch(e=>e+1);return true;
  }catch(e){
   if(!restoring){setHistories(current=>({...current,[next.id]:recordTimeline(current[next.id]||startTimeline(saved||next),input(next))}));setDraft(next);setEditing(true);}
   setError((e as Error).message);return false;
  }finally{savingLock.current=false;setSaving(false);}
 }
 function change(fields:Partial<PersonalNote>){
  if(!draft||savingLock.current)return;const next={...draft,...fields};setDraft(next);
  setHistories(current=>({...current,[next.id]:recordTimeline(current[next.id]||startTimeline(draft),input(next),Object.keys(fields).sort().join(','))}));
 }
 async function restore(direction:'undo'|'redo'){
  if(!draft||savingLock.current)return;const state=histories[draft.id];if(!state)return;const target=stepTimeline(state,direction);if(!target)return;
  const next={...draft,...target.present,revision:saved?.revision??draft.revision};
  if(editing){setDraft(next);setHistories(current=>({...current,[next.id]:target}));setError("");setRestoreSerial(value=>value+1);}
  else if(await save(next,target))setRestoreSerial(value=>value+1);
 }
 function discard(){if(saved&&draft)setHistories(current=>({...current,[draft.id]:recordTimeline(current[draft.id]||startTimeline(draft),input(saved))}));setDraft(saved);setEditing(false);setError("");}
 const selectedTasks=draft?taskLines(draft.body):[],hasTasks=!!draft&&isTodoNotebook(draft.notebook);
 return <div className={s.root} onKeyDown={event=>{
  if((event.metaKey||event.ctrlKey)&&!event.altKey&&event.key.toLowerCase()==="z"&&!(event.target as HTMLElement).closest("input,textarea,[contenteditable=true]")){
   event.preventDefault();void restore(event.shiftKey?'redo':'undo');
  }
 }}>
  <header className={s.header}><div><span className={s.eyebrow}>{demo?"Preview · fictieve gegevens":"Alleen voor jou"}</span><h1>Mijn to-do’s & notities</h1></div><div className={s.actions}><button className={s.primary} onClick={add}><Icon name="plus" size={17}/>Notitie</button></div></header>
  {demo&&<p className={s.preview}>Dit is een werkende preview. Wijzigingen blijven alleen in dit open venster.</p>}
  {error&&<div className={s.error} role="alert">{error}<button aria-label="Melding sluiten" onClick={()=>setError("")}><Icon name="close" size={16}/></button></div>}
  <div className={s.workspace} data-note-open={!!draft}>
   <aside className={s.folders} aria-label="Notitieboeken"><input className={s.sidebarSearch} aria-label="Zoek in alle notities" placeholder="Zoeken…" value={search} onChange={e=>{if(leave()){filter("all");setSearch(e.target.value);}}}/><nav>{views.map(item=><button key={item.id} aria-current={view===item.id&&!book?"page":undefined} onClick={()=>filter(item.id)}><Icon name={item.icon} size={17}/>{item.name}</button>)}</nav><h2>Notitieboeken</h2>{books.map(name=><button key={name} aria-current={book===name?"page":undefined} onClick={()=>void selectBook(name)}><Icon name="book" size={15}/>{name}</button>)}<p>Persoonlijke notities worden niet gedeeld met het team.</p></aside>
   <section className={s.noteList} aria-label="Notities"><div className={s.listTop}><input aria-label="Zoek in je notities" placeholder="Zoek in al je notities…" value={search} onChange={e=>{if(leave()){setSearch(e.target.value);setOffset(0);}}}/><select aria-label="Kies notitieboek" value={book?`book:${book}`:view} onChange={e=>e.target.value.startsWith("book:")?void selectBook(e.target.value.slice(5)):filter(e.target.value as View)}>{views.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}{books.map(name=><option key={name} value={`book:${name}`}>{name}</option>)}</select><p>{book||views.find(v=>v.id===view)?.name}<span>{loading?"Laden…":`${total} notities`}</span></p></div><div className={s.notes}>{notes.map(note=><button key={note.id} aria-pressed={draft?.id===note.id} className={s.noteCard} onClick={()=>void open(note.id)}><strong>{note.pinned&&<Icon name="stock" size={12}/>} {note.title}</strong><span>{note.excerpt||"Nog geen tekst"}</span><small>{note.notebook}{note.tasks.length?` · ${note.tasks.length} taken`:""}{!isTodoNotebook(note.notebook)&&note.attachmentCount?` · ${note.attachmentCount} bijlagen`:""}</small></button>)}{!loading&&!notes.length&&<p className={s.empty}>Geen notities gevonden.<br/>Voeg een notitie toe.</p>}</div>{!demo&&total>50&&<div className={s.pages}><button disabled={!offset||loading} onClick={()=>{if(leave())setOffset(Math.max(0,offset-50));}}>Vorige</button><span>{offset+1}–{Math.min(offset+50,total)}</span><button disabled={offset+50>=total||loading} onClick={()=>{if(leave())setOffset(offset+50);}}>Volgende</button></div>}</section>
   <section className={s.editor} aria-label="Notitie-inhoud">{draft?<>
    <div className={s.editorBar}><button className={s.mobileBack} aria-label="Terug naar notities" onClick={()=>{if(leave()){setDraft(null);setSaved(null);}}}><Icon name="back" size={17}/></button><span>{saving?"Opslaan…":dirty?"Nog niet opgeslagen":demo?"Voorbeeldnotitie":"Opgeslagen"}</span><div><button disabled={saving||!histories[draft.id]?.past.length} title="Ongedaan maken (⌘/Ctrl+Z)" aria-label="Ongedaan maken" onClick={()=>void restore('undo')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10h10a7 7 0 0 1 0 14M3 10l5-5M3 10l5 5" transform="translate(0 -3)"/></svg></button><button disabled={saving||!histories[draft.id]?.future.length} title="Opnieuw uitvoeren (⌘/Ctrl+Shift+Z)" aria-label="Opnieuw uitvoeren" onClick={()=>void restore('redo')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 7H11a7 7 0 0 0 0 14M21 7l-5-5M21 7l-5 5"/></svg></button><button disabled={saving} title={draft.pinned?"Losmaken":"Vastzetten"} aria-label={draft.pinned?"Losmaken":"Vastzetten"} aria-pressed={draft.pinned} onClick={()=>void save({...draft,pinned:!draft.pinned})}><Icon name="stock" size={17}/></button><button disabled={saving} title={draft.archived?"Uit archief halen":"Archiveren"} aria-label={draft.archived?"Uit archief halen":"Archiveren"} onClick={()=>void save({...draft,archived:!draft.archived})}><Icon name="box" size={17}/></button>{!editing&&<button onClick={()=>setEditing(true)}>Bewerken</button>}</div></div>
    <div className={s.paper}>{editing?<><input className={s.titleInput} aria-label="Titel notitie" value={draft.title} maxLength={500} disabled={saving} onChange={e=>change({title:e.target.value})}/><label className={s.bookField}>Notitieboek<input value={draft.notebook} maxLength={200} list="personal-notebook-list" disabled={saving} onChange={e=>change({notebook:e.target.value})}/><label className={s.notePriority}><input type="checkbox" checked={draft.pinned} disabled={saving} onChange={e=>change({pinned:e.target.checked})}/> Prioriteit · bovenaan vastzetten</label><datalist id="personal-notebook-list">{books.map(name=><option key={name} value={name}/>)}</datalist></label>{hasTasks?<p className={s.hint}>Je taken blijven bewaard. Bewerk taken afzonderlijk met ‘Bewerken’ in de takenlijst; daar kun je ook prioriteit, categorie en subtaken aanpassen.</p>:<textarea aria-label="Notitietekst" value={draft.body} maxLength={500000} disabled={saving} onChange={e=>change({body:e.target.value})} placeholder="Schrijf je notitie…"/>}</>:<><h2>{draft.title}</h2><div className={s.noteMeta}>{draft.notebook}{hasTasks&&selectedTasks.length>0&&<span>{selectedTasks.length} taken</span>}</div>{hasTasks&&<TaskOrganizer key={`${draft.id}:${restoreSerial}`} body={draft.body} disabled={saving||dirty} onChange={body=>save({...draft,body})}/>}{!hasTasks&&<div className={s.noteBody}>{draft.body.split("\n").map((line,index)=>hasTasks&&(selectedTasks.some(t=>t.index===index)||/^## .+/.test(line))?null:<p key={index}>{line?<Line text={!hasTasks&&selectedTasks.some(t=>t.index===index)?`• ${selectedTasks.find(t=>t.index===index)?.text}`:line}/>:<br/>}</p>)}</div>}</>}
    {!!draft.tags.length&&<div className={s.tags}>{draft.tags.map(tag=><span key={tag}>{tag}</span>)}</div>}
    {!hasTasks&&!!draft.attachments.length&&<div className={s.attachments}><h3>Bijlagen & bronexport</h3>{draft.attachments.map(file=><a key={file.path} href={`/api/persoonlijk/bijlage?${new URLSearchParams({path:file.path,name:file.name})}`} download><Icon name="link" size={14}/>{file.name}<small>{Math.max(1,Math.round(file.size/1024))} kB</small></a>)}</div>}
    {!hasTasks&&draft.source_created_at&&<p className={s.hint}>Oorspronkelijk gemaakt in Evernote op {new Intl.DateTimeFormat("nl-NL",{dateStyle:"long"}).format(new Date(draft.source_created_at))}.</p>}
    </div>
    {editing&&<footer className={s.editorFooter}><button disabled={saving} onClick={discard}>Wijzigingen verwerpen</button><button className={s.primary} disabled={saving||!dirty} onClick={()=>void save()}><Icon name="check" size={16}/>{saving?"Opslaan…":"Opslaan"}</button></footer>}
   </>:<div className={s.editorEmpty}><Icon name="book" size={35}/><h2>Ruimte voor jouw hoofd</h2><p>Kies een notitie of zet iets nieuws op je lijst.</p><button className={s.primary} onClick={add}><Icon name="plus" size={16}/>Nieuwe notitie</button></div>}</section>
  </div>

 </div>;
}
