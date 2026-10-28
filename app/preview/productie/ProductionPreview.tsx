"use client";

import Link from "next/link";
import Icon, { type IconName } from "../../productie/ProductionIcon";
import ProductionNavigation, { ProductionMobileNavigation } from "../../productie/ProductionNavigation";
import { productionView, type ProductionView } from "../../productie/navigation";
import { productionDayRhythm, plannedOperation } from "../../productie/dayRhythm";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  addDays, addItem, BOARDS, completedOutput, dateLabel, DEPARTMENTS,
  departmentsFor, durationLabel, KIND_LABELS, linkRecipe, moveTask, removePlannedTask, SOURCE_LABELS,
  STATUS_LABELS, taskIssues, transitionTask, weekLabel, weekNumber, requiredTaskIds,
  mondayOf, type BoardId, type DepartmentId, type Item, type ItemKind, type ItemUnit,
  type PreviewState, type Task, type TaskStatus,
} from "../../productie/planning";
import { DEMO_TODAY, DEMO_WEEK, demoIngredients, demoRecipes, initialPreviewState, PREVIEW_STORAGE_KEY } from "./sampleData";
import s from "./production.module.css";
import { validWorkspace, type LiveWorkspace } from "../../productie/workspaceData";
import { buildRecipePlan, preparationProposal, type PlanCommand, type PreparationChoice } from "../../productie/recipePlanning";
const WorkspaceContext = createContext({ demo:true, recipes:demoRecipes, canManage:true, saving:false });

type View = ProductionView;
type Modal = { type: "task"; date?: string; departmentId?: DepartmentId; itemId?: string; priorId?: string } | { type: "item" } | { type: "detail"; id: string } | { type: "item-detail"; id: string } | { type: "attention" } | { type: "reset" } | null;
const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: "planning", label: "Weekplanning", icon: "grid" },
  { id: "catalog", label: "Producten & onderdelen", icon: "box" },
  { id: "recipes", label: "Recepten", icon: "book" },
  { id: "ingredients", label: "Grondstoffen", icon: "leaf" },
  { id: "stock", label: "Productieregistraties", icon: "stock" },
];

