"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  addDays, addItem, addTask, BOARDS, completedOutput, dateLabel, DEPARTMENTS,
  departmentsFor, durationLabel, KIND_LABELS, linkRecipe, moveTask, SOURCE_LABELS,
  STATUS_LABELS, taskIssues, transitionTask, weekLabel, weekNumber,
  mondayOf, type BoardId, type DepartmentId, type Item, type ItemKind, type ItemUnit,
  type PreviewState, type Task, type TaskStatus,
} from "../../productie/planning";
import { DEMO_TODAY, DEMO_WEEK, demoIngredients, demoRecipes, initialPreviewState, PREVIEW_STORAGE_KEY } from "./sampleData";
import s from "./production.module.css";
import type { LiveWorkspace } from "../../productie/workspaceData";
const WorkspaceContext = createContext({ demo:true, recipes:demoRecipes, canManage:true, saving:false });

type View = "planning" | "catalog" | "recipes" | "ingredients" | "stock" | "settings";
type Modal = { type: "task"; date?: string; departmentId?: DepartmentId; itemId?: string; priorId?: string } | { type: "item" } | { type: "detail"; id: string } | { type: "item-detail"; id: string } | { type: "attention" } | { type: "reset" } | null;
type IconName = "grid" | "book" | "box" | "leaf" | "stock" | "settings" | "arrow" | "plus" | "chevron" | "check" | "clock" | "screen" | "close" | "search" | "warning" | "link" | "back" | "move" | "play";
const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: "planning", label: "Weekplanning", icon: "grid" },
  { id: "catalog", label: "Producten & onderdelen", icon: "box" },
  { id: "recipes", label: "Recepten", icon: "book" },
  { id: "ingredients", label: "Grondstoffen", icon: "leaf" },
  { id: "stock", label: "Voorraad", icon: "stock" },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 10h18M9 10v11M15 10v11M8 2v4M16 2v4" /></>,
    book: <><path d="M12 5C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v16" /></>,
    box: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5" /></>,
    leaf: <><path d="M20 3C5 1 1 9 7 16c7 6 15 2 13-13ZM4 21 16 8" /></>,
    stock: <><path d="M3 3v18h18M7 17v-4h3v4M13 17V8h3v9M19 17V4h2v13" /></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    screen: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M12 17v4M7 21h10" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    warning: <><path d="m12 3 10 18H2L12 3ZM12 9v5M12 17h.01" /></>,
    link: <><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(0 1) scale(.9)" /></>,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    move: <><path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" /></>,
    play: <path d="m8 4 12 8-12 8V4Z" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ModalFrame({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  const { demo } = useContext(WorkspaceContext);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={s.dialog} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label={title}>
    <header className={s.dialogHeader}><div><span className={s.eyebrow}>Strik Productie{demo ? " · preview" : ""}</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className={s.iconButton} onClick={onClose} aria-label="Sluiten"><Icon name="close" /></button></header>
    {children}
  </dialog>;
}

function quantity(value: number) { return value.toLocaleString("nl-NL", { maximumFractionDigits: 2 }); }
function departmentName(id: DepartmentId) { return DEPARTMENTS.find(d => d.id === id)?.name || id; }
function newId(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

export default function ProductionPreview({live,onRefresh}:{live?:LiveWorkspace;onRefresh?:()=>Promise<void>}) {
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
  const [view, setView] = useState<View>("planning");
  const [board, setBoard] = useState<BoardId>(()=>live && !live.departments.includes("dessert") ? "ijs" : "patisserie");
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
  async function persist(next:PreviewState, success:string):Promise<string|undefined> {
    if (savingRef.current) return "Wacht tot de vorige wijziging is opgeslagen.";
    if (demo) { setState(next); notify(success); return; }
    savingRef.current=true; setSaving(true);
    try {
      const response=await fetch("/api/productie",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:revisionRef.current,state:next})});
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
  const availableBoards=BOARDS.filter(b=>!live || departmentsFor(b.id).some(d=>live.departments.includes(d.id)));
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
    {!wall && <aside className={s.sidebar}>
      <Link href="/bakkerij" className={s.brand} aria-label="Terug naar Productie in de Team-app"><img src="/strik-logo.png" alt="Strik Patisserie" width="51" height="56" /><span>STRIK<strong>Productie</strong></span></Link>
      <span className={s.sidebarCaption}>HET ATELIER</span>
      <nav aria-label="Productiemenu">{NAV.map(n => <button key={n.id} onClick={() => navigate(n.id)} aria-current={view === n.id ? "page" : undefined}><Icon name={n.icon} /><span>{n.label}</span>{n.id === "planning" && <span className={s.navDot} />}</button>)}</nav>
      <div className={s.sidebarBoards}><span className={s.sidebarCaption}>PLANNINGEN</span>{availableBoards.map(b => <button key={b.id} onClick={() => { navigate("planning"); chooseBoard(b.id); }} aria-current={view === "planning" && board === b.id ? "true" : undefined}><span className={`${s.boardDot} ${s[`board_${b.id}`]}`} />{b.name}{view === "planning" && board === b.id && <Icon name="chevron" size={12} />}</button>)}</div>
      <div className={s.sidebarBottom}><button onClick={() => navigate("settings")} aria-current={view === "settings" ? "page" : undefined}><Icon name="settings" />Instellingen</button><Link href="/bakkerij"><Icon name="back" size={16} />Terug naar Team-app</Link><span>Met aandacht gemaakt. Sinds 1937.</span></div>
    </aside>}

    <main className={s.main}>
      <div className={s.previewBar}><span><i />{demo ? "Preview · voorbeeldgegevens" : "Strik Productie · gedeelde werkversie"}</span><span>{demo ? (storageError ? "Bewaren niet mogelijk · wijzigingen vervallen bij herladen" : "Wijzigingen blijven alleen in deze browser") : saving ? "Bezig met opslaan…" : `Opgeslagen in Supabase · bijgewerkt ${syncedAt ? new Intl.DateTimeFormat("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"}).format(new Date(syncedAt)) : ""}`}</span>{!wall && (demo ? <button onClick={() => setModal({ type: "reset" })}>Herstel voorbeeld</button> : <button disabled={saving} onClick={()=>void onRefresh?.()}>Verversen</button>)}</div>
      <header className={s.header}><div className={s.heading}><span className={s.eyebrow}>STRIK PRODUCTIE{wall ? " · SCHERMMODUS" : ""}</span><h1>{NAV.find(n => n.id === view)?.label || "Instellingen"}</h1></div>
        <div className={s.headerActions}>{view === "planning" && <><button className={s.secondaryButton} aria-pressed={wall} onClick={() => setWall(!wall)}><Icon name="screen" />{wall ? "Sluit schermmodus" : "XL-scherm"}</button>{!wall && canManage && <button className={s.primaryButton} onClick={() => setModal({ type: "task", date: day, departmentId: visibleDepartments[0]?.id })}><Icon name="plus" />Taak toevoegen</button>}</>}{view === "catalog" && canManage && <button className={s.primaryButton} onClick={() => setModal({ type: "item" })}><Icon name="plus" />Onderdeel toevoegen</button>}</div>
      </header>

      <div className={s.mobileNav}><label><span className={s.srOnly}>Onderdeel van Productie</span><select value={view} onChange={e => navigate(e.target.value as View)}>{NAV.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}<option value="settings">Instellingen</option></select></label><Link href="/bakkerij" aria-label="Terug naar Team-app"><Icon name="back" /></Link></div>

      {view === "planning" ? <>
        <section className={s.plannerToolbar} aria-label="Week en filters"><div className={s.weekPicker}><button aria-label="Vorige week" onClick={() => shiftWeek(-1)} className={s.previous}><Icon name="chevron" size={16} /></button><div><strong>Week {weekNumber(week)}</strong><span>{weekLabel(week)}</span></div><button aria-label="Volgende week" onClick={() => shiftWeek(1)}><Icon name="chevron" size={16} /></button><button className={s.thisWeek} onClick={() => { setWeek(demo ? DEMO_WEEK : mondayOf(today)); setDay(today); }}>{demo ? "Voorbeeldweek" : "Deze week"}</button></div>
          <div className={`${s.plannerFilters} ${showFilters ? s.filtersExpanded : ""}`}><label><span className={s.srOnly}>Planning</span><select value={board} onChange={e => chooseBoard(e.target.value as BoardId)}>{availableBoards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button className={s.mobileFilterToggle} aria-label="Toon of verberg filters" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><Icon name="settings" size={16} /></button><label className={s.extraFilter}><span className={s.srOnly}>Afdeling</span><select value={department} onChange={e => setDepartment(e.target.value as DepartmentId | "all")}><option value="all">Alle afdelingen</option>{boardDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>{!wall && <label className={s.extraFilter}><span className={s.srOnly}>Taakstatus</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Alle taken</option><option value="open">Nog te doen</option><option value="active">Bezig</option><option value="attention">Aandacht nodig</option><option value="done">Afgerond</option></select></label>}{wall && <button className={s.textSize} onClick={() => setLargeText(!largeText)} aria-pressed={largeText}>A<span>A</span> Tekstgrootte</button>}</div>
        </section>
        <div className={s.weekSummary}><div><span className={s.liveDot} />{BOARDS.find(b => b.id === board)?.name}<span className={s.summaryDivider} />{done} van {weekTasks.length} taken klaar<progress max={weekTasks.length || 1} value={done} aria-label="Voortgang voorbeeldweek" /></div><button onClick={() => setModal({ type: "attention" })} className={attention.length ? s.attentionButton : s.quietButton}><Icon name="warning" size={14} />{attention.length} aandachtspunt{attention.length === 1 ? "" : "en"}</button></div>
        <div className={s.mobileDays} role="group" aria-label="Kies dag">{days.map(d => <button key={d} aria-pressed={day === d} onClick={() => setDay(d)}>{dateLabel(d)}</button>)}</div>
        <section className={s.board} aria-label="Weekbord">
          <div className={s.boardHeader}><div className={s.departmentColumn}>Afdeling</div>{days.map(d => <div key={d} className={`${s.dayHeading} ${d === today ? s.today : ""}`}><strong>{dateLabel(d)}</strong><span>{d === today ? (demo ? "Voorbeeld: vandaag" : "Vandaag") : `${weekTasks.filter(t => t.date === d).length} taken`}</span></div>)}</div>
          {visibleDepartments.map(dep => {
            const tasks = filtered.filter(t => t.departmentId === dep.id);
            const total = tasks.reduce((sum, t) => sum + (t.minutes || 0), 0);
            return <div className={`${s.departmentRow} ${s[`tone_${dep.tone}`]}`} key={dep.id}>
              <div className={s.departmentLabel}><span className={s.departmentMark} /><h2>{dep.name}</h2><span>{tasks.filter(t => t.status === "done").length}/{tasks.length} klaar</span><small><Icon name="clock" size={12} />{durationLabel(total)} gepland</small></div>
              {days.map(d => <div key={d} className={`${s.dayCell} ${d === day ? s.mobileSelectedDay : ""} ${d === today ? s.todayCell : ""} ${dragged ? s.dropTarget : ""}`} onDragOver={e => { if (canManage && !wall && dragged) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }} onDrop={e => { e.preventDefault(); if (dragged) move(dragged, d, dep.id); }} aria-label={`${dep.name} · ${dateLabel(d, true)}`}>
                {tasks.filter(t => t.date === d).map(taskCard)}
                {!wall && canManage && <button className={s.cellAdd} aria-label={`Taak toevoegen · ${dep.name} · ${dateLabel(d, true)}`} onClick={() => setModal({ type: "task", date: d, departmentId: dep.id })}><Icon name="plus" size={14} /><span>Toevoegen</span></button>}
                {wall && !tasks.some(t => t.date === d) && <span className={s.emptyCell}>—</span>}
              </div>)}
            </div>;
          })}
        </section>
        <footer className={s.boardFooter}><span><i />Gepland <i className={s.activeLegend} />Bezig <i className={s.doneLegend} />Klaar <i className={s.blockedLegend} />Geblokkeerd</span><span>{wall ? (demo ? "Schermvoorbeeld · geen live verbinding" : "Gedeelde planning · verversing elke 15 seconden") : "Sleep om te verplaatsen · open een taak voor details"}</span>{!weekend && weekTasks.some(t => t.date === end) && <button onClick={() => setWeekend(true)}>Zondag heeft taken · toon zondag</button>}</footer>
      </> : view === "catalog" ? <>
        <div className={s.sectionIntro}><p>Alles wat je maakt, ook zonder uitgewerkt recept.</p><span>{state.items.length} producten & onderdelen</span></div>
        <div className={s.listToolbar}><Search value={query} onChange={setQuery} placeholder="Zoek op naam of artikelnummer…" /><select aria-label="Type onderdeel" value={kindFilter} onChange={e => setKindFilter(e.target.value)}><option value="all">Alle typen</option><option value="product">Producten</option><option value="component">Onderdelen</option><option value="activity">Werkzaamheden</option></select><DepartmentSelect value={department} onChange={setDepartment} /></div>
        <div className={s.catalogList}><div className={s.listHeader}><span>Product / onderdeel</span><span>Afdeling</span><span>Recept</span><span /></div>{catalog.map(item => <div className={s.catalogRow} key={item.id}><button className={s.itemName} onClick={() => setModal({ type: "item-detail", id: item.id })}><span className={`${s.itemGlyph} ${s[`tone_${DEPARTMENTS.find(d => d.id === item.departmentId)!.tone}`]}`}><Icon name={item.kind === "activity" ? "clock" : item.kind === "component" ? "box" : "book"} /></span><span><strong>{item.name}</strong><small>{KIND_LABELS[item.kind]} · {item.unit}{item.productionBlocked && " · Recept controleren"}{item.articleNumber && ` · ${item.articleNumber}`}</small></span></button><span className={s.catalogDepartment}>{item.departmentUnconfirmed ? "Afdeling controleren" : departmentName(item.departmentId)}</span><span className={item.recipeId ? s.recipeLinked : s.recipeMissing}>{item.recipeId ? <><Icon name="link" size={13} />Gekoppeld</> : "Vrij in te plannen"}</span><button disabled={!canManage || saving || item.productionBlocked} className={s.planButton} onClick={() => setModal({ type: "task", itemId: item.id, departmentId: item.departmentId, date: day })}><Icon name="plus" size={14} />Inplannen</button></div>)}{catalog.length === 0 && <Empty title="Geen onderdelen gevonden" text="Pas de zoekopdracht of filters aan." />}</div>
      </> : view === "recipes" ? <>
        <div className={s.sectionIntro}><p>Recepten en halffabricaten, samen met de onderdelen waarop ze worden gebruikt.</p><span>{recipeList.length} {demo ? "voorbeeldrecepten" : "recepten"}</span></div>
        {demo && <div className={s.infoNote}><Icon name="book" /><p>Deze recepten zijn fictieve voorbeelden. Jullie bestaande WordPress-recepten worden pas na een gecontroleerde overdracht aangesloten.</p></div>}
        <Search value={query} onChange={setQuery} placeholder={demo ? "Zoek een voorbeeldrecept…" : "Zoek een recept…"} />
        <div className={s.recipeGrid}>{recipeList.filter(r => r.name.toLocaleLowerCase("nl-NL").includes(query.toLocaleLowerCase("nl-NL"))).map(r => { const linked = state.items.filter(i => i.recipeId === r.id); return <article key={r.id} className={s.recipeCard}><div className={s.recipeCardIcon}><Icon name="book" size={23} /><span>{demo ? "VOORBEELDRECEPT" : "RECEPT"}</span></div><h2>{r.name}</h2><p>{r.yield > 0 ? `Basisrecept voor ${quantity(r.yield)} ${r.unit}` : "Basisopbrengst nog invullen"}</p><div className={s.recipeMeta}><span>{r.ingredients.length} ingrediënten</span><span>{r.steps.length} stappen</span></div><footer>{linked.length ? <button onClick={() => setModal({ type: "item-detail", id: linked[0].id })}>Bekijk recept & onderdeel<Icon name="arrow" size={16} /></button> : <span>Koppelbaar via Producten & onderdelen</span>}</footer></article>; })}</div>
      </> : view === "ingredients" ? <>
        <div className={s.sectionIntro}><p>Gedeelde grondstoffen en leveranciersspecificaties voor alle afdelingen.</p><span>SpecsPlaza</span></div>
        <div className={s.infoNote}><Icon name="link" /><p>{demo ? "Voorbeeld van de bestaande SpecsPlaza-koppeling." : "Specificaties worden gedeeld met het grondstoffenbeheer."} {canManage && <Link href="/bakkerij/management">Open grondstoffenbeheer</Link>}</p></div>
        <div className={s.ingredientList}>{ingredientList.map(i => <article key={i.id}><div className={s.itemGlyph}><Icon name="leaf" /></div><div><h2>{i.name}</h2><p>{i.supplier} · {i.unit}</p></div><div className={s.ingredientSpec}><span className={i.linked ? s.recipeLinked : s.recipeMissing}>{i.linked && <Icon name="link" size={13} />}{i.specification}</span><small>{demo ? "Voorbeeld allergenen" : "Allergenen"}: {i.allergens}</small></div></article>)}</div>
      </> : view === "stock" ? <>
        <div className={s.sectionIntro}><p>{demo ? "Voorbeeldvoorraad plus afgeronde productie." : "Hier staan je productieregistraties. Een actuele voorraad is nog niet aangesloten."} Werkelijke voorraad vraagt ook registratie van verbruik en uitgifte.</p></div>
        <div className={s.listToolbar}><Search value={query} onChange={setQuery} placeholder="Zoek een product of onderdeel…" /><DepartmentSelect value={department} onChange={setDepartment} /></div>
        <div className={s.stockTable}><div className={s.stockHeader}><span>Product / onderdeel</span><span>Startvoorraad</span><span>Geproduceerd</span><span>{demo ? "Voorbeeldtotaal" : "Voorraad"}</span></div>{catalog.filter(i => i.kind !== "activity").map(i => <div className={s.stockRow} key={i.id}><button onClick={() => setModal({ type: "item-detail", id: i.id })}><strong>{i.name}</strong><small>{departmentName(i.departmentId)} · {i.unit}</small></button><span>{!demo && !i.stockKnown ? "Onbekend" : quantity(i.stock)}</span><span className={s.recipeLinked}>+{quantity(output.get(i.id) || 0)}</span><strong>{!demo && !i.stockKnown ? "Onbekend" : quantity(i.stock + (output.get(i.id) || 0))} <small>{i.unit}</small></strong></div>)}</div>
      </> : <>
        <div className={s.settingsGrid}><section className={s.settingCard}><Icon name="screen" size={24} /><h2>Jouw weekbord</h2><p>Pas het bord aan voor de werkplek of het grote scherm.</p><label className={s.checkboxRow}><input type="checkbox" checked={weekend} onChange={e => setWeekend(e.target.checked)} /><span>Zondag ook tonen</span></label><label className={s.checkboxRow}><input type="checkbox" checked={largeText} onChange={e => setLargeText(e.target.checked)} /><span>Grotere tekst in het weekbord</span></label><button className={s.secondaryButton} onClick={() => { navigate("planning"); setWall(true); }}><Icon name="screen" />Open XL-schermstand</button></section><section className={s.settingCard}><Icon name="box" size={24} /><h2>{demo ? "Van preview naar productie" : "Werkversie in gebruik"}</h2><p>{demo ? "Deze versie gebruikt uitsluitend voorbeeldgegevens en bewaart je aanpassingen lokaal." : "Je planning en onderdelen worden gedeeld opgeslagen. Bestellingen, verbruik en verkoopprognoses worden in volgende stappen aangesloten."}</p><ol><li>Weekbord en werkwijze samen beoordelen.</li><li>Recepten, grondstoffen en koppelingen controleren en overzetten.</li><li>Met één afdeling testen en daarna uitbreiden.</li><li>Bestellingen, voorraad en verkoopgegevens aansluiten.</li></ol>{demo ? <button className={s.textLink} onClick={() => setModal({ type: "reset" })}>Voorbeeldgegevens herstellen</button> : canManage && <Link className={s.textLink} href="/bakkerij/management">Recepturen, prijzen & marges beheren</Link>}</section></div>
      </>}
    </main>
    {message && <div className={`${s.toast} ${notificationError ? s.errorToast : ""}`} role="status"><Icon name={notificationError ? "warning" : "check"} /><span>{message}</span><button onClick={() => setMessage("")} aria-label="Melding sluiten"><Icon name="close" size={16} /></button></div>}
    {modal?.type === "task" && <TaskForm state={state} initial={modal} onClose={() => setModal(null)} onSave={async next => { const error=await persist(next,"Taak toegevoegd."); if (!error) setModal(null); return error; }} />}
    {modal?.type === "item" && <ItemForm state={state} onClose={() => setModal(null)} onSave={async next => { const error=await persist(next,"Onderdeel toegevoegd. Je kunt het direct inplannen."); if (!error) setModal(null); return error; }} />}
    {modal?.type === "detail" && (() => { const task = state.tasks.find(t => t.id === modal.id); if (!task) return null; const item = state.items.find(i => i.id === task.itemId)!; return <TaskDetail task={task} item={item} state={state} wall={wall} onClose={() => setModal(null)} onStatus={status => changeStatus(task.id, status)} onMove={move} onNext={() => setModal({ type: "task", date: task.date, departmentId: task.departmentId, itemId: task.itemId, priorId: task.id })} />; })()}
    {selectedItem && <ItemDetail key={selectedItem.id} item={selectedItem} state={state} onClose={()=>setModal(null)} onPlan={()=>setModal({type:"task",itemId:selectedItem.id,departmentId:selectedItem.departmentId,date:day})} onLink={recipeId=>connectRecipe(selectedItem.id,recipeId)} onUpdate={changes=>updateItem(selectedItem.id,changes)}/>}
    {modal?.type === "attention" && <ModalFrame title="Aandacht deze week" subtitle={`${BOARDS.find(b => b.id === board)?.name} · week ${weekNumber(week)}`} onClose={() => setModal(null)}><div className={s.dialogBody}>{attention.length ? attention.map(t => <button className={s.attentionRow} key={t.id} onClick={() => setModal({ type: "detail", id: t.id })}><Icon name="warning" /><span><strong>{state.items.find(i => i.id === t.itemId)?.name}</strong><small>{dateLabel(t.date, true)} · {taskIssues(t, state.tasks,state.items).join(" ")}</small></span><Icon name="chevron" size={16} /></button>) : <Empty title="Geen aandachtspunten" text="Alle taken in deze voorbeeldweek kunnen volgens de huidige planning doorlopen." />}</div></ModalFrame>}
    {modal?.type === "reset" && <ModalFrame title="Voorbeeld herstellen?" onClose={() => setModal(null)}><div className={s.dialogBody}><p>Je lokale wijzigingen aan dit productievoorbeeld worden vervangen door de oorspronkelijke voorbeeldweek. Live gegevens worden niet geraakt.</p></div><footer className={s.dialogFooter}><button className={s.secondaryButton} onClick={() => setModal(null)}>Annuleren</button><button className={s.primaryButton} onClick={() => { setState(initialPreviewState()); setModal(null); setWeek(DEMO_WEEK); setDay(DEMO_TODAY); notify("Oorspronkelijke voorbeeldweek hersteld."); }}>Herstel voorbeeld</button></footer></ModalFrame>}
  </div></WorkspaceContext.Provider>;
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) { return <label className={s.search}><Icon name="search" /><span className={s.srOnly}>{placeholder}</span><input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>; }
function DepartmentSelect({ value, onChange }: { value: string; onChange: (v: DepartmentId | "all") => void }) { return <select aria-label="Afdeling" value={value} onChange={e => onChange(e.target.value as DepartmentId | "all")}><option value="all">Alle afdelingen</option>{DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className={s.empty}><Icon name="box" size={28} /><h2>{title}</h2><p>{text}</p></div>; }

function TaskForm({ state, initial, onClose, onSave }: { state: PreviewState; initial: NonNullable<Extract<Modal, { type: "task" }>>; onClose: () => void; onSave: (s: PreviewState) => Promise<string | undefined> }) {
  const [error, setError] = useState("");
  const [itemId, setItemId] = useState(initial.itemId || "");
  const item = state.items.find(i => i.id === itemId);
  const prior = state.tasks.find(t => t.id === initial.priorId);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    try {
      const id = newId("task");
      const error=await onSave(addTask(state, { id, itemId, departmentId: data.get("department") as DepartmentId, date: String(data.get("date")), quantity: Number(data.get("quantity")), operation: String(data.get("operation")), minutes: String(data.get("minutes")) ? Number(data.get("minutes")) : undefined, status: "planned", note: String(data.get("note")), source: data.get("source") as Task["source"], dueDate: String(data.get("dueDate")) || undefined, dependsOn: prior?.id, batchId: prior?.batchId || `batch-${id}`, recordsOutput: item?.kind !== "activity" && data.get("output") === "on" })); if(error) setError(error);
    } catch (e) { setError((e as Error).message); }
  }
  const existingOutput = prior && state.tasks.some(t => t.batchId === prior.batchId && t.recordsOutput);
  return <ModalFrame title={prior ? "Volgende productiestap" : "Taak toevoegen"} subtitle={prior ? `Aansluitend op: ${prior.operation} · ${dateLabel(prior.date, true)}` : "Kies een onderdeel, met of zonder recept."} onClose={onClose}><form onSubmit={submit}><div className={s.dialogBody}>
    <label className={s.field}>Product of onderdeel<select required value={itemId} onChange={e => setItemId(e.target.value)} disabled={!!prior}><option value="">Kies een product of onderdeel…</option>{state.items.map(i => <option disabled={i.productionBlocked} key={i.id} value={i.id}>{i.name} · {KIND_LABELS[i.kind]}</option>)}</select></label>
    {item && <p className={s.fieldHint}>{item.recipeId ? "Recept beschikbaar bij deze taak." : "Je kunt dit onderdeel gewoon inplannen. Een recept is optioneel."}</p>}
    <div className={s.formGrid}><label className={s.field}>Aantal ({item?.unit || "eenheid"})<input type="number" name="quantity" min="0.01" max="1000000" step="any" required defaultValue={prior?.quantity || 1} /></label><label className={s.field}>Afdeling<select name="department" defaultValue={initial.departmentId || "dessert"}>{DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className={s.field}>Plandatum<input required name="date" type="date" defaultValue={initial.date || DEMO_TODAY} min={prior?.date} /></label><label className={s.field}>Benodigd op (optioneel)<input name="dueDate" type="date" defaultValue={prior?.dueDate} /></label></div>
    <div className={s.formGrid}><label className={s.field}>Werkzaamheid<input name="operation" maxLength={100} placeholder="Bijv. bakken, vullen of afwerken" defaultValue={prior ? "Afwerken" : "Maken"} required /></label><label className={s.field}>Werktijd in minuten (optioneel)<input name="minutes" type="number" min="0" max="1440" placeholder="Nog onbekend" /></label></div>
    <label className={s.field}>Herkomst<select name="source" defaultValue={prior?.source || "manual"}>{Object.entries(SOURCE_LABELS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    <label className={s.field}>Korte opmerking<textarea name="note" rows={2} maxLength={1000} defaultValue="" placeholder="Wat moet de afdeling weten?" /></label>
    {item && item.kind !== "activity" && <label className={s.checkboxRow}><input name="output" type="checkbox" defaultChecked={!existingOutput} disabled={!!existingOutput} /><span>Deze stap registreert de geproduceerde hoeveelheid<small>{existingOutput ? "Een andere stap in deze batch registreert de hoeveelheid al." : "Zet dit alleen aan bij de stap waarop het onderdeel gereed is."}</small></span></label>}
    {error && <p className={s.formError} role="alert">{error}</p>}
  </div><footer className={s.dialogFooter}><button type="button" className={s.secondaryButton} onClick={onClose}>Annuleren</button><button className={s.primaryButton} type="submit"><Icon name="plus" size={16} />Inplannen</button></footer></form></ModalFrame>;
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

function TaskDetail({ task, item, state, wall, onClose, onStatus, onMove, onNext }: { task: Task; item: Item; state: PreviewState; wall: boolean; onClose: () => void; onStatus: (s: TaskStatus) => Promise<string | undefined>; onMove: (id: string, date: string, departmentId: DepartmentId) => Promise<string | undefined>; onNext: () => void }) {
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
    <RecipeContent recipeId={recipe?.id} amount={task.quantity} note={item.note} />
    <p className={s.fieldHint}>{task.recordsOutput ? `Afronden voegt ${quantity(task.quantity)} ${item.unit} toe aan de ${demo ? "voorbeeldproductie" : "productieregistratie"}.` : "Deze stap registreert geen nieuwe voorraad. Zo tellen opeenvolgende stappen niet dubbel."}</p>
    {!wall && <><div className={s.statusActions}>{(["planned", "active", "done", "blocked"] as TaskStatus[]).map(status => <button key={status} aria-pressed={task.status === status} disabled={saving} onClick={async () => setError(await onStatus(status) || "")} className={s.secondaryButton}>{status === "done" && <Icon name="check" size={15} />}{STATUS_LABELS[status]}</button>)}</div>{error && <p className={s.formError} role="alert">{error}</p>}{canManage && <details className={s.moveDetails}><summary><Icon name="move" size={15} />Verplaatsen of volgende stap toevoegen</summary><form onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); setError(await onMove(task.id, String(data.get("date")), data.get("department") as DepartmentId) || ""); }}><label className={s.field}>Datum<input name="date" type="date" defaultValue={task.date} required /></label><label className={s.field}>Afdeling<select name="department" defaultValue={task.departmentId}>{DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><button className={s.secondaryButton} type="submit">Verplaatsen</button></form><button className={s.textLink} onClick={onNext}><Icon name="plus" size={15} />Volgende stap in deze batch</button></details>}</>}
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
  return <section className={s.recipeContent}><h3><Icon name="book" size={17} />{recipe ? recipe.name : "Werkinstructie"}</h3>{note && <p>{note}</p>}{recipe ? <>{recipe.reviewRequired && <p className={s.formError}>Dit bronrecept bevat ontbrekende grondstoffen of onderdelen. De oorspronkelijke verwijzingen zijn bewaard; controleer ze vóór productie.</p>}{demo && <span className={s.exampleLabel}>VOORBEELDRECEPT · GEEN PRODUCTIE-INSTRUCTIE</span>}<div className={s.ingredientAmounts}>{recipe.ingredients.map(i => <div key={i.name}><span>{i.name}</span><strong>{(i.quantity > 0 ? quantity(recipe.yield > 0 ? i.quantity * amount / recipe.yield : i.quantity) : "Nog invullen")} {i.unit}</strong></div>)}</div><small className={s.fieldHint}>{recipe.yield > 0 ? `Geschaald naar ${quantity(amount)} ${recipe.unit} · basis ${recipe.yield} ${recipe.unit}` : "Basisopbrengst ontbreekt; bronhoeveelheden worden ongeschaald getoond."}</small><ol>{recipe.steps.map(step => <li key={step}>{step}</li>)}</ol><p className={s.allergenNote}>{demo ? "Voorbeeld allergenen" : "Opgegeven allergenen"}: {recipe.allergens.join(", ") || "Nog controleren"}.</p></> : <p className={s.fieldHint}>Nog geen recept gekoppeld. Dit onderdeel blijft gewoon selecteerbaar en in te plannen.</p>}</section>;
}

function isPreviewState(value: unknown): value is PreviewState {
  if (!value || typeof value !== "object") return false;
  const record = value as PreviewState;
  if (record.version !== 1 || !Array.isArray(record.items) || !Array.isArray(record.tasks) || record.items.length > 1000 || record.tasks.length > 5000) return false;
  try {
    const ids = new Set<string>();
    for (const item of record.items) {
      if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id) || typeof item.name !== "string" || !item.name || typeof item.note !== "string" || !DEPARTMENTS.some(d => d.id === item.departmentId) || !Object.hasOwn(KIND_LABELS, item.kind) || !["stuks", "gram", "kg", "ml", "liter", "platen", "taak"].includes(item.unit) || !Number.isFinite(item.stock) || item.stock < 0 || (item.recipeId && !demoRecipes.some(r => r.id === item.recipeId && r.unit === item.unit))) return false;
      ids.add(item.id);
    }
    const taskIds = new Set<string>();
    const outputBatches = new Set<string>();
    for (const task of record.tasks) {
      if (!task || !ids.has(task.itemId) || typeof task.id !== "string" || !task.id || taskIds.has(task.id) || typeof task.batchId !== "string" || !task.batchId || typeof task.note !== "string" || !Number.isFinite(task.quantity) || task.quantity <= 0 || !Object.hasOwn(STATUS_LABELS, task.status) || !Object.hasOwn(SOURCE_LABELS, task.source) || !DEPARTMENTS.some(d => d.id === task.departmentId) || typeof task.operation !== "string" || typeof task.recordsOutput !== "boolean") return false;
      addDays(task.date, 0);
      if (task.dueDate) addDays(task.dueDate, 0);
      if (task.recordsOutput) {
        if (outputBatches.has(task.batchId) || record.items.find(i => i.id === task.itemId)?.kind === "activity") return false;
        outputBatches.add(task.batchId);
      }
      if (task.minutes !== undefined && (!Number.isFinite(task.minutes) || task.minutes < 0 || task.minutes > 1440)) return false;
      taskIds.add(task.id);
    }
    for (const task of record.tasks) {
      if (record.tasks.some(t => t.batchId === task.batchId && t.itemId !== task.itemId)) return false;
      const seen = new Set<string>([task.id]); let cursor: Task | undefined = task;
      while (cursor?.dependsOn) {
        const prior = record.tasks.find(t => t.id === cursor!.dependsOn);
        if (!prior || seen.has(prior.id) || prior.batchId !== task.batchId || prior.itemId !== task.itemId || prior.date > cursor.date || ((cursor.status === "done" || cursor.status === "active") && prior.status !== "done")) return false;
        seen.add(prior.id); cursor = prior;
      }
    }
    completedOutput(record.items, record.tasks);
    return true;
  } catch { return false; }
}