function ModalFrame({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  const { demo } = useContext(WorkspaceContext);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={s.dialog} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label={title}>
    <header className={s.dialogHeader}><div><span className={s.eyebrow}>Strik Productie{demo ? " · preview" : ""}</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className={s.iconButton} onClick={onClose} aria-label="Sluiten"><Icon name="close" /></button></header>
    {children}
  </dialog>;
}

function DayRhythm({board,date}:{board:BoardId;date:string}) {
  const blocks=productionDayRhythm(board,date);
  if(!blocks.length)return null;
  return <div className={s.dayRhythm} role="group" aria-label={`Vast dagritme · ${dateLabel(date,true)}`}>{blocks.map(block=><div key={block.id} className={s[`rhythm_${block.id}`]} title={block.note}><small>{block.start}–{block.end}</small><b>{block.label}</b>{block.id==="start"&&<em>Bestellingen van vandaag</em>}</div>)}</div>;
}

function quantity(value: number) { return value.toLocaleString("nl-NL", { maximumFractionDigits: 3 }); }
function departmentName(id: DepartmentId) { return DEPARTMENTS.find(d => d.id === id)?.name || id; }
function newId(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

export default function ProductionPreview({live,onRefresh,initialView="planning",initialBoard}:{live?:LiveWorkspace;onRefresh?:()=>Promise<void>;initialView?:string;initialBoard?:BoardId}) {
  const demo = !live, canManage = !live || live.canManage;
  const today = live?.today || DEMO_TODAY;
  const recipeList = live?.recipes || demoRecipes;
  const ingredientList = live?.ingredients || demoIngredients;
  const [state, setState] = useState<PreviewState>(()=>live?.state || initialPreviewState());
  const revisionRef = useRef(live?.revision || 0);
  const savingRef = useRef(false);
  const [saving,setSaving] = useState(false);
  const [syncedAt,setSyncedAt] = useState(live?.updatedAt || "");
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>(()=>productionView(initialView));
  const [board, setBoard] = useState<BoardId>(()=>initialBoard && (!live || departmentsFor(initialBoard).some(d=>live.departments.includes(d.id))) ? initialBoard : live && !live.departments.includes("dessert") ? "ijs" : "patisserie");
  const [week, setWeek] = useState(()=>demo ? DEMO_WEEK : mondayOf(today));
  const [department, setDepartment] = useState<DepartmentId | "all">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState(today);
  const [wall, setWall] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [weekend, setWeekend] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [message, setMessage] = useState("");
  const [notificationError, setNotificationError] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [kindFilter, setKindFilter] = useState("all");
  const [dragged, setDragged] = useState<string | null>(null);

  useEffect(() => {
    if (!demo) return;
    // Fictitious demo data only; never reads or writes the live recipe API.
    try {
      const raw = localStorage.getItem(PREVIEW_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Use only states written by this preview build. Full domain validation
        // is performed before committing changes; corrupt storage is discarded.
        if (isPreviewState(saved)) setState(saved);
      }
    } catch { setStorageError(true); }
    setHydrated(true);
  }, [demo]);
  useEffect(() => {
    if (!demo || !hydrated) return;
    try { localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(state)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [state, hydrated, demo]);
  useEffect(()=>{
    if (live && !saving && !modal && live.revision>=revisionRef.current) {
      setState(live.state); revisionRef.current=live.revision; setSyncedAt(live.updatedAt);
    }
  },[live,saving,modal]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  const days = Array.from({ length: weekend ? 7 : 6 }, (_, i) => addDays(week, i));
  const boardDepartments = departmentsFor(board);
  const visibleDepartments = boardDepartments.filter(d => department === "all" || d.id === department);
  const weekTasks = state.tasks.filter(t => t.date >= week && t.date <= addDays(week, 6) && boardDepartments.some(d => d.id === t.departmentId));
  const end = addDays(week, 6);
  const filtered = state.tasks.filter(t => t.date >= week && t.date <= end && (weekend || t.date !== end) && visibleDepartments.some(d => d.id === t.departmentId))
    .filter(t => statusFilter === "all" || (statusFilter === "open" ? t.status !== "done" : statusFilter === "attention" ? taskIssues(t, state.tasks,state.items).length > 0 : t.status === statusFilter))
    .filter(t => !query || `${state.items.find(i => i.id === t.itemId)?.name} ${t.operation} ${t.note}`.toLocaleLowerCase("nl-NL").includes(query.toLocaleLowerCase("nl-NL")));
  const attention = weekTasks.filter(t => t.status !== "done" && taskIssues(t, state.tasks,state.items).length);
  const done = weekTasks.filter(t => t.status === "done").length;
  const output = useMemo(() => completedOutput(state.items, state.tasks), [state]);
  const catalog = state.items.filter(i => (department === "all" || i.departmentId === department) && (kindFilter === "all" || i.kind === kindFilter) && (!query || `${i.name} ${i.articleNumber || ""}`.toLocaleLowerCase("nl-NL").includes(query.toLocaleLowerCase("nl-NL"))));

  function notify(text: string, error = false) { setNotificationError(error); setMessage(text); }
  function navigate(next: View) { setView(next); setQuery(""); setDepartment("all"); setKindFilter("all"); }
  function chooseBoard(id: BoardId) { setBoard(id); setDepartment("all"); }
  function shiftWeek(direction: number) { const next = addDays(week, direction * 7); setWeek(next); setDay(next); }
  async function persist(next:PreviewState, success:string,command?:PlanCommand):Promise<string|undefined> {
    if (savingRef.current) return "Wacht tot de vorige wijziging is opgeslagen.";
    if (demo) { setState(next); notify(success); return; }
    savingRef.current=true; setSaving(true);
    try {
      const response=await fetch(command?"/api/productie/plan":"/api/productie",{method:command?"POST":"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(command?{revision:revisionRef.current,recipeRevision:live?.recipeRevision,command}:{revision:revisionRef.current,state:next})});
      const data=await response.json();
      if (!response.ok) throw Error(data.message || "Opslaan is mislukt; je wijziging is niet opgeslagen.");
      revisionRef.current=data.revision; setState(data.state); setSyncedAt(data.updatedAt); notify(success);
    } catch(e) { const error=(e as Error).message; notify(error,true); return error; }
    finally { savingRef.current=false; setSaving(false); }
  }
  async function changeStatus(id: string, status: TaskStatus) {
    try { return await persist({ ...state, tasks: transitionTask(state.tasks,id,status,state.items) },status==="done"?"Taak afgerond.":"Status opgeslagen."); }
    catch(e) { const error=(e as Error).message; notify(error,true); return error; }
  }
  async function move(id:string,date:string,departmentId:DepartmentId) {
    try { return await persist({...state,tasks:moveTask(state.tasks,id,date,departmentId)},`Taak verplaatst naar ${dateLabel(date,true)}.`); }
    catch(e) { const error=(e as Error).message; notify(error,true); return error; }
    finally { setDragged(null); }
  }
  async function remove(id:string) {
    try {
      const next={...state,tasks:removePlannedTask(state.tasks,id)};
      if (demo) next.removedTasks=[...(state.removedTasks || []),...state.tasks.filter(t=>!next.tasks.some(n=>n.id===t.id)).map(task=>({task,removedAt:new Date().toISOString(),removedBy:"preview"}))];
      const error=await persist(next,"Geplande taak verwijderd. Je kunt deze herstellen via Instellingen.");
      if (!error) setModal(null);
      return error;
    } catch(e) { return (e as Error).message; }
  }
  async function restore(id:string) {
    try {
      const tasks:Task[]=[],seen=new Set<string>();
      function collect(id:string) {
        if(state.tasks.some(t=>t.id===id)||seen.has(id))return;
        seen.add(id);const task=state.removedTasks?.find(r=>r.task.id===id)?.task;
        if(!task)throw Error("Een benodigde verwijderde taak ontbreekt. Controleer de oorspronkelijke planning.");
        for(const dependency of requiredTaskIds(task))collect(dependency);
        tasks.push(task);
      }
      collect(id);
      await persist({...state,tasks:[...state.tasks,...tasks],removedTasks:state.removedTasks?.filter(r=>!seen.has(r.task.id))},"Geplande taak en benodigde voorbereiding hersteld.");
    }catch(error){notify((error as Error).message,true);}
  }
  async function plan(command:PlanCommand) {
    try {
      const next=buildRecipePlan(state,recipeList,command),count=next.tasks.length-state.tasks.length;
      const error=await persist(next,count>1?`${count} taken met berekende halffabricaten ingepland.`:"Taak toegevoegd.",command);
      if(!error) {setModal(null);navigate("planning");const dep=DEPARTMENTS.find(d=>d.id===command.task.departmentId)!;chooseBoard(dep.board);setWeek(mondayOf(command.task.date));setDay(command.task.date);}
      return error;
    }catch(error){return(error as Error).message;}
  }
  const canBakery=!live || live.departments.some(department=>department!=="ijs" && department!=="chocolade");
  const availableBoards=BOARDS.filter(b=>!live || departmentsFor(b.id).some(d=>live.departments.includes(d.id)));
  const selectedTask=modal?.type==="detail" ? state.tasks.find(t=>t.id===modal.id) : undefined;
  const selectedTaskItem=selectedTask ? state.items.find(i=>i.id===selectedTask.itemId) : undefined;
  const selectedItem=modal?.type==="item-detail" ? state.items.find(i=>i.id===modal.id) : undefined;
  async function connectRecipe(id:string,recipeId:string) {
    try { return await persist(linkRecipe(state,id,recipeId,recipeList),"Recept gekoppeld; eerdere taken blijven behouden."); }
    catch(e) { return (e as Error).message; }
  }
  async function updateItem(id:string,changes:Partial<Item>) {
    return persist({...state,items:state.items.map(i=>i.id===id?{...i,...changes,departmentUnconfirmed:false}:i)},"Onderdeel bijgewerkt.");
  }
  const style = { "--days": days.length } as CSSProperties;

  function taskCard(task: Task) {
    const item = state.items.find(i => i.id === task.itemId)!;
    const issues = taskIssues(task, state.tasks,state.items);
    return <article key={task.id} className={`${s.taskCard} ${s[`task_${task.status}`]}`} draggable={canManage && !wall && task.status !== "done"} onDragStart={e => { e.dataTransfer.setData("text/plain", task.id); e.dataTransfer.effectAllowed = "move"; setDragged(task.id); }} onDragEnd={() => setDragged(null)}>
      {!wall && <button className={s.taskCheck} aria-label={`${task.status === "done" ? "Heropen" : "Afronden"}: ${item.name} · ${task.operation}`} aria-pressed={task.status === "done"} onClick={() => changeStatus(task.id, task.status === "done" ? "planned" : "done")}>{task.status === "done" ? <Icon name="check" size={12} /> : task.status === "active" ? <Icon name="play" size={12} /> : null}</button>}
      <button className={s.taskOpen} onClick={() => setModal({ type: "detail", id: task.id })} aria-label={`Open ${quantity(task.quantity)} ${item.unit} ${item.name} · ${task.operation}`}>
        <strong><b>{quantity(task.quantity)}{item.unit === "stuks" ? "×" : ` ${item.unit}`}</b> {item.name}</strong>
        <span>{task.operation}</span>
        <small><span className={s.statusDot} />{STATUS_LABELS[task.status]}{task.minutes !== undefined && <span className={s.effort}><Icon name="clock" size={11} />{durationLabel(task.minutes)}</span>}{issues.length > 0 && <span className={s.taskWarning} title={issues.join(" ")}><Icon name="warning" size={12} /><span className={s.srOnly}>Controlepunt</span></span>}{task.source === "order" && <span className={s.orderTag}>Order</span>}</small>
      </button>
    </article>;
  }

  return <WorkspaceContext.Provider value={{demo,recipes:recipeList,canManage,saving}}><div className={`${s.root} ${wall ? s.wall : ""} ${largeText ? s.largeText : ""}`} style={style} data-production-preview={demo || undefined} aria-busy={saving}>
    {!wall && <ProductionNavigation active={view} boards={availableBoards} canManage={canManage} canBakery={canBakery} demo={demo} activeBoard={board} onNavigate={navigate} onBoard={id=>{navigate("planning");chooseBoard(id);}} />}

    <main className={s.main}>
      <div className={s.previewBar}><span><i />{demo ? "Preview · voorbeeldgegevens" : "Strik Productie · gedeelde werkversie"}</span><span>{demo ? (storageError ? "Bewaren niet mogelijk · wijzigingen vervallen bij herladen" : "Wijzigingen blijven alleen in deze browser") : saving ? "Bezig met opslaan…" : `Opgeslagen in Supabase · bijgewerkt ${syncedAt ? new Intl.DateTimeFormat("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"}).format(new Date(syncedAt)) : ""}`}</span>{!wall && (demo ? <button onClick={() => setModal({ type: "reset" })}>Herstel voorbeeld</button> : <button disabled={saving} onClick={()=>void onRefresh?.()}>Verversen</button>)}</div>
      <header className={s.header}><div className={s.heading}><span className={s.eyebrow}>STRIK PRODUCTIE{wall ? " · SCHERMMODUS" : ""}</span><h1>{NAV.find(n => n.id === view)?.label || "Instellingen"}</h1></div>
        <div className={s.headerActions}>{view === "planning" && <><button className={s.secondaryButton} aria-pressed={wall} onClick={() => setWall(!wall)}><Icon name="screen" />{wall ? "Sluit schermmodus" : "XL-scherm"}</button>{canManage && <button className={s.primaryButton} onClick={() => setModal({ type: "task", date: day, departmentId: visibleDepartments[0]?.id })}><Icon name="plus" />Taak toevoegen</button>}</>}{view === "catalog" && canManage && <button className={s.primaryButton} onClick={() => setModal({ type: "item" })}><Icon name="plus" />Onderdeel toevoegen</button>}</div>
      </header>

      <ProductionMobileNavigation active={view} canManage={canManage} canBakery={canBakery} demo={demo} onNavigate={navigate} />

      {view === "planning" ? <>
        <section className={s.plannerToolbar} aria-label="Week en filters"><div className={s.weekPicker}><button aria-label="Vorige week" onClick={() => shiftWeek(-1)} className={s.previous}><Icon name="chevron" size={16} /></button><div><strong>Week {weekNumber(week)}</strong><span>{weekLabel(week)}</span></div><button aria-label="Volgende week" onClick={() => shiftWeek(1)}><Icon name="chevron" size={16} /></button><button className={s.thisWeek} onClick={() => { setWeek(demo ? DEMO_WEEK : mondayOf(today)); setDay(today); }}>{demo ? "Voorbeeldweek" : "Deze week"}</button></div>
          <div className={`${s.plannerFilters} ${showFilters ? s.filtersExpanded : ""}`}><label><span className={s.srOnly}>Planning</span><select value={board} onChange={e => chooseBoard(e.target.value as BoardId)}>{availableBoards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button className={s.mobileFilterToggle} aria-label="Toon of verberg filters" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><Icon name="settings" size={16} /></button><label className={s.extraFilter}><span className={s.srOnly}>Afdeling</span><select value={department} onChange={e => setDepartment(e.target.value as DepartmentId | "all")}><option value="all">Alle afdelingen</option>{boardDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>{!wall && <label className={s.extraFilter}><span className={s.srOnly}>Taakstatus</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Alle taken</option><option value="open">Nog te doen</option><option value="active">Bezig</option><option value="attention">Aandacht nodig</option><option value="done">Afgerond</option></select></label>}{wall && <button className={s.textSize} onClick={() => setLargeText(!largeText)} aria-pressed={largeText}>A<span>A</span> Tekstgrootte</button>}</div>
        </section>
        <div className={s.weekSummary}><div><span className={s.liveDot} />{BOARDS.find(b => b.id === board)?.name}<span className={s.summaryDivider} />{done} van {weekTasks.length} taken klaar<progress max={weekTasks.length || 1} value={done} aria-label="Voortgang voorbeeldweek" /></div><button onClick={() => setModal({ type: "attention" })} className={attention.length ? s.attentionButton : s.quietButton}><Icon name="warning" size={14} />{attention.length} aandachtspunt{attention.length === 1 ? "" : "en"}</button></div>
        <div className={s.mobileDays} role="group" aria-label="Kies dag">{days.map(d => <button key={d} data-today={d===today || undefined} aria-pressed={day === d} onClick={() => setDay(d)}>{dateLabel(d)}</button>)}</div>
        <div className={s.mobileRhythm}><DayRhythm board={board} date={day}/></div>
        <section className={s.board} aria-label="Weekbord">
          <div className={s.boardHeader}><div className={s.departmentColumn}>Afdeling</div>{days.map(d => <div key={d} className={`${s.dayHeading} ${d === today ? s.today : ""}`}><strong>{dateLabel(d)}</strong><span>{d === today ? (demo ? "Voorbeeld: vandaag" : "Vandaag") : `${weekTasks.filter(t => t.date === d).length} taken`}</span><DayRhythm board={board} date={d}/></div>)}</div>
          {visibleDepartments.map(dep => {
            const tasks = filtered.filter(t => t.departmentId === dep.id);
            const total = tasks.reduce((sum, t) => sum + (t.minutes || 0), 0);
            return <div className={`${s.departmentRow} ${s[`tone_${dep.tone}`]}`} key={dep.id}>
              <div className={s.departmentLabel}><span className={s.departmentMark} /><h2>{dep.name}</h2><span>{tasks.filter(t => t.status === "done").length}/{tasks.length} klaar</span><small><Icon name="clock" size={12} />{durationLabel(total)} gepland</small></div>
              {days.map(d => <div key={d} className={`${s.dayCell} ${d === day ? s.mobileSelectedDay : ""} ${d === today ? s.todayCell : ""} ${dragged ? s.dropTarget : ""}`} onDragOver={e => { if (canManage && !wall && dragged) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }} onDrop={e => { e.preventDefault(); if (dragged) move(dragged, d, dep.id); }} aria-label={`${dep.name} · ${dateLabel(d, true)}`}>
                {tasks.filter(t => t.date === d).map(taskCard)}
                {canManage && <button className={s.cellAdd} aria-label={`Taak toevoegen · ${dep.name} · ${dateLabel(d, true)}`} onClick={() => setModal({ type: "task", date: d, departmentId: dep.id })}><Icon name="plus" size={14} /><span>Toevoegen</span></button>}
                {wall && !canManage && !tasks.some(t => t.date === d) && <span className={s.emptyCell}>—</span>}
              </div>)}
            </div>;
          })}
        </section>
        <footer className={s.boardFooter}><span><i />Gepland <i className={s.activeLegend} />Bezig <i className={s.doneLegend} />Klaar <i className={s.blockedLegend} />Geblokkeerd</span><span>{wall ? (demo ? "Schermvoorbeeld · geen live verbinding" : "Gedeelde planning · verversing elke 15 seconden") : "Sleep om te verplaatsen · open een taak voor details"}</span>{!weekend && weekTasks.some(t => t.date === end) && <button onClick={() => setWeekend(true)}>Zondag heeft taken · toon zondag</button>}</footer>
      </> : view === "catalog" ? <>
        <div className={s.sectionIntro}><p>Alles wat je maakt, ook zonder uitgewerkt recept.</p><span>{state.items.filter(i=>i.kind==="product").length} eindproducten · {state.items.filter(i=>i.kind==="component").length} halffabricaten</span></div>
        <div className={s.listToolbar}><Search value={query} onChange={setQuery} placeholder="Zoek op naam of artikelnummer…" /><select aria-label="Type onderdeel" value={kindFilter} onChange={e => setKindFilter(e.target.value)}><option value="all">Alle typen</option><option value="product">Eindproducten</option><option value="component">Halffabricaten</option><option value="activity">Werkzaamheden</option></select><DepartmentSelect value={department} onChange={setDepartment} /></div>
        <div className={s.catalogList}><div className={s.listHeader}><span>Eindproduct / halffabricaat</span><span>Afdeling</span><span>Recept</span><span /></div>{catalog.map(item => <div className={s.catalogRow} key={item.id}><button className={s.itemName} onClick={() => setModal({ type: "item-detail", id: item.id })}><span className={`${s.itemGlyph} ${s[`tone_${DEPARTMENTS.find(d => d.id === item.departmentId)!.tone}`]}`}><Icon name={item.kind === "activity" ? "clock" : item.kind === "component" ? "box" : "book"} /></span><span><strong>{item.name}</strong><small><span className={`${s.typeBadge} ${item.kind==="component"?s.halfBadge:s.finalBadge}`}>{KIND_LABELS[item.kind]}</span> · {item.unit}{item.productionBlocked && " · Recept controleren"}{item.articleNumber && ` · ${item.articleNumber}`}</small></span></button><span className={s.catalogDepartment}>{item.departmentUnconfirmed ? "Afdeling controleren" : departmentName(item.departmentId)}</span><span className={item.recipeId ? s.recipeLinked : s.recipeMissing}>{item.recipeId ? <><Icon name="link" size={13} />Gekoppeld</> : "Vrij in te plannen"}</span><button disabled={!canManage || saving || item.productionBlocked} className={s.planButton} onClick={() => setModal({ type: "task", itemId: item.id, departmentId: item.departmentId, date: day })}><Icon name="plus" size={14} />Inplannen</button></div>)}{catalog.length === 0 && <Empty title="Geen onderdelen gevonden" text="Pas de zoekopdracht of filters aan." />}</div>
      </> : view === "recipes" ? <>
        <div className={s.sectionIntro}><p>Recepten en halffabricaten, samen met de onderdelen waarop ze worden gebruikt.</p><span>{recipeList.length} {demo ? "voorbeeldrecepten" : "recepten"}</span>{!demo && canManage && <Link className={s.secondaryButton} href="/bakkerij/productie/beheer/recepten">Recepten beheren</Link>}</div>
        {demo && <div className={s.infoNote}><Icon name="book" /><p>Deze recepten zijn fictieve voorbeelden. Jullie bestaande WordPress-recepten worden pas na een gecontroleerde overdracht aangesloten.</p></div>}
        <div className={s.listToolbar}><Search value={query} onChange={setQuery} placeholder={demo ? "Zoek een voorbeeldrecept…" : "Zoek een recept…"} /><select aria-label="Type recept" value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="all">Alle recepten</option><option value="product">Eindproducten</option><option value="component">Halffabricaten</option></select></div>
        <div className={s.recipeGrid}>{recipeList.filter(r => r.name.toLocaleLowerCase("nl-NL").includes(query.toLocaleLowerCase("nl-NL")) && (kindFilter==="all" || (r.type==="semiFinished"?"component":"product")===kindFilter)).map(r => { const linked = state.items.filter(i => i.recipeId === r.id); return <article key={r.id} className={s.recipeCard}><div className={s.recipeCardIcon}><Icon name="book" size={23} /><span className={`${s.typeBadge} ${r.type==="semiFinished"?s.halfBadge:s.finalBadge}`}>{r.type==="semiFinished"?"HALFFABRICAAT":"EINDPRODUCT"}{demo?" · VOORBEELD":""}</span></div><h2>{r.name}</h2><p>{r.yield > 0 ? `Basisrecept voor ${quantity(r.yield)} ${r.unit}` : "Basisopbrengst nog invullen"}</p><div className={s.recipeMeta}><span>{r.ingredients.length} ingrediënten</span><span>{r.steps.length} stappen</span></div><footer>{linked.length ? <button onClick={() => setModal({ type: "item-detail", id: linked[0].id })}>Bekijk recept & onderdeel<Icon name="arrow" size={16} /></button> : <span>Koppelbaar via Producten & onderdelen</span>}</footer></article>; })}</div>
      </> : view === "ingredients" ? <>
        <div className={s.sectionIntro}><p>Gedeelde grondstoffen en leveranciersspecificaties voor alle afdelingen.</p><span>SpecsPlaza</span></div>
        <div className={s.infoNote}><Icon name="link" /><p>{demo ? "Voorbeeld van de bestaande SpecsPlaza-koppeling." : "Specificaties worden gedeeld met het grondstoffenbeheer."} {canManage && <Link href="/bakkerij/productie/beheer/ingredienten">Open grondstoffenbeheer</Link>}</p></div>
        <div className={s.ingredientList}>{ingredientList.map(i => <article key={i.id}><div className={s.itemGlyph}><Icon name="leaf" /></div><div><h2>{i.name}</h2><p>{i.supplier} · {i.unit}</p></div><div className={s.ingredientSpec}><span className={i.linked ? s.recipeLinked : s.recipeMissing}>{i.linked && <Icon name="link" size={13} />}{i.specification}</span><small>{demo ? "Voorbeeld allergenen" : "Allergenen"}: {i.allergens}</small></div></article>)}</div>
      </> : view === "stock" ? <>
        <div className={s.sectionIntro}><p>{demo ? "Voorbeeldvoorraad plus afgeronde productie." : "Hier staan je productieregistraties. Een actuele voorraad is nog niet aangesloten."} Werkelijke voorraad vraagt ook registratie van verbruik en uitgifte.</p></div>
        <div className={s.listToolbar}><Search value={query} onChange={setQuery} placeholder="Zoek een product of onderdeel…" /><DepartmentSelect value={department} onChange={setDepartment} /></div>
        <div className={s.stockTable}><div className={s.stockHeader}><span>Product / onderdeel</span><span>Startvoorraad</span><span>Geproduceerd</span><span>{demo ? "Voorbeeldtotaal" : "Voorraad"}</span></div>{catalog.filter(i => i.kind !== "activity").map(i => <div className={s.stockRow} key={i.id}><button onClick={() => setModal({ type: "item-detail", id: i.id })}><strong>{i.name}</strong><small>{departmentName(i.departmentId)} · {i.unit}</small></button><span>{!demo && !i.stockKnown ? "Onbekend" : quantity(i.stock)}</span><span className={s.recipeLinked}>+{quantity(output.get(i.id) || 0)}</span><strong>{!demo && !i.stockKnown ? "Onbekend" : quantity(i.stock + (output.get(i.id) || 0))} <small>{i.unit}</small></strong></div>)}</div>
      </> : <>
        <div className={s.settingsGrid}><section className={s.settingCard}><Icon name="screen" size={24} /><h2>Jouw weekbord</h2><p>Pas het bord aan voor de werkplek of het grote scherm.</p><label className={s.checkboxRow}><input type="checkbox" checked={weekend} onChange={e => setWeekend(e.target.checked)} /><span>Zondag ook tonen</span></label><label className={s.checkboxRow}><input type="checkbox" checked={largeText} onChange={e => setLargeText(e.target.checked)} /><span>Grotere tekst in het weekbord</span></label><button className={s.secondaryButton} onClick={() => { navigate("planning"); setWall(true); }}><Icon name="screen" />Open XL-schermstand</button></section><section className={s.settingCard}><Icon name="box" size={24} /><h2>{demo ? "Van preview naar productie" : "Werkversie in gebruik"}</h2><p>{demo ? "Deze versie gebruikt uitsluitend voorbeeldgegevens en bewaart je aanpassingen lokaal." : "Je planning en onderdelen worden gedeeld opgeslagen. Bestellingen, verbruik en verkoopprognoses worden in volgende stappen aangesloten."}</p><ol><li>Weekbord en werkwijze samen beoordelen.</li><li>Recepten, grondstoffen en koppelingen controleren en overzetten.</li><li>Met één afdeling testen en daarna uitbreiden.</li><li>Bestellingen, voorraad en verkoopgegevens aansluiten.</li></ol>{demo ? <button className={s.textLink} onClick={() => setModal({ type: "reset" })}>Voorbeeldgegevens herstellen</button> : canManage && <Link className={s.textLink} href="/bakkerij/productie/beheer/recepten">Receptuurgegevens beheren</Link>}</section></div>
        {canManage && !!state.removedTasks?.length && <section className={s.settingCard}><h2>Verwijderde taken</h2><p>Geplande taken blijven herstelbaar. Recepten en onderdelen zijn behouden.</p><div className={s.removedTaskList}>{[...state.removedTasks].reverse().map(({task})=><div key={task.id}><span><strong>{state.items.find(i=>i.id===task.itemId)?.name}</strong><small>{dateLabel(task.date,true)} · {task.operation}</small></span><button disabled={saving} className={s.secondaryButton} onClick={()=>void restore(task.id)}>Herstellen</button></div>)}</div></section>}
      </>}
    </main>
    {message && <div className={`${s.toast} ${notificationError ? s.errorToast : ""}`} role="status"><Icon name={notificationError ? "warning" : "check"} /><span>{message}</span><button onClick={() => setMessage("")} aria-label="Melding sluiten"><Icon name="close" size={16} /></button></div>}
    {modal?.type === "task" && <TaskForm state={state} initial={modal} today={today} onClose={() => setModal(null)} onPlan={plan} />}
    {modal?.type === "item" && <ItemForm state={state} onClose={() => setModal(null)} onSave={async next => { const error=await persist(next,"Onderdeel toegevoegd. Je kunt het direct inplannen."); if (!error) setModal(null); return error; }} />}
    {selectedTask && selectedTaskItem && <TaskDetail key={selectedTask.id} task={selectedTask} item={selectedTaskItem} state={state} wall={wall} onClose={() => setModal(null)} onStatus={status => changeStatus(selectedTask.id, status)} onMove={move} onRemove={()=>remove(selectedTask.id)} onOpenTask={id=>setModal({type:"detail",id})} onNext={() => setModal({ type: "task", date: selectedTask.date, departmentId: selectedTask.departmentId, itemId: selectedTask.itemId, priorId: selectedTask.id })} />}
    {selectedItem && <ItemDetail key={selectedItem.id} item={selectedItem} state={state} onClose={()=>setModal(null)} onPlan={()=>setModal({type:"task",itemId:selectedItem.id,departmentId:selectedItem.departmentId,date:day})} onLink={recipeId=>connectRecipe(selectedItem.id,recipeId)} onUpdate={changes=>updateItem(selectedItem.id,changes)}/>}
    {modal?.type === "attention" && <ModalFrame title="Aandacht deze week" subtitle={`${BOARDS.find(b => b.id === board)?.name} · week ${weekNumber(week)}`} onClose={() => setModal(null)}><div className={s.dialogBody}>{attention.length ? attention.map(t => <button className={s.attentionRow} key={t.id} onClick={() => setModal({ type: "detail", id: t.id })}><Icon name="warning" /><span><strong>{state.items.find(i => i.id === t.itemId)?.name}</strong><small>{dateLabel(t.date, true)} · {taskIssues(t, state.tasks,state.items).join(" ")}</small></span><Icon name="chevron" size={16} /></button>) : <Empty title="Geen aandachtspunten" text="Alle taken in deze voorbeeldweek kunnen volgens de huidige planning doorlopen." />}</div></ModalFrame>}
    {modal?.type === "reset" && <ModalFrame title="Voorbeeld herstellen?" onClose={() => setModal(null)}><div className={s.dialogBody}><p>Je lokale wijzigingen aan dit productievoorbeeld worden vervangen door de oorspronkelijke voorbeeldweek. Live gegevens worden niet geraakt.</p></div><footer className={s.dialogFooter}><button className={s.secondaryButton} onClick={() => setModal(null)}>Annuleren</button><button className={s.primaryButton} onClick={() => { setState(initialPreviewState()); setModal(null); setWeek(DEMO_WEEK); setDay(DEMO_TODAY); notify("Oorspronkelijke voorbeeldweek hersteld."); }}>Herstel voorbeeld</button></footer></ModalFrame>}
  </div></WorkspaceContext.Provider>;
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) { return <label className={s.search}><Icon name="search" /><span className={s.srOnly}>{placeholder}</span><input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>; }
function DepartmentSelect({ value, onChange }: { value: string; onChange: (v: DepartmentId | "all") => void }) { return <select aria-label="Afdeling" value={value} onChange={e => onChange(e.target.value as DepartmentId | "all")}><option value="all">Alle afdelingen</option>{DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className={s.empty}><Icon name="box" size={28} /><h2>{title}</h2><p>{text}</p></div>; }

function TaskForm({ state, initial, today, onClose, onPlan }: { state: PreviewState; initial: NonNullable<Extract<Modal, { type: "task" }>>; today:string; onClose: () => void; onPlan:(command:PlanCommand)=>Promise<string|undefined> }) {
  const {recipes:recipeList,saving}=useContext(WorkspaceContext);
  const [error,setError]=useState("");
  const [itemId,setItemId]=useState(initial.itemId || "");
  const [filter,setFilter]=useState("all");
  const [amount,setAmount]=useState(String(state.tasks.find(t=>t.id===initial.priorId)?.quantity || 1));
  const [amountMode,setAmountMode]=useState<"quantity"|"batches">("quantity");
  const [date,setDate]=useState(initial.date || today);
  const [departmentId,setDepartmentId]=useState<DepartmentId>(initial.departmentId || "dessert");
  const [includePreparation,setIncludePreparation]=useState(()=>{
    const selected=state.items.find(i=>i.id===initial.itemId),recipe=recipeList.find(r=>r.id===selected?.recipeId);
    return !initial.priorId && !!recipe?.semiFinishedItems?.length && recipe.yield>0;
  });
  const [customOperation,setCustomOperation]=useState<string|null>(null);
  const [daysBefore,setDaysBefore]=useState(1);
  const [choices,setChoices]=useState<Record<string,PreparationChoice>>({});
  const item=state.items.find(i=>i.id===itemId),recipe=recipeList.find(r=>r.id===item?.recipeId);
  const prior=state.tasks.find(t=>t.id===initial.priorId);
  const hasPreparation=!!recipe?.semiFinishedItems?.length && !prior;
  const operation=customOperation ?? plannedOperation(item?.kind,hasPreparation,!!prior);
  const preview:PlanCommand={task:{id:"preview-plan",itemId,departmentId,date,operation,status:"planned",note:"",source:"manual",batchId:"preview-batch",recordsOutput:item?.kind!=="activity",...(prior?{dependsOn:prior.id}:{})},amount:Number(amount),amountMode,
    ...(includePreparation && hasPreparation?{preparation:{daysBefore,choices}}:{})};
  const proposal=preparationProposal(state,recipeList,preview);
  const existingOutput=prior && state.tasks.some(t=>t.batchId===prior.batchId && t.recordsOutput);
  const updateChoice=(id:string,change:PreparationChoice)=>setChoices(current=>({...current,[id]:{...current[id],...change}}));
  function chooseItem(id:string) {
    setItemId(id);setAmount("1");setAmountMode("quantity");setCustomOperation(null);setChoices({});setError("");
    const selected=state.items.find(i=>i.id===id),recipe=recipeList.find(r=>r.id===selected?.recipeId);if(selected)setDepartmentId(selected.departmentId);
    setIncludePreparation(!initial.priorId && !!recipe?.semiFinishedItems?.length && !!recipe && recipe.yield>0);
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(proposal.errors.length){setError(proposal.errors[0]);return;}
    const data=new FormData(event.currentTarget),id=newId("task");
    const command:PlanCommand={...preview,task:{id,itemId,departmentId,date,operation:String(data.get("operation")),status:"planned",note:String(data.get("note")),source:data.get("source") as Task["source"],batchId:prior?.batchId || `batch-${id}`,recordsOutput:item?.kind!=="activity" && data.get("output")==="on",
      ...(String(data.get("minutes"))?{minutes:Number(data.get("minutes"))}:{}),...(String(data.get("dueDate"))?{dueDate:String(data.get("dueDate"))}:{}),...(prior?{dependsOn:prior.id}:{})}};
    setError(await onPlan(command) || "");
  }
  return <ModalFrame title={prior?"Volgende productiestap":"Taak toevoegen"} subtitle={prior?`Aansluitend op: ${prior.operation} · ${dateLabel(prior.date,true)}`:"Kies een product, aantal en gewenste productiedatum."} onClose={onClose}>
    <form onSubmit={submit}><div className={s.dialogBody}>
      {!prior && <label className={s.field}>Toon in keuzelijst<select value={filter} onChange={e=>{setFilter(e.target.value);if(e.target.value!=="all" && item?.kind!==e.target.value)chooseItem("");}}><option value="all">Eindproducten, halffabricaten & werkzaamheden</option><option value="product">Alleen eindproducten</option><option value="component">Alleen halffabricaten</option><option value="activity">Alleen werkzaamheden</option></select></label>}
      <label className={s.field}>Product of halffabricaat<select required value={itemId} onChange={e=>chooseItem(e.target.value)} disabled={!!prior}><option value="">Kies een product of halffabricaat…</option>{(["product","component","activity"] as ItemKind[]).filter(kind=>filter==="all" || filter===kind || !!prior).map(kind=><optgroup key={kind} label={kind==="product"?"Eindproducten":kind==="component"?"Halffabricaten":"Werkzaamheden"}>{state.items.filter(i=>i.kind===kind).map(i=><option key={i.id} disabled={i.productionBlocked} value={i.id}>{i.name}{i.productionBlocked?" · Recept controleren":""}</option>)}</optgroup>)}</select></label>
      {recipe && <div className={s.amountChoice}><label className={s.field}>Invoer<select value={amountMode} onChange={e=>{setAmountMode(e.target.value as "quantity"|"batches");setAmount("1");}}><option value="quantity">Aantal {item?.unit}</option><option value="batches" disabled={!(recipe.yield>0)}>Aantal basisrecepten</option></select></label>{recipe.yield>0 && <button type="button" className={s.textLink} onClick={()=>{setAmountMode("batches");setAmount("1");}}>1 basisrecept = {quantity(recipe.yield)} {recipe.unit}</button>}</div>}
      <div className={s.formGrid}><label className={s.field}>{amountMode==="batches"?"Aantal basisrecepten":`Aantal (${item?.unit || "eenheid"})`}<input type="number" min="0.000001" max="1000000" step="any" required value={amount} onChange={e=>setAmount(e.target.value)} /></label><label className={s.field}>Afdeling<select value={departmentId} onChange={e=>setDepartmentId(e.target.value as DepartmentId)}>{DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className={s.field}>Productiedatum<input type="date" required value={date} min={prior?.date} onChange={e=>setDate(e.target.value)} /></label><label className={s.field}>Benodigd op (optioneel)<input name="dueDate" type="date" defaultValue={prior?.dueDate} /></label></div>
      {item && proposal.quantity>0 && !proposal.errors.length && <p className={s.calculatedAmount}><strong>{quantity(proposal.quantity)} {item.unit}</strong>{proposal.recipeCount!==undefined && ` · ${proposal.recipeCount.toLocaleString("nl-NL",{maximumFractionDigits:3})} × basisrecept`}</p>}
      {recipe && !(recipe.yield>0) && <p className={s.fieldHint}>Basisopbrengst ontbreekt. Aantallen kunnen handmatig worden gepland; automatisch doorrekenen kan na aanvullen van het recept.</p>}
      {!recipe && item && <p className={s.fieldHint}>Een recept is niet nodig om dit onderdeel handmatig in te plannen.</p>}
      {item?.kind==="component" && <p className={s.fieldHint}>Je plant dit halffabricaat los. Kies vandaag of een andere datum; vers afmaken op dezelfde ochtend blijft mogelijk.</p>}
      {item?.kind==="product" && hasPreparation && <p className={s.fieldHint}>Laatste stap op de gekozen productiedatum: <strong>{operation}</strong>.</p>}
      {hasPreparation && <section className={s.preparationSection}>
        <label className={s.checkboxRow}><input type="checkbox" checked={includePreparation} disabled={!(recipe!.yield>0)} onChange={e=>setIncludePreparation(e.target.checked)} /><span>Halffabricaten meeplannen<small>Automatisch berekend uit het recept. Zet uit als de onderdelen al klaarstaan, of pas de planning hieronder aan.</small></span></label>
        {includePreparation && <><label className={s.field}>Standaard dagen vooraf<input type="number" min="0" max="30" step="1" value={daysBefore} onChange={e=>setDaysBefore(Number(e.target.value))} /></label><p className={s.fieldHint}>De laatste stap van het eindproduct is decoreren / afmaken. Een genest halffabricaat komt nog een stap eerder. Je kunt iedere datum aanpassen. Uitgevinkt betekent al beschikbaar; voorraad wordt hier niet gecontroleerd.</p>
          <div className={s.preparationList}>{proposal.rows.map(row=><div className={`${s.preparationRow} ${!row.included?s.preparationExcluded:""}`} key={row.recipeId}>
            <label className={s.preparationName}><input type="checkbox" aria-label={`Meemaken: ${row.name}`} checked={row.included} onChange={e=>updateChoice(row.recipeId,{include:e.target.checked})}/><span><strong>{row.name}</strong><small>{quantity(row.quantity)} {row.unit}{row.recipeCount>0?` · ${row.recipeCount.toLocaleString("nl-NL",{maximumFractionDigits:3})} × recept`:""}</small>{!row.included && <small>Al beschikbaar · geen nieuwe taak</small>}{row.departmentUnconfirmed && row.included && <small>Afdeling controleren</small>}</span></label>
            <label className={s.field}>Datum<input type="date" aria-label={`Productiedatum ${row.name}`} disabled={!row.included} value={row.date} onChange={e=>updateChoice(row.recipeId,{date:e.target.value})}/></label>
            <label className={s.field}>Afdeling<select aria-label={`Afdeling ${row.name}`} disabled={!row.included} value={row.departmentId} onChange={e=>updateChoice(row.recipeId,{departmentId:e.target.value as DepartmentId})}>{DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          </div>)}</div>
          {proposal.rows.some(row=>row.included && row.date<today) && <p className={s.planWarning}>Er staat voorbereiding vóór vandaag. Controleer of je deze datums wilt aanpassen.</p>}
          {!proposal.errors.length && <p className={s.fieldHint}>Na opslaan worden {proposal.rows.filter(r=>r.included).length} voorbereidingstaken en 1 productietaak samen ingepland. De productietaak wacht op de meegeplande halffabricaten.</p>}
        </>}
      </section>}
      <details className={s.planDetails}><summary>Werkzaamheid en aanvullende afspraken</summary><div className={s.formGrid}><label className={s.field}>Werkzaamheid<input name="operation" maxLength={100} required value={operation} onChange={e=>setCustomOperation(e.target.value)}/></label><label className={s.field}>Werktijd in minuten (optioneel)<input name="minutes" type="number" min="0" max="1440"/></label></div><label className={s.field}>Herkomst<select name="source" defaultValue={prior?.source || "manual"}>{Object.entries(SOURCE_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label className={s.field}>Korte opmerking<textarea name="note" rows={2} maxLength={1000} defaultValue=""/></label></details>
      {item && item.kind!=="activity" && <label className={s.checkboxRow}><input name="output" type="checkbox" defaultChecked={!existingOutput} disabled={!!existingOutput}/><span>Deze stap registreert de geproduceerde hoeveelheid<small>{existingOutput?"Een andere stap van deze batch registreert de hoeveelheid al.":"Registreert het eindproduct of halffabricaat wanneer deze taak klaar is."}</small></span></label>}
      {(error || (!!item && proposal.errors.length>0)) && <p className={s.formError} role="alert">{error || proposal.errors[0]}</p>}
    </div><footer className={s.dialogFooter}><button type="button" className={s.secondaryButton} onClick={onClose}>Annuleren</button><button type="submit" className={s.primaryButton} disabled={saving || !item || proposal.errors.length>0}>{saving?"Inplannen…":includePreparation?"Productie met halffabricaten inplannen":"Inplannen"}</button></footer></form>
  </ModalFrame>;
}

function ItemForm({ state, onClose, onSave }: { state: PreviewState; onClose: () => void; onSave: (s: PreviewState) => Promise<string | undefined> }) {
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    try { const error=await onSave(addItem(state, { id: newId("item"), name: String(data.get("name")), kind: data.get("kind") as ItemKind, departmentId: data.get("department") as DepartmentId, unit: data.get("unit") as ItemUnit, note: String(data.get("note")), stock: 0, stockKnown:false })); if(error) setError(error); }
    catch (e) { setError((e as Error).message); }
  }
  return <ModalFrame title="Onderdeel toevoegen" subtitle="Eén keer toevoegen, daarna altijd terug te vinden." onClose={onClose}><form onSubmit={submit}><div className={s.dialogBody}><label className={s.field}>Naam<input name="name" required maxLength={120} placeholder="Bijvoorbeeld: soezenbodems" /></label><div className={s.formGrid}><label className={s.field}>Type<select name="kind" defaultValue="component"><option value="component">Onderdeel / halffabricaat</option><option value="product">Verkoopproduct</option><option value="activity">Werkzaamheid</option></select></label><label className={s.field}>Eenheid<select name="unit" defaultValue="stuks">{["stuks", "gram", "kg", "ml", "liter", "platen", "taak"].map(u => <option key={u} value={u}>{u}</option>)}</select></label></div><label className={s.field}>Standaardafdeling<select name="department">{DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className={s.field}>Werkinstructie of opmerking<textarea name="note" rows={3} maxLength={1000} /></label><div className={s.infoNote}><Icon name="book" /><p>Een recept is niet nodig om te beginnen. Je kunt later een passend recept koppelen.</p></div>{error && <p className={s.formError} role="alert">{error}</p>}</div><footer className={s.dialogFooter}><button type="button" className={s.secondaryButton} onClick={onClose}>Annuleren</button><button type="submit" className={s.primaryButton}>Onderdeel toevoegen</button></footer></form></ModalFrame>;
}

function TaskDetail({ task, item, state, wall, onClose, onStatus, onMove, onNext, onRemove, onOpenTask }: { task: Task; item: Item; state: PreviewState; wall: boolean; onClose: () => void; onStatus: (s: TaskStatus) => Promise<string | undefined>; onMove: (id: string, date: string, departmentId: DepartmentId) => Promise<string | undefined>; onNext: () => void; onRemove:()=>Promise<string|undefined>; onOpenTask:(id:string)=>void }) {
  const [error, setError] = useState("");
  const {recipes:recipeList,demo,canManage,saving}=useContext(WorkspaceContext);
  const recipe = recipeList.find(r => r.id === item.recipeId);
  const issues = taskIssues(task, state.tasks,state.items);
  return <ModalFrame title={`${quantity(task.quantity)} ${item.unit} ${item.name}`} subtitle={`${dateLabel(task.date, true)} · ${departmentName(task.departmentId)}`} onClose={onClose}><div className={s.dialogBody}>
    <div className={s.taskDetailSummary}><div><small>Werkzaamheid</small><strong>{task.operation}</strong></div><span className={`${s.statusPill} ${s[`task_${task.status}`]}`}>{STATUS_LABELS[task.status]}</span></div>
    <div className={s.detailFacts}><span><Icon name="clock" size={16} />{task.minutes === undefined ? "Werktijd nog onbekend" : `${durationLabel(task.minutes)} werktijd`}</span><span><Icon name="box" size={16} />{SOURCE_LABELS[task.source]}</span>{task.dueDate && <span>Benodigd: {dateLabel(task.dueDate, true)}</span>}</div>
    {task.note && <div className={s.detailNote}>{task.note}</div>}
    {issues.length > 0 && <div className={s.issueBox}><Icon name="warning" /><ul>{issues.map(i => <li key={i}>{i}</li>)}</ul></div>}
    {(task.dependsOn || state.tasks.some(t => t.dependsOn === task.id)) && <div className={s.stepsChain}><h3>Productiestappen van deze batch</h3>{state.tasks.filter(t => t.batchId === task.batchId).sort((a, b) => a.date.localeCompare(b.date)).map(t => <div key={t.id} className={t.id === task.id ? s.currentStep : ""}><span className={`${s.chainDot} ${s[`task_${t.status}`]}`}>{t.status === "done" ? <Icon name="check" size={12} /> : ""}</span><span><strong>{t.operation}</strong><small>{dateLabel(t.date, true)} · {departmentName(t.departmentId)}</small></span><small>{STATUS_LABELS[t.status]}</small></div>)}</div>}
    {!!task.requires?.length && <div className={s.stepsChain}><h3>Benodigde halffabricaten</h3>{task.requires.map(id=>{const preparation=state.tasks.find(t=>t.id===id);if(!preparation)return null;const product=state.items.find(i=>i.id===preparation.itemId);return <button key={id} className={s.preparationLink} onClick={()=>onOpenTask(id)}><span><strong>{product?.name}</strong><small>{quantity(preparation.quantity)} {product?.unit} · {dateLabel(preparation.date,true)}</small></span><span>{STATUS_LABELS[preparation.status]}</span></button>;})}</div>}
    <RecipeContent recipeId={recipe?.id} amount={task.quantity} note={item.note} />
    <p className={s.fieldHint}>{task.recordsOutput ? `Afronden voegt ${quantity(task.quantity)} ${item.unit} toe aan de ${demo ? "voorbeeldproductie" : "productieregistratie"}.` : "Deze stap registreert geen nieuwe voorraad. Zo tellen opeenvolgende stappen niet dubbel."}</p>
    {!wall && <><div className={s.statusActions}>{(["planned", "active", "done", "blocked"] as TaskStatus[]).map(status => <button key={status} aria-pressed={task.status === status} disabled={saving} onClick={async () => setError(await onStatus(status) || "")} className={s.secondaryButton}>{status === "done" && <Icon name="check" size={15} />}{STATUS_LABELS[status]}</button>)}</div>{error && <p className={s.formError} role="alert">{error}</p>}{canManage && <details className={s.moveDetails}><summary><Icon name="move" size={15} />Verplaatsen of volgende stap toevoegen</summary><form onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); setError(await onMove(task.id, String(data.get("date")), data.get("department") as DepartmentId) || ""); }}><label className={s.field}>Datum<input name="date" type="date" defaultValue={task.date} required /></label><label className={s.field}>Afdeling<select name="department" defaultValue={task.departmentId}>{DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><button className={s.secondaryButton} type="submit">Verplaatsen</button></form><button className={s.textLink} onClick={onNext}><Icon name="plus" size={15} />Volgende stap in deze batch</button></details>}</>}
    {!wall && canManage && task.status === "planned" && <div className={s.deleteTask}><button disabled={saving || state.tasks.some(t=>requiredTaskIds(t).includes(task.id))} className={s.deleteButton} onClick={async()=>setError(await onRemove() || "")}>Geplande taak verwijderen</button><p className={s.fieldHint}>{state.tasks.some(t=>requiredTaskIds(t).includes(task.id)) ? "Verwijder eerst de gekoppelde vervolgstap." : "De taak en ongebruikte, nog geplande voorbereiding verdwijnen van het bord en blijven herstelbaar via Instellingen."}</p></div>}
  </div><footer className={s.dialogFooter}><button className={s.primaryButton} onClick={onClose}>Terug naar het bord</button></footer></ModalFrame>;
}

function ItemDetail({ item, state, onClose, onPlan, onLink, onUpdate }: { item: Item; state: PreviewState; onClose: () => void; onPlan: () => void; onLink: (id: string) => Promise<string|undefined>; onUpdate:(changes:Partial<Item>)=>Promise<string|undefined> }) {
  const {recipes:recipeList,canManage,saving}=useContext(WorkspaceContext);
  const [error,setError]=useState("");
  const [recipeId, setRecipeId] = useState(item.recipeId || "");
  const compatible = recipeList.filter(r => r.unit === item.unit);
  return <ModalFrame title={item.name} subtitle={`${KIND_LABELS[item.kind]} · ${departmentName(item.departmentId)} · ${item.unit}`} onClose={onClose}><div className={s.dialogBody}><RecipeContent recipeId={item.recipeId} amount={recipeList.find(r => r.id === item.recipeId)?.yield || 1} note={item.note} />{canManage && !item.recipeId && item.kind !== "activity" && <form className={s.recipeLinkForm} onSubmit={async e => { e.preventDefault(); setError(await onLink(recipeId)||""); }}><label className={s.field}>Later een recept koppelen<select required value={recipeId} onChange={e => setRecipeId(e.target.value)}><option value="">Kies een passend recept…</option>{compatible.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button className={s.secondaryButton} disabled={!recipeId} type="submit"><Icon name="link" size={15} />Koppelen</button><p className={s.fieldHint}>Je koppelt op onderdeel-ID. De bestaande planning en historie blijven behouden.</p></form>}{canManage && <form className={s.recipeLinkForm} onSubmit={async e=>{e.preventDefault();const d=new FormData(e.currentTarget);setError(await onUpdate({departmentId:d.get("department") as DepartmentId,note:String(d.get("note"))})||"");}}><label className={s.field}>Standaardafdeling<select name="department" defaultValue={item.departmentId}>{DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className={s.field}>Opmerking<textarea name="note" rows={3} defaultValue={item.note}/></label><button disabled={saving} className={s.secondaryButton}>Wijzigingen opslaan</button></form>}{error && <p className={s.formError} role="alert">{error}</p>}<div className={s.detailFacts}>{state.tasks.filter(t => t.itemId === item.id).length} ingeplande taken</div></div><footer className={s.dialogFooter}><button className={s.secondaryButton} onClick={onClose}>Sluiten</button><button disabled={!canManage || saving || item.productionBlocked} className={s.primaryButton} onClick={onPlan}><Icon name="plus" size={16} />Inplannen</button></footer></ModalFrame>;
}

function RecipeContent({ recipeId, amount, note }: { recipeId?: string; amount: number; note: string }) {
  const {recipes:recipeList,demo}=useContext(WorkspaceContext);
  const recipe = recipeList.find(r => r.id === recipeId);
  return <section className={s.recipeContent}><h3><Icon name="book" size={17} />{recipe ? recipe.name : "Werkinstructie"}</h3>{note && <p>{note}</p>}{recipe ? <>{recipe.reviewRequired && <p className={s.formError}>Dit bronrecept bevat ontbrekende grondstoffen of onderdelen. De oorspronkelijke verwijzingen zijn bewaard; controleer ze vóór productie.</p>}{demo && <span className={s.exampleLabel}>VOORBEELDRECEPT · GEEN PRODUCTIE-INSTRUCTIE</span>}<div className={s.ingredientAmounts}>{recipe.ingredients.map((i,index) => <div key={`${i.name}-${index}`}><span>{i.name}</span><strong>{(i.quantity > 0 ? quantity(recipe.yield > 0 ? i.quantity * amount / recipe.yield : i.quantity) : "Nog invullen")} {i.unit}</strong></div>)}</div><small className={s.fieldHint}>{recipe.yield > 0 ? `Geschaald naar ${quantity(amount)} ${recipe.unit} · basis ${recipe.yield} ${recipe.unit}` : "Basisopbrengst ontbreekt; bronhoeveelheden worden ongeschaald getoond."}</small><ol>{recipe.steps.map(step => <li key={step}>{step}</li>)}</ol><p className={s.allergenNote}>{demo ? "Voorbeeld allergenen" : "Opgegeven allergenen"}: {recipe.allergens.join(", ") || "Nog controleren"}.</p></> : <p className={s.fieldHint}>Nog geen recept gekoppeld. Dit onderdeel blijft gewoon selecteerbaar en in te plannen.</p>}</section>;
}

function isPreviewState(value: unknown): value is PreviewState {
  return validWorkspace(value,demoRecipes);
}
