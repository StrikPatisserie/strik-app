"use client";

/* eslint-disable @next/next/no-img-element -- private authenticated offer images retain their existing source URL. */

import Link from "next/link";
import dynamic from "next/dynamic";
import useScreenLayout from "../../productie/useScreenLayout";
import useProductionUpdates from "../../productie/useProductionUpdates";
import {decodeReloadView,RELOAD_VIEW_KEY} from "../../productie/productionUpdates";
import TaskWorkPanel,{WorkClock,PreparationControl,RecipeWorkHistory} from "../../productie/TaskWorkPanel";
import {applyWorkCommand} from "../../productie/workCommands";
import type {WorkCommand} from "../../productie/productionWork";
import WeddingWeekLane from "../../productie/WeddingWeekLane";
import QuickRecipeForm from "../../productie/QuickRecipeForm";
import ProductionRequests from "../../productie/ProductionRequests";
import ProductionWeekOffer from "../../productie/ProductionWeekOffer";
import ProductionItemPicker from "../../productie/ProductionItemPicker";
import SearchableChoice from "../../productie/SearchableChoice";
import { recipeGroups } from "../../productie/recipeGroups";
import { EXTRA_TASK_OPERATIONS, combineTaskOperation, splitTaskOperation, type ExtraTaskOperation } from "../../productie/taskOperations";
import CleaningWeekLane from "../../productie/CleaningWeekLane";
import { scheduleWedding, type WeddingProductionOrder } from "../../productie/weddingPlanning";
const OfferManager=dynamic(()=>import("../../bakkerij/recepturen/RecepturenApp"),{loading:()=> <p role="status">Aanbiedingbeheer laden…</p>});
const ProductionWeekArchive=dynamic(()=>import("../../productie/ProductionWeekArchive"),{loading:()=> <p role="status">Weekarchief laden…</p>});
const ProductionStaffing=dynamic(()=>import("../../productie/ProductionStaffing"),{loading:()=> <p role="status">Personeelsrooster laden…</p>});
import Icon, { type IconName } from "../../productie/ProductionIcon";
import ProductionNavigation, { ProductionMobileNavigation } from "../../productie/ProductionNavigation";
import { productionView, type ProductionView } from "../../productie/navigation";
import { productionDayRhythm, plannedOperation } from "../../productie/dayRhythm";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  addDays, addItem, applyCleaningCommand, BOARDS, completedOutput, dateLabel, DEPARTMENTS,
  departmentsFor, durationLabel, KIND_LABELS, linkRecipe, moveTask, removePlannedTask, recipeProductionTasks, removeRecipeProduction, SOURCE_LABELS,
  STATUS_LABELS, taskIssues, transitionTask, weekLabel, weekNumber, requiredTaskIds,
  mondayOf, matchesProductionSearch, type BoardId, type DepartmentId, type Item, type ItemKind, type ItemUnit,
  type PreviewState, type Task, type TaskStatus, type CleaningCommand,
} from "../../productie/planning";
import { DEMO_TODAY, DEMO_WEEK, demoIngredients, demoRecipes, initialPreviewState, PREVIEW_STORAGE_KEY } from "./sampleData";
import s from "./production.module.css";
import { validWorkspace, type LiveWorkspace } from "../../productie/workspaceData";
import { buildRecipePlan, preparationProposal, currentPlanCommand, recipePlanChanges, recipePlanUpdateBlock, refreshRecipePlan, type PlanCommand, type PreparationChoice } from "../../productie/recipePlanning";
const BakeryScreenMessages=dynamic(()=>import("../../productie/BakeryScreenMessages"));
const ProductionInventory=dynamic(()=>import("../../productie/ProductionInventory"));
const WorkspaceContext = createContext({ demo:true, recipes:demoRecipes, canManage:true, saving:false });

type View = ProductionView;
type Modal = { type: "task"; date?: string; departmentId?: DepartmentId; itemId?: string; priorId?: string; refreshId?: string } | { type: "item"; returnTo?:{date?:string;departmentId?:DepartmentId} } | { type: "detail"; id: string } | { type: "item-detail"; id: string } | { type: "attention" } | { type: "reset" } | {type:"offer";week:string;imageUrl:string;label:string} | {type:"offer-manage";week:string} | {type:"cleaning";date:string;edit?:boolean} | null;
const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: "planning", label: "Weekplanning", icon: "grid" },
  { id: "catalog", label: "Producten & onderdelen", icon: "box" },
  { id: "recipes", label: "Recepten", icon: "book" },
  { id: "ingredients", label: "Grondstoffen", icon: "leaf" },
  { id: "stock", label: "Voorraadbeheer", icon: "stock" },
];

function ModalFrame({ title, subtitle, children, onClose, wide }: { title: string; wide?:boolean; subtitle?: string; children: ReactNode; onClose: () => void }) {
  const { demo } = useContext(WorkspaceContext);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} data-production-content className={`${s.dialog} ${wide?s.dialogWide:""}`} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label={title}>
    <header className={s.dialogHeader}><div><span className={s.eyebrow}>STRAK gepland{demo ? " · preview" : ""}</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className={s.iconButton} onClick={onClose} aria-label="Sluiten"><Icon name="close" /></button></header>
    {children}
  </dialog>;
}

function DayRhythm({board,date}:{board:BoardId;date:string}) {
  const blocks=productionDayRhythm(board,date);
  if(!blocks.length)return null;
  return <div className={s.dayRhythm} role="group" aria-label={`Vast dagritme · ${dateLabel(date,true)}`}>{blocks.map(block=><div key={block.id} className={s[`rhythm_${block.id}`]} title={block.note}><small>{block.start}–{block.end}</small><b>{block.label}</b></div>)}</div>;
}

function quantity(value: number) { return value.toLocaleString("nl-NL", { maximumFractionDigits: 1 }); }
function departmentName(id: DepartmentId) { return DEPARTMENTS.find(d => d.id === id)?.name || id; }
function newId(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

export default function ProductionPreview({live,onRefresh,initialView="planning",initialBoard,initialDepartment,initialWeek,initialTask,releaseVersion="development",connectionHealthy=true}:{releaseVersion?:string;connectionHealthy?:boolean;live?:LiveWorkspace;onRefresh?:()=>Promise<void>;initialView?:string;initialBoard?:BoardId;initialDepartment?:DepartmentId;initialWeek?:string;initialTask?:string}) {
  const demo = !live, canManage = !live || live.canManage;
  const canManageData = !live || (live.canManageData ?? live.canManage);
  const [quickRecipeItem,setQuickRecipeItem]=useState<string|null>(null);
  const [quickRecipeTask,setQuickRecipeTask]=useState<string|undefined>();
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
  const [week, setWeek] = useState(()=>initialWeek || (demo ? DEMO_WEEK : mondayOf(today)));
  const [department, setDepartment] = useState<DepartmentId | "all">(initialDepartment || "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState(today);
  const [wall, setWall] = useState(false);
  const screenFit=view==="planning";
  const {frameRef,workspaceRef}=useScreenLayout(wall,screenFit);
  const [largeText, setLargeText] = useState(false);
  const [weekend, setWeekend] = useState(false);
  const [modal, setModal] = useState<Modal>(()=>initialTask && live?.state.tasks.some(task=>task.id===initialTask) ? {type:"detail",id:initialTask} : null);
  const [message, setMessage] = useState("");
  const [notificationError, setNotificationError] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [kindFilter, setKindFilter] = useState("all");
  const [dragged, setDragged] = useState<string | null>(null);
  const updatePending=useProductionUpdates({enabled:!demo&&view==="planning",clientVersion:releaseVersion,serverVersion:live?.appVersion,blocked:saving||!!modal||!!quickRecipeItem||!!dragged||!connectionHealthy,view:{week,day,board,department,statusFilter,wall,weekend}});
  useEffect(()=>{
    if(demo)return;
    try{
      const saved=decodeReloadView(sessionStorage.getItem(RELOAD_VIEW_KEY),location.pathname+location.search,Date.now());
      sessionStorage.removeItem(RELOAD_VIEW_KEY);
      if(saved&&(!live||departmentsFor(saved.board).some(d=>live.departments.includes(d.id)))){
        setWeek(saved.week);setDay(saved.day);setBoard(saved.board);setDepartment(saved.department);setStatusFilter(saved.statusFilter);setWall(saved.wall);setWeekend(saved.weekend);
      }
    }catch{/* No planner snapshot is ever restored from browser storage. */}
  // Restore view preferences once; subsequent data always comes from the API.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[demo]);


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
    if (live && !saving && (!modal || modal.type === "task") && !quickRecipeItem && live.revision>=revisionRef.current) {
      setState(live.state); revisionRef.current=live.revision; setSyncedAt(live.updatedAt);
    }
  },[live,saving,modal,quickRecipeItem]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  const days = Array.from({ length: weekend ? 7 : 6 }, (_, i) => addDays(week, i));
  const boardDepartments = departmentsFor(board);
  const visibleDepartments = boardDepartments.filter(d => department === "all" || d.id === department);
  const weekTasks = state.tasks.filter(t => t.date >= week && t.date <= addDays(week, 6) && boardDepartments.some(d => d.id === t.departmentId));
  const taskGroups = useMemo(() => recipeGroups(state.tasks, state.items), [state.tasks, state.items]);
  const end = addDays(week, 6);
  const recipeUpdates=useMemo(()=>new Map(state.tasks.filter(t=>!t.generatedFor && !t.dependsOn && (t.recipePlan || state.tasks.some(c=>c.generatedFor===t.id))).map(t=>[t.id,recipePlanChanges(state,recipeList,t)]).filter(([,review])=>typeof review!=="string" && review.changed) as [string,ReturnType<typeof recipePlanChanges>][]),[state,recipeList]);
  const filtered = state.tasks.filter(t => t.date >= week && t.date <= end && (weekend || t.date !== end) && visibleDepartments.some(d => d.id === t.departmentId))
    .filter(t => statusFilter === "all" || (statusFilter === "open" ? t.status !== "done" : statusFilter === "attention" ? (taskIssues(t, state.tasks,state.items).length > 0 || recipeUpdates.has(t.id)) : t.status === statusFilter))
    .filter(t => !query || `${state.items.find(i => i.id === t.itemId)?.name} ${t.operation} ${t.note}`.toLocaleLowerCase("nl-NL").includes(query.toLocaleLowerCase("nl-NL")));

  const attention = weekTasks.filter(t => !t.weddingCode && t.status !== "done" && (taskIssues(t, state.tasks,state.items).length || recipeUpdates.has(t.id)));
  const done = weekTasks.filter(t => t.status === "done").length;
  const output = useMemo(() => completedOutput(state.items, state.tasks), [state]);
  const catalog = state.items.filter(i => (department === "all" || i.departmentId === department) && (kindFilter === "all" || i.kind === kindFilter) && matchesProductionSearch(query,[i.name,i.articleNumber,i.note]));

  function notify(text: string, error = false) { setNotificationError(error); setMessage(text); }
  function navigate(next: View) { setView(next); setQuery(""); setDepartment("all"); setKindFilter("all"); }
  function chooseBoard(id: BoardId) { setBoard(id); setDepartment("all"); }
  function shiftWeek(direction: number) { const next = addDays(week, direction * 7); setWeek(next); setDay(next); }
  async function persist(next:PreviewState, success:string,command?:PlanCommand,replaceTaskId?:string):Promise<string|undefined> {
    if (savingRef.current) return "Wacht tot de vorige wijziging is opgeslagen.";
    if (demo) { setState(next); notify(success); return; }
    savingRef.current=true; setSaving(true);
    try {
      const response=await fetch(command?"/api/productie/plan":"/api/productie",{method:command?"POST":"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(command?{revision:revisionRef.current,recipeRevision:live?.recipeRevision,command,...(replaceTaskId?{replaceTaskId}:{})}:{revision:revisionRef.current,state:next})});
      const data=await response.json();
      if (!response.ok) throw Error(data.message || "Opslaan is mislukt; je wijziging is niet opgeslagen.");
      revisionRef.current=data.revision; setState(data.state); setSyncedAt(data.updatedAt); notify(success);
    } catch(e) { const error=(e as Error).message; notify(error,true); return error; }
    finally { savingRef.current=false; setSaving(false); }
  }
  async function work(command:WorkCommand):Promise<string|undefined> {
    if(savingRef.current)return "Wacht tot de vorige wijziging is opgeslagen.";
    if(demo){try{setState(applyWorkCommand(state,recipeList,command,DEPARTMENTS.map(d=>d.id),"preview",crypto.randomUUID(),new Date().toISOString()));return;}catch(e){return (e as Error).message;}}
    savingRef.current=true;setSaving(true);
    try{
      const response=await fetch("/api/productie/werk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:crypto.randomUUID(),revision:revisionRef.current,command})}),data=await response.json();
      if(!response.ok)throw Error(data.message||"Opslaan mislukt.");
      revisionRef.current=data.revision;setState(data.state);setSyncedAt(data.updatedAt);
    }catch(e){const error=(e as Error).message;notify(error,true);return error;}finally{savingRef.current=false;setSaving(false);}
  }
  async function changeStatus(id:string,status:TaskStatus){
    if(status==="done"||status==="active"){setModal({type:"detail",id});return;}
    if(state.productionWork?.timers?.[id]||state.productionWork?.completions?.[id])return work({kind:"reopen",taskId:id});
    try{return await persist({...state,tasks:transitionTask(state.tasks,id,status,state.items)},"Status opgeslagen.");}catch(e){return (e as Error).message;}
  }
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify("Volledig scherm is niet beschikbaar in deze browser.",true);}}
  async function move(id:string,date:string,departmentId:DepartmentId) {
    try { return await persist({...state,tasks:moveTask(state.tasks,id,date,departmentId)},`Taak verplaatst naar ${dateLabel(date,true)}.`); }
    catch(e) { const error=(e as Error).message; notify(error,true); return error; }
    finally { setDragged(null); }
  }
  async function remove(id:string,wholeProduction=false) {
    try {
      const next={...state,tasks:wholeProduction?removeRecipeProduction(state.tasks,id):removePlannedTask(state.tasks,id)};
      if (demo) next.removedTasks=[...(state.removedTasks || []),...state.tasks.filter(t=>!next.tasks.some(n=>n.id===t.id)).map(task=>({task,removedAt:new Date().toISOString(),removedBy:"preview"}))];
      const error=await persist(next,wholeProduction?`${state.tasks.length-next.tasks.length} taken uit deze receptproductie verwijderd.`:"Geplande taak verwijderd.");
      if (!error) setModal(null);
      return error;
    } catch(e) { return (e as Error).message; }
  }
  async function clean(command:CleaningCommand):Promise<string|undefined> {
    if(savingRef.current)return "Wacht tot de vorige wijziging is opgeslagen.";
    const message=command.kind==="check"?(command.done?"Schoonmaaktaak afgevinkt.":"Schoonmaaktaak heropend."):"Schoonmaakplanning opgeslagen.";
    if(demo){try{return await persist({...state,cleaning:applyCleaningCommand(state.cleaning || [],command,"preview",new Date().toISOString(),()=>newId("cleaning-check"))},message);}catch(e){return (e as Error).message;}}
    savingRef.current=true;setSaving(true);
    try{const response=await fetch("/api/productie/schoonmaak",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:revisionRef.current,command})}),data=await response.json();if(!response.ok)throw Error(data.message || "De schoonmaakwijziging kon niet worden opgeslagen.");revisionRef.current=data.revision;setState(data.state);setSyncedAt(data.updatedAt);notify(message);}
    catch(e){const message=(e as Error).message;notify(message,true);return message;}finally{savingRef.current=false;setSaving(false);}
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
  async function plan(command:PlanCommand,refreshId?:string) {
    try {
      const next=refreshId?refreshRecipePlan(state,recipeList,refreshId,command):buildRecipePlan(state,recipeList,command),count=next.tasks.length-state.tasks.length;
      const error=await persist(next,refreshId?"Planning bijgewerkt met het actuele recept.":count>1?`${count} taken met berekende halffabricaten ingepland.`:"Taak toegevoegd.",command,refreshId);
      if(!error) {setModal(null);navigate("planning");const dep=DEPARTMENTS.find(d=>d.id===command.task.departmentId)!;chooseBoard(dep.board);setWeek(mondayOf(command.task.date));setDay(command.task.date);}
      return error;
    }catch(error){return(error as Error).message;}
  }
  async function updateWedding(order:WeddingProductionOrder,date:string,status:TaskStatus) {
    if(savingRef.current)return "Wacht tot de vorige wijziging is opgeslagen.";
    if(demo){try{return await persist(scheduleWedding(state,order,date,status),"Bruidstaartplanning opgeslagen.");}catch(e){return (e as Error).message;}}
    savingRef.current=true;setSaving(true);
    try{const response=await fetch("/api/productie/weddings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:order.code,date,status,revision:revisionRef.current})}),data=await response.json();if(!response.ok)throw Error(data.message || "Opslaan is mislukt.");revisionRef.current=data.revision;setState(data.state);setSyncedAt(data.updatedAt);notify("Bruidstaartplanning opgeslagen.");}
    catch(e){const message=(e as Error).message;notify(message,true);return message;}finally{savingRef.current=false;setSaving(false);}
  }
  const offerWeek = mondayOf(today);
  const canBakery=!live || live.departments.some(department=>department!=="ijs" && department!=="chocolade");
  const availableBoards=BOARDS.filter(b=>!live || departmentsFor(b.id).some(d=>live.departments.includes(d.id)));
  const selectedTask=modal?.type==="detail" ? state.tasks.find(t=>t.id===modal.id) : undefined;
  const selectedTaskItem=selectedTask ? state.items.find(i=>i.id===selectedTask.itemId) : undefined;
  const selectedItem=modal?.type==="item-detail" ? state.items.find(i=>i.id===modal.id) : undefined;
  const quickRecipeSource = state.items.find(item => item.id === quickRecipeItem);
  const canonicalRecipe = quickRecipeSource && recipeList.find(recipe => quickRecipeSource.id === `recipe:${recipe.id}`);
  const quickRecipeView = quickRecipeSource && !quickRecipeSource.recipeId && canonicalRecipe
    ? { ...quickRecipeSource, recipeId: canonicalRecipe.id }
    : quickRecipeSource;
  async function connectRecipe(id:string,recipeId:string) {
    try { return await persist(linkRecipe(state,id,recipeId,recipeList),"Recept gekoppeld; eerdere taken blijven behouden."); }
    catch(e) { return (e as Error).message; }
  }
  async function updateItem(id:string,changes:Partial<Item>) {
    if (changes.name !== undefined) {
      const name = changes.name.trim();
      if (!name || name.length > 120) return "Vul een naam van maximaal 120 tekens in.";
      if (state.items.some(item=>item.id!==id && item.name.trim().toLocaleLowerCase("nl-NL")===name.toLocaleLowerCase("nl-NL"))) return "Deze naam bestaat al. Kies een andere naam.";
      changes = {...changes,name};
    }
    return persist({...state,items:state.items.map(i=>i.id===id?{...i,...changes,departmentUnconfirmed:false}:i)},"Onderdeel bijgewerkt.");
  }
  const style = { "--days": days.length } as CSSProperties;

  function taskCard(task: Task) {
    const item = state.items.find(i => i.id === task.itemId)!;
    const group = taskGroups.get(task.id);
    const issues = taskIssues(task, state.tasks,state.items);
    if(recipeUpdates.has(task.id))issues.push("Recept gewijzigd · controleer de planning.");
    return <article key={task.id} className={`${s.taskCard} ${s[`task_${task.status}`]}`} draggable={canManage && !saving && task.status !== "done"} onDragStart={e => { e.dataTransfer.setData("text/plain", task.id); e.dataTransfer.effectAllowed = "move"; setDragged(task.id); }} onDragEnd={() => setDragged(null)}>
      <button disabled={saving || !!task.stockFulfillmentId} className={s.taskCheck} aria-label={`${task.stockFulfillmentId ? "Uit voorraad" : task.status === "done" ? "Heropen" : "Afronden"}: ${item.name} · ${task.operation}`} aria-pressed={task.status === "done"} onClick={() => changeStatus(task.id, task.status === "done" ? "planned" : "done")}>{task.status === "done" ? <Icon name="check" size={12} /> : task.status === "active" ? <Icon name="play" size={12} /> : null}</button>
      <button className={s.taskOpen} onClick={() => setModal({ type: "detail", id: task.id })} aria-label={`Open ${quantity(task.quantity)} ${item.unit} ${item.name} · ${task.operation}`}>
        <strong data-fit-text><span data-fit-word>{quantity(task.quantity)}{item.unit === "stuks" ? "×" : ` ${item.unit}`}</span> {item.name.split(/\s+/).map((word,i)=><span data-fit-word key={i}>{word}{" "}</span>)}</strong>
        <span>{task.operation}</span>
        <small>{task.stockFulfillmentId && "Uit voorraad"}{task.status==="active"&&<><WorkClock state={state} taskId={task.id}/>{!state.productionWork?.timers?.[task.id]&&"Bezig"}</>}{task.status==="blocked"&&"Controleren"}{issues.length>0&&<span className={s.taskWarning} title={issues.join(" ")}><Icon name="warning" size={12}/></span>}</small>
      </button>
      {group && <button type="button" className={`${s.recipeGroup} ${s[`recipeGroupTone${group.tone}`]}`} title={`Hoort bij ${group.name}`} aria-label={`${group.label} · Hoort bij ${group.name}`} onClick={() => setModal({type:"detail",id:group.rootId})}><Icon name="link" size={10}/>{group.label}</button>}
      {item.kind!=="activity"&&!item.recipeId&&<div className={s.recipeNudge}><button title="Recept aanvullen" aria-label={`Recept aanvullen: ${item.name}`} type="button" disabled={saving||!!live&&!live.departments.includes(item.departmentId)} onClick={()=>{setQuickRecipeTask(task.id);setQuickRecipeItem(item.id);}}><Icon name="warning" size={16}/></button></div>}
    </article>;
  }

  return <WorkspaceContext.Provider value={{demo,recipes:recipeList,canManage,saving}}><div ref={frameRef} className={screenFit?s.screenFrame:undefined}><div ref={workspaceRef} className={`${s.root} ${screenFit?s.worksheetRoot:""} ${wall ? s.wall : ""} ${screenFit?s.screenFit:""} ${largeText ? s.largeText : ""}`} style={style} data-production-preview={demo || undefined} aria-busy={saving}>
    {!wall && <ProductionNavigation active={view} boards={availableBoards} canManage={canManage} canManageData={canManageData} canBakery={canBakery} demo={demo} activeBoard={board} onNavigate={navigate} onBoard={id=>{navigate("planning");chooseBoard(id);}} />}

    <main className={s.main} data-production-content={view!=="planning"?"":undefined}><div className={s.fitCanvas}>
      {view!=="planning" && <><div className={s.previewBar}><span><i />{demo ? "Preview · voorbeeldgegevens" : "STRAK gepland · gedeelde werkversie"}</span><span>{demo ? (storageError ? "Bewaren niet mogelijk · wijzigingen vervallen bij herladen" : "Wijzigingen blijven alleen in deze browser") : saving ? "Bezig met opslaan…" : `Opgeslagen in Supabase · bijgewerkt ${syncedAt ? new Intl.DateTimeFormat("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"}).format(new Date(syncedAt)) : ""}`}</span>{demo ? <button onClick={() => setModal({ type: "reset" })}>Herstel voorbeeld</button> : <button disabled={saving} onClick={()=>void onRefresh?.()}>Verversen</button>}</div>
      <header className={s.header}><div className={s.heading}><span className={s.eyebrow}>STRAK gepland{wall ? " · SCHERMMODUS" : ""}</span><h1>{NAV.find(n => n.id === view)?.label || "Instellingen"}</h1></div>
        <div className={s.headerActions}>{(view === "catalog" || view === "recipes") && canManage && <button className={s.primaryButton} onClick={() => setModal({ type: "item" })}><Icon name="plus" />Los onderdeel toevoegen</button>}</div>
      </header></>}

      <ProductionMobileNavigation active={view} canManage={canManage} canManageData={canManageData} canBakery={canBakery} demo={demo} onNavigate={navigate} />

      {view === "planning" ? <>
        <header className={s.planningActions} aria-label="Planningacties"><h1 className={s.srOnly}>Weekplanning · STRAK gepland</h1>
          <ProductionStaffing compact week={week} canManage={canManage} demo={demo} onSettingsSaved={onRefresh}/>
          <div className={s.screenActions}><button className={s.secondaryButton} aria-pressed={wall} onClick={()=>setWall(!wall)}><Icon name="screen" size={17}/>XL weergave</button><button className={s.secondaryButton} aria-label="Volledig scherm" title="Volledig scherm" onClick={()=>void fullscreen()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg></button>{canManage&&<button className={s.primaryButton} onClick={()=>setModal({type:"task",date:day,departmentId:visibleDepartments[0]?.id})}><Icon name="plus" size={17}/>Inplannen</button>}</div>
        </header>
        <section className={s.plannerToolbar} aria-label="Week en filters"><div className={s.weekPicker}><button aria-label="Vorige week" onClick={() => shiftWeek(-1)} className={s.previous}><Icon name="chevron" size={16} /></button><div><strong>Week {weekNumber(week)}</strong><span>{weekLabel(week)}</span></div><button aria-label="Volgende week" onClick={() => shiftWeek(1)}><Icon name="chevron" size={16} /></button><button className={s.thisWeek} onClick={() => { setWeek(demo ? DEMO_WEEK : mondayOf(today)); setDay(today); }}>{demo ? "Voorbeeldweek" : "Deze week"}</button></div>
          <div className={`${s.plannerFilters} ${showFilters ? s.filtersExpanded : ""}`}><label><span className={s.srOnly}>Planning</span><select value={board} onChange={e => chooseBoard(e.target.value as BoardId)}>{availableBoards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button className={s.mobileFilterToggle} aria-label="Toon of verberg filters" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><Icon name="settings" size={16} /></button><label className={s.extraFilter}><span className={s.srOnly}>Afdeling</span><select value={department} onChange={e => setDepartment(e.target.value as DepartmentId | "all")}><option value="all">Alle afdelingen</option>{boardDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className={s.extraFilter}><span className={s.srOnly}>Taakstatus</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Alle taken</option><option value="open">Nog te doen</option><option value="active">Bezig</option><option value="attention">Aandacht nodig</option><option value="done">Afgerond</option></select></label>{wall && <button className={s.textSize} title="Tekstgrootte" aria-label="Tekstgrootte" onClick={() => setLargeText(!largeText)} aria-pressed={largeText}>A<span>A</span></button>}</div>
          <div className={s.plannerMeta}>{updatePending&&<span role="status" className={s.updatePending} title="Wordt bijgewerkt zodra niemand invoert of opslaat en het scherm één minuut niet is gebruikt.">Nieuwe versie klaar</span>}<span className={s.weekProgress} title={`${done} van ${weekTasks.length} taken klaar`}>{done}/{weekTasks.length} klaar</span><button title={`${attention.length} aandachtspunt${attention.length===1?"":"en"}`} aria-label={`${attention.length} aandachtspunt${attention.length===1?"":"en"}`} onClick={()=>setModal({type:"attention"})} className={attention.length?s.attentionButton:s.quietButton}><Icon name="warning" size={14}/>{attention.length}</button>
            <details className={s.syncDetails}><summary title="Opslag en verversen"><span className={s.liveDot}/><span role="status">{demo?(storageError?"Opslagfout":"Preview"):saving?"Opslaan…":"Opgeslagen"}</span></summary><div>{demo?<><p>{storageError?"Bewaren niet mogelijk · wijzigingen vervallen bij herladen":"Voorbeeldgegevens · wijzigingen blijven alleen in deze browser"}</p><button onClick={()=>setModal({type:"reset"})}>Herstel voorbeeld</button></>:<><p>Opgeslagen in Supabase{syncedAt?` · bijgewerkt ${new Intl.DateTimeFormat("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"}).format(new Date(syncedAt))}`:""}</p><button disabled={saving} onClick={()=>void onRefresh?.()}>Verversen</button></>}</div></details>
          </div>
        </section>
        <div className={s.mobileDays} role="group" aria-label="Kies dag">{days.map(d => <button key={d} data-today={d===today || undefined} aria-pressed={day === d} onClick={() => setDay(d)}>{dateLabel(d)}</button>)}</div>
        <div className={s.mobileRhythm}><DayRhythm board={board} date={day}/></div>
        <div className={s.plannerWithRequests}><div className={s.plannerBoardColumn}>
        <section className={s.board} aria-label="Weekbord">
          <div className={s.boardHeader}><div className={s.departmentColumn}/>{days.map(d => <div key={d} className={`${s.dayHeading} ${d === today ? s.today : ""}`}><div><strong>{dateLabel(d)}</strong>{d===today&&<span>Vandaag</span>}</div><DayRhythm board={board} date={d}/></div>)}</div>
          {visibleDepartments.map(dep => {
            if(dep.id==="bruidstaarten")return <WeddingWeekLane key={dep.id} week={week} days={days} day={day} today={today} state={state} canManage={canManage} saving={saving} demo={demo} statusFilter={statusFilter} Dialog={ModalFrame} onUpdate={updateWedding}/>;
            const tasks = filtered.filter(t => t.departmentId === dep.id);
            const total = tasks.reduce((sum, t) => sum + (t.minutes || 0), 0);
            return <div className={`${s.departmentRow} ${s[`tone_${dep.tone}`]}`} data-department={dep.id} key={dep.id}>
              <div className={s.departmentLabel} title={`${dep.name} · ${tasks.filter(t=>t.status==="done").length}/${tasks.length} klaar · ${durationLabel(total)} gepland`}><span className={s.departmentMark} /><h2>{dep.name}</h2><span>{tasks.filter(t => t.status === "done").length}/{tasks.length} klaar</span><small><Icon name="clock" size={12} />{durationLabel(total)} gepland</small></div>
              {days.map(d => <div key={d} className={`${s.dayCell} ${d === day ? s.mobileSelectedDay : ""} ${d === today ? s.todayCell : ""} ${dragged ? s.dropTarget : ""}`} onDragOver={e => { if (canManage && !saving && dragged) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }} onDrop={e => { e.preventDefault(); if (canManage && !saving && dragged) move(dragged, d, dep.id); }} aria-label={`${dep.name} · ${dateLabel(d, true)}`}>
                {tasks.filter(t => t.date === d).map(taskCard)}
                {canManage && <button className={s.cellAdd} aria-label={`Taak toevoegen · ${dep.name} · ${dateLabel(d, true)}`} onClick={() => setModal({ type: "task", date: d, departmentId: dep.id })}><Icon name="plus" size={14} /><span>Toevoegen</span></button>}
                {wall && !canManage && !tasks.some(t => t.date === d) && <span className={s.emptyCell}>—</span>}
              </div>)}
            </div>;
          })}
          {board==="patisserie" && department==="all" && <CleaningWeekLane days={days} day={day} today={today} rows={state.cleaning || []} canManage={canManage} canCheck={!live || live.departments.some(id=>departmentsFor("patisserie").some(d=>d.id===id))} saving={saving} statusFilter={statusFilter} selected={modal?.type==="cleaning"?modal:null} Dialog={ModalFrame} onOpen={selection=>setModal(selection?{type:"cleaning",...selection}:null)} onCommand={clean}/>}
        </section>
        <footer className={s.boardFooter}><span><i />Gepland <i className={s.activeLegend} />Bezig <i className={s.doneLegend} />Klaar <i className={s.blockedLegend} />Geblokkeerd</span><span>{canManage ? "Sleep om te verplaatsen · open een taak om te wijzigen" : "Open een taak voor details en status"}</span>{!weekend && (weekTasks.some(t => t.date === end) || (board==="patisserie" && state.cleaning?.some(d=>d.date===end))) && <button onClick={() => setWeekend(true)}>Zondag heeft taken · toon zondag</button>}</footer>
        </div><aside className={s.planningRail}>{live?<ProductionRequests compact board={board} week={week} onPlanned={onRefresh}/>:<div className={s.demoRequests}>Productieverzoeken<button aria-label="Nieuw productieverzoek" onClick={()=>setModal({type:"item"})}><Icon name="plus"/></button></div>}{canBakery && <ProductionWeekOffer key={offerWeek} offers={live?.weeklyOffers} week={offerWeek} paused={!!modal || !!quickRecipeItem} onOpen={(selectedWeek, offer) => setModal({type:"offer",week:selectedWeek,imageUrl:offer.imageUrl,label:offer.label})} onManage={canManageData ? selectedWeek => setModal({type:"offer-manage",week:selectedWeek}) : undefined}/>}</aside></div>
      </> : view === "catalog" ? <>
        <div className={s.sectionIntro}><p>Alles wat je maakt, ook zonder uitgewerkt recept.</p><span>{state.items.filter(i=>i.kind==="product").length} eindproducten · {state.items.filter(i=>i.kind==="component").length} halffabricaten</span></div>
        <div className={s.listToolbar}><Search value={query} onChange={setQuery} placeholder="Zoek op naam of artikelnummer…" /><select aria-label="Type onderdeel" value={kindFilter} onChange={e => setKindFilter(e.target.value)}><option value="all">Alle typen</option><option value="product">Eindproducten</option><option value="component">Halffabricaten</option><option value="activity">Werkzaamheden</option></select><DepartmentSelect value={department} onChange={setDepartment} /></div>
        <div className={s.catalogList}><div className={s.listHeader}><span>Eindproduct / halffabricaat</span><span>Afdeling</span><span>Recept</span><span /></div>{catalog.map(item => <div className={s.catalogRow} key={item.id}><button className={s.itemName} onClick={() => setModal({ type: "item-detail", id: item.id })}><span className={`${s.itemGlyph} ${s[`tone_${DEPARTMENTS.find(d => d.id === item.departmentId)!.tone}`]}`}><Icon name={item.kind === "activity" ? "clock" : item.kind === "component" ? "box" : "book"} /></span><span><strong>{item.name}</strong><small><span className={`${s.typeBadge} ${item.kind==="component"?s.halfBadge:s.finalBadge}`}>{KIND_LABELS[item.kind]}</span> · {item.unit}{item.productionBlocked && " · Recept controleren"}{item.articleNumber && ` · ${item.articleNumber}`}</small></span></button><span className={s.catalogDepartment}>{item.departmentUnconfirmed ? "Afdeling controleren" : departmentName(item.departmentId)}</span><span className={item.recipeId ? s.recipeLinked : s.recipeMissing}>{item.recipeId ? <><Icon name="link" size={13} />Gekoppeld</> : item.kind==="activity"?"Werkinstructie":<span className={s.recipeMissingBadge}>Zonder recept</span>}</span><button disabled={!canManage || saving || item.productionBlocked} className={s.planButton} onClick={() => setModal({ type: "task", itemId: item.id, departmentId: item.departmentId, date: day })}><Icon name="plus" size={14} />Inplannen</button></div>)}{catalog.length === 0 && <Empty title="Geen onderdelen gevonden" text="Pas de zoekopdracht of filters aan." />}</div>
      </> : view === "recipes" ? <>
        <div className={s.sectionIntro}><p>Zoek een werkrecept of los onderdeel. Hoeveelheden worden op de productiekaart omgerekend.</p>{!demo && canManageData && <Link className={s.secondaryButton} href="/bakkerij/productie/beheer/recepten">Recepten beheren</Link>}</div>
        <div className={s.listToolbar}><Search value={query} onChange={setQuery} placeholder="Zoek naam, artikel, ingrediënt of instructie…"/><select aria-label="Type recept" value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="all">Alle recepten & onderdelen</option><option value="product">Eindproducten</option><option value="component">Halffabricaten</option><option value="activity">Werkzaamheden</option><option value="unlinked">Zonder recept</option><option value="incomplete">Recept aanvullen</option></select><DepartmentSelect value={department} onChange={setDepartment}/></div>
        <div className={s.workRecipeList}><div className={s.workRecipeHeading}><span>Recept / onderdeel</span><span>Afdeling</span><span>Basisopbrengst</span><span>Inhoud</span></div>{state.items.filter(item=>{
          const recipe=recipeList.find(r=>r.id===item.recipeId);
          return !item.id.startsWith("wedding:") && (department==="all" || item.departmentId===department) && (kindFilter==="all" || (kindFilter==="unlinked"?!recipe&&item.kind!=="activity":kindFilter==="incomplete"?!!recipe&&(!recipe.yield||!recipe.ingredients.length||!recipe.steps.length):item.kind===kindFilter)) && matchesProductionSearch(query,[item.name,item.articleNumber,item.note,...(recipe?.ingredients.map(i=>i.name) || []),...(recipe?.steps || [])]);
        }).sort((a,b)=>a.name.localeCompare(b.name,"nl-NL")).map(item=>{const recipe=recipeList.find(r=>r.id===item.recipeId);return <button key={item.id} className={s.workRecipeRow} onClick={()=>setModal({type:"item-detail",id:item.id})}><span><strong>{item.name}</strong><small><span className={`${s.typeBadge} ${item.kind==="component"?s.halfBadge:s.finalBadge}`}>{KIND_LABELS[item.kind]}</span>{item.articleNumber && ` · ${item.articleNumber}`}{item.productionBlocked && " · Recept controleren"}{!recipe && item.kind!=="activity" && <span className={s.recipeMissingBadge}>Zonder recept</span>}{recipe && !recipe.ingredients.length && <span className={s.recipeMissingBadge}>Leeg recept</span>}</small></span><span className={s.workRecipeDepartment}>{departmentName(item.departmentId)}</span><span>{recipe?.yield?`${quantity(recipe.yield)} ${recipe.unit}`:recipe?"Nog invullen":"—"}</span><span className={s.workRecipeContents}>{recipe?`${recipe.ingredients.length} ingrediënten · ${recipe.steps.length} stappen`:item.kind==="activity"?"Werkinstructie":"Koppelen of nieuw recept"}<Icon name="chevron" size={14}/></span></button>;})}</div>
      </> : view === "ingredients" ? <>
        <div className={s.sectionIntro}><p>Gedeelde grondstoffen en leveranciersspecificaties voor alle afdelingen.</p><span>SpecsPlaza</span></div>
        <div className={s.infoNote}><Icon name="link" /><p>{demo ? "Voorbeeld van de bestaande SpecsPlaza-koppeling." : "Specificaties worden gedeeld met het grondstoffenbeheer."} {canManageData && <Link href="/bakkerij/productie/beheer/ingredienten">Open grondstoffenbeheer</Link>}</p></div>
        <div className={s.ingredientList}>{ingredientList.map(i => <article key={i.id}><div className={s.itemGlyph}><Icon name="leaf" /></div><div><h2>{i.name}</h2><p>{i.supplier} · {i.unit}</p></div><div className={s.ingredientSpec}><span className={i.linked ? s.recipeLinked : s.recipeMissing}>{i.linked && <Icon name="link" size={13} />}{i.specification}</span><small>{demo ? "Voorbeeld allergenen" : "Allergenen"}: {i.allergens}</small></div></article>)}</div>
      </> : view === "stock" ? live ? <ProductionInventory/> : <>
        <div className={s.sectionIntro}><p>{demo ? "Voorbeeldvoorraad plus afgeronde productie." : "Hier staan je productieregistraties. Een actuele voorraad is nog niet aangesloten."} Werkelijke voorraad vraagt ook registratie van verbruik en uitgifte.</p></div>
        <div className={s.listToolbar}><Search value={query} onChange={setQuery} placeholder="Zoek een product of onderdeel…" /><DepartmentSelect value={department} onChange={setDepartment} /></div>
        <div className={s.stockTable}><div className={s.stockHeader}><span>Product / onderdeel</span><span>Startvoorraad</span><span>Geproduceerd</span><span>{demo ? "Voorbeeldtotaal" : "Voorraad"}</span></div>{catalog.filter(i => i.kind !== "activity").map(i => <div className={s.stockRow} key={i.id}><button onClick={() => setModal({ type: "item-detail", id: i.id })}><strong>{i.name}</strong><small>{departmentName(i.departmentId)} · {i.unit}</small></button><span>{!demo && !i.stockKnown ? "Onbekend" : quantity(i.stock)}</span><span className={s.recipeLinked}>+{quantity(output.get(i.id) || 0)}</span><strong>{!demo && !i.stockKnown ? "Onbekend" : quantity(i.stock + (output.get(i.id) || 0))} <small>{i.unit}</small></strong></div>)}</div>
      </> : <>
        <div className={s.settingsGrid}><section className={s.settingCard}><Icon name="screen" size={24} /><h2>Jouw weekbord</h2><p>Pas het bord aan voor de werkplek of het grote scherm.</p><label className={s.checkboxRow}><input type="checkbox" checked={weekend} onChange={e => setWeekend(e.target.checked)} /><span>Zondag ook tonen</span></label><label className={s.checkboxRow}><input type="checkbox" checked={largeText} onChange={e => setLargeText(e.target.checked)} /><span>Grotere tekst in het weekbord</span></label><button className={s.secondaryButton} onClick={() => { navigate("planning"); setWall(true); }}><Icon name="screen" />Open XL-schermstand</button></section><section className={s.settingCard}><Icon name="box" size={24} /><h2>{demo ? "Van preview naar productie" : "Werkversie in gebruik"}</h2><p>{demo ? "Deze versie gebruikt uitsluitend voorbeeldgegevens en bewaart je aanpassingen lokaal." : "Je planning en onderdelen worden gedeeld opgeslagen. Bestellingen, verbruik en verkoopprognoses worden in volgende stappen aangesloten."}</p><ol><li>Weekbord en werkwijze samen beoordelen.</li><li>Recepten, grondstoffen en koppelingen controleren en overzetten.</li><li>Met één afdeling testen en daarna uitbreiden.</li><li>Bestellingen, voorraad en verkoopgegevens aansluiten.</li></ol>{demo ? <button className={s.textLink} onClick={() => setModal({ type: "reset" })}>Voorbeeldgegevens herstellen</button> : canManageData && <Link className={s.textLink} href="/bakkerij/productie/beheer/recepten">Receptuurgegevens beheren</Link>}</section></div>
        {live && canManageData && <ProductionWeekArchive/>}
        {live?.canManageScreenMessages&&<section className={s.settingCard}><Icon name="screen" size={24}/><h2>Schermberichten</h2><Link className={s.secondaryButton} href="/bakkerij/productie/schermberichten">Bericht voor de bakkerij klaarzetten<Icon name="arrow"/></Link></section>}
        {canManage && !!state.removedTasks?.length && <section className={s.settingCard}><h2>Verwijderde taken</h2><p>Geplande taken blijven herstelbaar. Recepten en onderdelen zijn behouden.</p><div className={s.removedTaskList}>{[...state.removedTasks].reverse().map(({task})=><div key={task.id}><span><strong>{state.items.find(i=>i.id===task.itemId)?.name}</strong><small>{dateLabel(task.date,true)} · {task.operation}</small></span><button disabled={saving} className={s.secondaryButton} onClick={()=>void restore(task.id)}>Herstellen</button></div>)}</div></section>}
      </>}
    </div></main>
    {message && <div className={`${s.toast} ${notificationError ? s.errorToast : ""}`} role="status"><Icon name={notificationError ? "warning" : "check"} /><span>{message}</span><button onClick={() => setMessage("")} aria-label="Melding sluiten"><Icon name="close" size={16} /></button></div>}
    {view==="planning"&&live?.screenAccount&&<BakeryScreenMessages blocked={saving||!!modal||!!quickRecipeItem||!!dragged||!connectionHealthy}/> }
    {quickRecipeView&&<ModalFrame title={quickRecipeView.recipeId?"Werkrecept aanpassen":"Recept snel invoeren"} subtitle={quickRecipeView.name} onClose={()=>setQuickRecipeItem(null)}><div className={s.dialogBody}>{live?<QuickRecipeForm key={`${quickRecipeItem}:${quickRecipeTask}`} taskId={quickRecipeTask} item={quickRecipeView} ingredients={ingredientList} getRevision={()=>revisionRef.current} recipeRevision={live.recipeRevision} onSaved={onRefresh||(()=>Promise.resolve())} onClose={()=>setQuickRecipeItem(null)}/>:<p>In de live omgeving kun je hier de basisopbrengst, grondstoffen en werkwijze vastleggen.</p>}</div></ModalFrame>}
    {modal?.type==="offer" && <ModalFrame wide title={`Weekaanbieding · week ${weekNumber(modal.week)}`} subtitle={modal.label} onClose={()=>setModal(null)}><div className={s.dialogBody}><img className={s.offerFull} src={modal.imageUrl} alt={`Weekaanbieding week ${weekNumber(modal.week)}`}/></div><footer className={s.dialogFooter}><button className={s.primaryButton} onClick={()=>setModal(null)}>Terug naar het bord</button></footer></ModalFrame>}
    {modal?.type==="offer-manage" && canManageData && <ModalFrame wide title="Weekaanbieding beheren" onClose={()=>{setModal(null);void onRefresh?.();}}><div className={`${s.dialogBody} ${s.resourceSurface}`}><OfferManager embedded hideTopNav initialTab="beheer" lockedTab="beheer" initialBeheerView="voorpagina" initialOfferWeek={modal.week}/></div><footer className={s.dialogFooter}><button className={s.primaryButton} onClick={()=>{setModal(null);void onRefresh?.();}}>Terug naar het bord</button></footer></ModalFrame>}
    {modal?.type === "task" && <TaskForm onRecipe={itemId=>{setQuickRecipeTask(undefined);setQuickRecipeItem(itemId);}} onNewItem={()=>setModal({type:"item",returnTo:{date:modal.date,departmentId:modal.departmentId}})} state={state} initial={modal} today={today} onClose={() => setModal(null)} onPlan={command=>plan(command,modal.refreshId)} />}
    {modal?.type === "item" && <ItemForm state={state} onClose={() => setModal(null)} onSave={async next => { const error=await persist(next,"Onderdeel toegevoegd. Je kunt het direct inplannen."); if (!error) setModal(modal.returnTo?{type:"task",...modal.returnTo,itemId:next.items.at(-1)?.id}:null); return error; }} />}
    {selectedTask && selectedTaskItem && <TaskDetail onItem={()=>setModal({type:"item-detail",id:selectedTaskItem.id})} onRecipe={()=>{setModal(null);setQuickRecipeTask(selectedTask.id);setQuickRecipeItem(selectedTaskItem.id);}} onWork={work} key={selectedTask.id} task={selectedTask} item={selectedTaskItem} state={state} onClose={() => setModal(null)} onStatus={status => changeStatus(selectedTask.id, status)} onMove={move} onRemove={whole=>remove(selectedTask.id,whole)} onRefreshPlan={()=>setModal({type:"task",refreshId:selectedTask.id,itemId:selectedTask.itemId,date:selectedTask.date,departmentId:selectedTask.departmentId})} onOpenTask={id=>setModal({type:"detail",id})} onNext={() => setModal({ type: "task", date: selectedTask.date, departmentId: selectedTask.departmentId, itemId: selectedTask.itemId, priorId: selectedTask.id })} />}
    {selectedItem && <ItemDetail onRecipe={()=>{setModal(null);setQuickRecipeTask(undefined);setQuickRecipeItem(selectedItem.id);}} key={`${selectedItem.id}:${selectedItem.recipeId || "loose"}`} item={selectedItem} state={state} onClose={()=>setModal(null)} onPlan={()=>setModal({type:"task",itemId:selectedItem.id,departmentId:selectedItem.departmentId,date:day})} onLink={recipeId=>connectRecipe(selectedItem.id,recipeId)} onUpdate={changes=>updateItem(selectedItem.id,changes)}/>}
    {modal?.type === "attention" && <ModalFrame title="Aandacht deze week" subtitle={`${BOARDS.find(b => b.id === board)?.name} · week ${weekNumber(week)}`} onClose={() => setModal(null)}><div className={s.dialogBody}>{attention.length ? attention.map(t => <button className={s.attentionRow} key={t.id} onClick={() => setModal({ type: "detail", id: t.id })}><Icon name="warning" /><span><strong>{state.items.find(i => i.id === t.itemId)?.name}</strong><small>{dateLabel(t.date, true)} · {[...(recipeUpdates.has(t.id)?["Recept gewijzigd · controleer de planning."]:[]),...taskIssues(t, state.tasks,state.items)].join(" ")}</small></span><Icon name="chevron" size={16} /></button>) : <Empty title="Geen aandachtspunten" text="Alle taken in deze voorbeeldweek kunnen volgens de huidige planning doorlopen." />}</div></ModalFrame>}
    {modal?.type === "reset" && <ModalFrame title="Voorbeeld herstellen?" onClose={() => setModal(null)}><div className={s.dialogBody}><p>Je lokale wijzigingen aan dit productievoorbeeld worden vervangen door de oorspronkelijke voorbeeldweek. Live gegevens worden niet geraakt.</p></div><footer className={s.dialogFooter}><button className={s.secondaryButton} onClick={() => setModal(null)}>Annuleren</button><button className={s.primaryButton} onClick={() => { setState(initialPreviewState()); setModal(null); setWeek(DEMO_WEEK); setDay(DEMO_TODAY); notify("Oorspronkelijke voorbeeldweek hersteld."); }}>Herstel voorbeeld</button></footer></ModalFrame>}
  </div></div></WorkspaceContext.Provider>;
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) { return <label className={s.search}><Icon name="search" /><span className={s.srOnly}>{placeholder}</span><input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>; }
function DepartmentSelect({ value, onChange }: { value: string; onChange: (v: DepartmentId | "all") => void }) { return <select aria-label="Afdeling" value={value} onChange={e => onChange(e.target.value as DepartmentId | "all")}><option value="all">Alle afdelingen</option>{DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className={s.empty}><Icon name="box" size={28} /><h2>{title}</h2><p>{text}</p></div>; }

function TaskForm({ state, initial, today, onClose, onPlan, onNewItem, onRecipe }: { onRecipe:(itemId:string)=>void; onNewItem:()=>void; state: PreviewState; initial: NonNullable<Extract<Modal, { type: "task" }>>; today:string; onClose: () => void; onPlan:(command:PlanCommand)=>Promise<string|undefined> }) {
  const {recipes:recipeList,saving}=useContext(WorkspaceContext);
  const refreshing=state.tasks.find(t=>t.id===initial.refreshId);
  const settings=refreshing?currentPlanCommand(state,refreshing):undefined;
  const [error,setError]=useState("");
  const [itemId,setItemId]=useState(initial.itemId || "");
  const [filter,setFilter]=useState("all");
  const [amount,setAmount]=useState(String(settings?.amount || state.tasks.find(t=>t.id===initial.priorId)?.quantity || 1));
  const [amountMode,setAmountMode]=useState<"quantity"|"batches">(settings?.amountMode || "quantity");
  const [date,setDate]=useState(initial.date || today);
  const [departmentId,setDepartmentId]=useState<DepartmentId>(initial.departmentId || "dessert");
  const [includePreparation,setIncludePreparation]=useState(()=>{
    const selected=state.items.find(i=>i.id===initial.itemId),recipe=recipeList.find(r=>r.id===selected?.recipeId);
    return refreshing?!!settings?.preparation:!initial.priorId && !!recipe?.semiFinishedItems?.length && recipe.yield>0;
  });
  const [customOperation,setCustomOperation]=useState<string|null>(refreshing ? splitTaskOperation(refreshing.operation).base : null);
  const [extraOperations, setExtraOperations] = useState<ExtraTaskOperation[]>(() => splitTaskOperation(refreshing?.operation || "").extras);
  const [estimatedMinutes, setEstimatedMinutes] = useState(refreshing?.minutes !== undefined ? String(refreshing.minutes) : "");
  const [daysBefore,setDaysBefore]=useState(settings?.preparation?.daysBefore ?? 1);
  const [choices,setChoices]=useState<Record<string,PreparationChoice>>(settings?.preparation?.choices || {});
  const item=state.items.find(i=>i.id===itemId),recipe=recipeList.find(r=>r.id===item?.recipeId);
  const pickerItems = useMemo(() => {
    const recipes = new Map(recipeList.map(candidate => [candidate.id, candidate]));
    return state.items.filter(candidate => !candidate.id.startsWith("wedding:") && (filter === "all" || candidate.kind === filter || !!initial.priorId || !!initial.refreshId)).map(candidate => ({
      ...candidate,
      searchValues: recipes.get(candidate.recipeId || "")?.ingredients.map(ingredient => ingredient.name),
    }));
  }, [state.items, recipeList, filter, initial]);
  const repairTargets = useMemo(() => {
    const seen = new Set<string>();
    const canonical = item && recipeList.find(recipe => item.id === `recipe:${recipe.id}`);
    const firstRecipe = item?.recipeId || canonical?.id;
    const queue = firstRecipe ? [firstRecipe] : [];
    for (let index = 0; index < queue.length && seen.size < 250; index++) {
      const id = queue[index];
      if (seen.has(id)) continue;
      seen.add(id);
      const linked = recipeList.find(candidate => candidate.id === id);
      for (const child of linked?.semiFinishedItems || []) queue.push(child.recipeId);
    }
    return state.items.filter(candidate => candidate.recipeId
      ? seen.has(candidate.recipeId)
      : candidate.id.startsWith("recipe:") && seen.has(candidate.id.slice(7)) && recipeList.some(recipe => recipe.id === candidate.id.slice(7)));
  }, [item, recipeList, state.items]);
  const prior=state.tasks.find(t=>t.id===initial.priorId);
  const hasPreparation=!!recipe?.semiFinishedItems?.length && !prior;
  const baseOperation=customOperation ?? plannedOperation(item?.kind,hasPreparation,!!prior);
  const operation=combineTaskOperation(baseOperation,extraOperations);
  const preview:PlanCommand={task:{id:"preview-plan",itemId,departmentId,date,operation,status:"planned",note:"",source:"manual",batchId:"preview-batch",recordsOutput:item?.kind!=="activity",...(estimatedMinutes!==""?{minutes:Number(estimatedMinutes)}:{}),...(prior?{dependsOn:prior.id}:{})},amount:Number(amount),amountMode,
    ...(includePreparation && hasPreparation?{preparation:{daysBefore,choices}}:{})};
  const proposal=preparationProposal(state,recipeList,preview);
  const review=refreshing?recipePlanChanges(state,recipeList,refreshing,preview):undefined;
  const existingOutput=prior && state.tasks.some(t=>t.batchId===prior.batchId && t.recordsOutput);
  const updateChoice=(id:string,change:PreparationChoice)=>{setError("");setChoices(current=>({...current,[id]:{...current[id],...change}}));};
  function chooseItem(id:string) {
    setItemId(id);setAmount("1");setAmountMode("quantity");setCustomOperation(null);setExtraOperations([]);setEstimatedMinutes("");setChoices({});setError("");
    const selected=state.items.find(i=>i.id===id),recipe=recipeList.find(r=>r.id===selected?.recipeId);
    setIncludePreparation(!initial.priorId && !!recipe?.semiFinishedItems?.length && !!recipe && recipe.yield>0);
  }
  function editRecipe(id: string) {
    setError("");
    onRecipe(id);
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(proposal.errors.length){setError(proposal.errors[0]);return;}
    const data=new FormData(event.currentTarget),id=refreshing?.id || newId("task");
    const command:PlanCommand={...preview,task:{id,itemId,departmentId,date,operation,status:"planned",note:String(data.get("note")),source:data.get("source") as Task["source"],batchId:refreshing?.batchId || prior?.batchId || `batch-${id}`,recordsOutput:refreshing?refreshing.recordsOutput:item?.kind!=="activity" && data.get("output")==="on",
      ...(estimatedMinutes!==""?{minutes:Number(estimatedMinutes)}:{}),...(String(data.get("dueDate"))?{dueDate:String(data.get("dueDate"))}:{}),...(prior?{dependsOn:prior.id}:{})}};
    setError(await onPlan(command) || "");
  }
  return <ModalFrame title={refreshing?"Planning bijwerken":prior?"Volgende productiestap":"Taak toevoegen"} subtitle={prior?`Aansluitend op: ${prior.operation} · ${dateLabel(prior.date,true)}`:"Kies een product, aantal en gewenste productiedatum."} onClose={onClose}>
    <form onSubmit={submit} onChangeCapture={()=>setError("")}><div className={s.dialogBody}>
      {!prior && !refreshing && <label className={s.field}>Toon in keuzelijst<select value={filter} onChange={e=>{setFilter(e.target.value);if(e.target.value!=="all" && item?.kind!==e.target.value)chooseItem("");}}><option value="all">Eindproducten, halffabricaten & werkzaamheden</option><option value="product">Alleen eindproducten</option><option value="component">Alleen halffabricaten</option><option value="activity">Alleen werkzaamheden</option></select></label>}
      <ProductionItemPicker required value={itemId} onChange={chooseItem} disabled={!!prior || !!refreshing} items={pickerItems}/>
      {item && item.kind!=="activity" && <button type="button" className={s.textLink} disabled={saving} onClick={()=>editRecipe(item.id)}><Icon name="book" size={14}/>{item.recipeId?"Recept aanpassen":"Recept snel invoeren"}</button>}
      {!prior&&!refreshing&&<button type="button" className={s.textLink} onClick={onNewItem}><Icon name="plus" size={14}/>Nieuw onderdeel zonder recept</button>}
      {recipe && <div className={s.amountChoice}><label className={s.field}>Invoer<select value={amountMode} onChange={e=>{setAmountMode(e.target.value as "quantity"|"batches");setAmount("1");}}><option value="quantity">Aantal {item?.unit}</option><option value="batches" disabled={!(recipe.yield>0)}>Aantal basisrecepten</option></select></label>{recipe.yield>0 && <button type="button" className={s.textLink} onClick={()=>{setError("");setAmountMode("batches");setAmount("1");}}>1 basisrecept = {quantity(recipe.yield)} {recipe.unit}</button>}</div>}
      <div className={s.formGrid}><label className={s.field}>{amountMode==="batches"?"Aantal basisrecepten":`Aantal (${item?.unit || "eenheid"})`}<input type="number" min="0.000001" max="1000000" step="any" required value={amount} onChange={e=>setAmount(e.target.value)} /></label><label className={s.field}>Afdeling<select value={departmentId} onChange={e=>setDepartmentId(e.target.value as DepartmentId)}>{DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className={s.field}>Productiedatum<input type="date" required value={date} min={prior?.date} onChange={e=>setDate(e.target.value)} /></label><label className={s.field}>Benodigd op (optioneel)<input name="dueDate" type="date" defaultValue={refreshing?.dueDate || prior?.dueDate} /></label></div>
      {item && <section className={s.taskWorkChoices} aria-label="Handelingen en tijdsinschatting">
        <div className={s.formGrid}>
          <label className={s.field}>Handeling<input name="operation" maxLength={80} required value={baseOperation} onChange={event=>setCustomOperation(event.target.value)}/></label>
          <label className={s.field}>Geschatte tijd (min, optioneel)<input name="minutes" type="number" min="0" max="1440" step="any" value={estimatedMinutes} onChange={event=>setEstimatedMinutes(event.target.value)} placeholder="Bijv. 45"/></label>
        </div>
        {item.kind!=="activity" && <TaskOperationOptions value={extraOperations} onChange={setExtraOperations}/>}
        <small className={s.fieldHint}>Totale werktijd voor deze hoeveelheid, inclusief gekozen handelingen.</small>
      </section>}
      {item && proposal.quantity>0 && !proposal.errors.length && <p className={s.calculatedAmount}><strong>{quantity(proposal.quantity)} {item.unit}</strong>{proposal.recipeCount!==undefined && ` · ${quantity(proposal.recipeCount)} × basisrecept`}</p>}
      {recipe && !(recipe.yield>0) && <p className={s.fieldHint}>Basisopbrengst ontbreekt. Aantallen kunnen handmatig worden gepland; automatisch doorrekenen kan na aanvullen van het recept.</p>}
      {!recipe && item && <p className={s.fieldHint}>Een recept is niet nodig om dit onderdeel handmatig in te plannen.</p>}
      {item?.kind==="component" && <p className={s.fieldHint}>Je plant dit halffabricaat los. Kies vandaag of een andere datum; vers afmaken op dezelfde ochtend blijft mogelijk.</p>}
      {item?.kind==="product" && hasPreparation && <p className={s.fieldHint}>Laatste stap op de gekozen productiedatum: <strong>{operation}</strong>.</p>}
      {hasPreparation && <section className={s.preparationSection}>
        <label className={s.checkboxRow}><input type="checkbox" checked={includePreparation} disabled={!(recipe!.yield>0)} onChange={e=>setIncludePreparation(e.target.checked)} /><span>Halffabricaten meeplannen<small>Automatisch berekend uit het recept. Zet uit als de onderdelen al klaarstaan, of pas de planning hieronder aan.</small></span></label>
        {includePreparation && <><label className={s.field}>Standaard dagen vooraf<input type="number" min="0" max="30" step="1" value={daysBefore} onChange={e=>setDaysBefore(Number(e.target.value))} /></label><p className={s.fieldHint}>De laatste stap van het eindproduct is decoreren / afmaken. Een genest halffabricaat komt nog een stap eerder. Je kunt iedere datum aanpassen. Uitgevinkt betekent al beschikbaar; voorraad wordt hier niet gecontroleerd.</p>
          <div className={s.preparationList}>{proposal.rows.map(row=>{const dateInvalid=row.included && row.date>row.latestDate;return <div className={`${s.preparationRow} ${!row.included?s.preparationExcluded:""} ${dateInvalid?s.preparationInvalid:""}`} key={row.recipeId}>
            <div><label className={s.preparationName}><input type="checkbox" aria-label={`Meemaken: ${row.name}`} checked={row.included} onChange={e=>updateChoice(row.recipeId,{include:e.target.checked})}/><span><strong>{row.name}</strong><small>{quantity(row.quantity)} {row.unit}{row.recipeCount>0?` · ${quantity(row.recipeCount)} × recept`:""}</small>{!row.included && <small>Al beschikbaar · geen nieuwe taak</small>}{row.departmentUnconfirmed && row.included && <small>Afdeling controleren</small>}</span></label><button type="button" className={s.textLink} disabled={saving} aria-label={`Recept aanpassen ${row.name}`} onClick={()=>editRecipe(row.itemId)}><Icon name="book" size={13}/>Recept aanpassen</button></div>
            <div className={s.preparationDate}><label className={s.field}>Datum<input type="date" aria-label={`Productiedatum ${row.name}`} aria-invalid={dateInvalid || undefined} aria-describedby={`preparation-date-${row.recipeId}`} disabled={!row.included} max={row.latestDate} value={row.date} onChange={e=>updateChoice(row.recipeId,{date:e.target.value})}/></label><small id={`preparation-date-${row.recipeId}`}>Uiterlijk {dateLabel(row.latestDate,true)}</small>{dateInvalid && <button type="button" className={s.dateRepair} onClick={()=>updateChoice(row.recipeId,{date:row.latestDate})}>Zet op {dateLabel(row.latestDate,true)}</button>}</div>
            <label className={s.field}>Afdeling<select aria-label={`Afdeling ${row.name}`} disabled={!row.included} value={row.departmentId} onChange={e=>updateChoice(row.recipeId,{departmentId:e.target.value as DepartmentId})}>{DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            {row.included && <div className={s.preparationWork}>
              <TaskOperationOptions label={`Extra handelingen ${row.name}`} value={splitTaskOperation(row.operation).extras} onChange={extras=>updateChoice(row.recipeId,{operation:combineTaskOperation(splitTaskOperation(row.operation).base,extras)})}/>
              <label className={s.field}>Geschatte tijd (min)<input aria-label={`Geschatte tijd ${row.name}`} type="number" min="0" max="1440" step="any" value={row.minutes??""} onChange={event=>updateChoice(row.recipeId,{minutes:event.target.value===""?null:Number(event.target.value)})} placeholder="Optioneel"/></label>
            </div>}
          </div>;})}</div>
          {proposal.rows.some(row=>row.included && row.date<today) && <p className={s.planWarning}>Er staat voorbereiding vóór vandaag. Controleer of je deze datums wilt aanpassen.</p>}
          {!proposal.errors.length && <p className={s.fieldHint}>Na opslaan worden {proposal.rows.filter(r=>r.included).length} voorbereidingstaken en 1 productietaak samen ingepland. De productietaak wacht op de meegeplande halffabricaten.</p>}
        </>}
      </section>}
      {review && <PlanChanges changes={review.changes}/>}
      <details className={s.planDetails}><summary>Aanvullende afspraken</summary><label className={s.field}>Herkomst<select name="source" defaultValue={refreshing?.source || prior?.source || "manual"}>{Object.entries(SOURCE_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label className={s.field}>Korte opmerking<textarea name="note" rows={2} maxLength={1000} defaultValue={refreshing?.note || ""}/></label></details>
      {item && item.kind!=="activity" && <label className={s.checkboxRow}><input name="output" type="checkbox" defaultChecked={refreshing?refreshing.recordsOutput:!existingOutput} disabled={!!existingOutput || !!refreshing}/><span>Deze stap registreert de geproduceerde hoeveelheid<small>{existingOutput?"Een andere stap van deze batch registreert de hoeveelheid al.":"Registreert het eindproduct of halffabricaat wanneer deze taak klaar is."}</small></span></label>}
      {(error || (!!item && proposal.errors.length>0)) && <div className={s.formError} role="alert"><p>{error || proposal.errors[0]}</p>{repairTargets.length>0 && <div className={s.recipeRepairLinks}>{repairTargets.map(target=><button type="button" key={target.id} disabled={saving} onClick={()=>editRecipe(target.id)}><Icon name="book" size={14}/>{target.name}</button>)}</div>}</div>}
    </div><footer className={s.dialogFooter}><button type="button" className={s.secondaryButton} onClick={onClose}>Annuleren</button><button type="submit" className={s.primaryButton} disabled={saving || !item || proposal.errors.length>0}>{saving?"Opslaan…":refreshing?"Planning bijwerken":includePreparation?"Productie met halffabricaten inplannen":"Inplannen"}</button></footer></form>
  </ModalFrame>;
}

function TaskOperationOptions({ value, onChange, label = "Extra handelingen" }: { value: ExtraTaskOperation[]; onChange: (value: ExtraTaskOperation[]) => void; label?: string }) {
  return <fieldset className={s.operationOptions}><legend>{label}</legend>{EXTRA_TASK_OPERATIONS.map(option => <label key={option.id}>
    <input type="checkbox" checked={value.includes(option.id)} onChange={event => onChange(event.target.checked ? [...value, option.id] : value.filter(id => id !== option.id))}/>{option.label}
  </label>)}</fieldset>;
}

function PlanChanges({changes}:{changes:ReturnType<typeof recipePlanChanges>["changes"]}) {
  return <div className={s.planChanges} aria-label="Vergelijking met huidige planning">{changes.length?changes.map((change,index)=><div key={index}><strong>{change.name}</strong><span>{change.before===undefined?"Nieuw":`${quantity(change.before)} ${change.unit}`} → {change.after===undefined?"Vervalt":`${quantity(change.after)} ${change.unit}`}{change.detail && <small>{change.detail}</small>}</span></div>):<p>De berekende hoeveelheden komen overeen met de planning.</p>}</div>;
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

function TaskDetail({ task, item, state, onClose, onStatus, onMove, onNext, onRemove, onRefreshPlan, onOpenTask, onRecipe, onItem, onWork }: { task: Task; item: Item; state: PreviewState; onClose: () => void; onStatus: (s: TaskStatus) => Promise<string | undefined>; onMove: (id: string, date: string, departmentId: DepartmentId) => Promise<string | undefined>; onNext: () => void; onRemove:(wholeProduction?:boolean)=>Promise<string|undefined>; onRefreshPlan:()=>void; onOpenTask:(id:string)=>void; onRecipe?:()=>void; onItem?:()=>void; onWork:(command:WorkCommand)=>Promise<string|undefined> }) {
  const [error, setError] = useState("");
  const [removing,setRemoving] = useState(false);
  const {recipes:recipeList,canManage,saving}=useContext(WorkspaceContext);
  const recipe = state.productionWork?.overrides?.[task.id]||recipeList.find(r => r.id === item.recipeId);
  const review=!task.generatedFor && !task.dependsOn?recipePlanChanges(state,recipeList,task):undefined;
  const updateBlock=recipePlanUpdateBlock(state,task);
  const issues = taskIssues(task, state.tasks,state.items);
  const following=state.tasks.filter(t=>requiredTaskIds(t).includes(task.id));
  const production=recipeProductionTasks(state.tasks,task.id),productionIds=new Set(production.map(t=>t.id));
  const externalFollowing=state.tasks.filter(t=>!productionIds.has(t.id) && requiredTaskIds(t).some(id=>productionIds.has(id)));
  const removalBlock=production.some(t=>t.status!=="planned")?"Deze productie bevat gestarte, afgeronde of geblokkeerde taken. Alleen een volledig geplande productie kan in één keer worden verwijderd.":externalFollowing.length?"Een onderdeel is ook nodig voor een andere productie. Verwijder eerst die gekoppelde vervolgstap.":"";
  const related=production.filter(t=>t.id!==task.id);
  function stepLink(step:Task,dependent=false) {
    const product=state.items.find(i=>i.id===step.itemId);
    return <button key={step.id} className={s.preparationLink} aria-label={`Open ${dependent?"gekoppelde vervolgstap":"productiestap"}: ${product?.name || step.operation} · ${step.operation} · ${dateLabel(step.date,true)}`} onClick={()=>onOpenTask(step.id)}><span><strong>{product?.name || step.operation}</strong><small>{step.operation} · {quantity(step.quantity)} {product?.unit} · {dateLabel(step.date,true)}</small></span><Icon name="chevron" size={16}/></button>;
  }
  return <ModalFrame title={`${quantity(task.quantity)} ${item.unit} ${item.name}`} subtitle={`${dateLabel(task.date, true)} · ${departmentName(task.departmentId)}`} onClose={onClose}><div className={`${s.dialogBody} ${s.taskDetailBody}`}>
    {removing ? <section className={s.removalPanel} aria-label="Productie verwijderen"><h3>Wat wil je verwijderen?</h3>
      {following.length>0 && <div className={s.removalDependencies}><p>Verwijder eerst de gekoppelde vervolgstap{following.length>1?"pen":""}:</p>{following.map(step=>stepLink(step,true))}</div>}
      {production.length>1 && <><h4>Deze receptproductie · {production.length} taken</h4><ul className={s.removalList}>{[...production].sort((a,b)=>a.date.localeCompare(b.date)).map(step=><li key={step.id}><span><strong>{state.items.find(i=>i.id===step.itemId)?.name}</strong><small>{quantity(step.quantity)} {state.items.find(i=>i.id===step.itemId)?.unit} · {step.operation} · {dateLabel(step.date,true)}</small></span><span>{STATUS_LABELS[step.status]}</span></li>)}</ul></>}
      {removalBlock && <p className={s.formError}>{removalBlock}</p>}{externalFollowing.filter(step=>!following.some(t=>t.id===step.id)).map(step=>stepLink(step,true))}
      <div className={s.removalActions}><button className={s.secondaryButton} disabled={saving} onClick={()=>{setRemoving(false);setError("");}}>Annuleren</button><button className={s.deleteButton} disabled={saving || following.length>0} onClick={async()=>setError(await onRemove() || "")}>Alleen deze taak verwijderen</button>{production.length>1 && <button className={s.deleteButton} disabled={saving || !!removalBlock} onClick={async()=>setError(await onRemove(true) || "")}>Hele receptproductie verwijderen</button>}</div>
    </section> : <>
      <div className={s.taskDetailSummary}><strong>{task.operation}</strong><span className={`${s.statusPill} ${s[`task_${task.status}`]}`}>{STATUS_LABELS[task.status]}</span></div>
      {task.note && !(task.generatedFor && task.note.startsWith("Meegepland voor ")) && <div className={s.detailNote}>{task.note}</div>}
      {issues.length>0 && <div className={s.issueBox}><Icon name="warning"/><ul>{issues.map(i=><li key={i}>{i}</li>)}</ul></div>}
      {review?.changed && <section className={s.recipeUpdate}><h3>Recept gewijzigd</h3><PlanChanges changes={review.changes}/>{review.errors.map(message=><p key={message} role="alert">{message}</p>)}{canManage && <button disabled={saving || !!updateBlock} className={s.secondaryButton} onClick={onRefreshPlan}>Met actueel recept bijwerken</button>}{updateBlock && <p>{updateBlock}</p>}</section>}
      <TaskWorkPanel state={state} task={task} item={item} recipes={recipeList} busy={saving} onCommand={onWork}/>{recipe?.type==="semiFinished"&&<PreparationControl recipeId={item.recipeId!} state={state} busy={saving} onCommand={onWork}/>}<RecipeContent override={recipe} recipeId={recipe?.id} amount={task.quantity} note={item.note} hideAllergens heading="Recept" />{canManage && onRecipe && item.kind!=="activity" && <button disabled={saving} className={s.secondaryButton} onClick={onRecipe}><Icon name="book" size={15}/>{item.recipeId?"Werkrecept aanpassen":"Recept snel invoeren"}</button>}{canManage && onItem && !item.recipeId && item.kind!=="activity" && <button disabled={saving} className={s.secondaryButton} onClick={onItem}><Icon name="link" size={15}/>Naam of recept koppelen</button>}

      {related.length>0 && <details className={s.moveDetails}><summary><Icon name="link" size={15}/>Productiestappen & halffabricaten</summary><div className={s.stepsChain}>{related.map(step=>stepLink(step))}</div></details>}
      {canManage && <details className={s.moveDetails}><summary><Icon name="move" size={15}/>Planning aanpassen of volgende stap toevoegen</summary>
        {!state.productionWork?.timers?.[task.id]&&task.status!=="done"&&<button disabled={saving} className={s.secondaryButton} onClick={async()=>setError(await onStatus(task.status==="blocked"?"planned":"blocked")||"")}>{task.status==="blocked"?"Deblokkeren":"Blokkeren"}</button>}
        {task.minutes!==undefined && <p className={s.fieldHint}>{durationLabel(task.minutes)} werktijd</p>}
        {task.dueDate && <p className={s.fieldHint}>Benodigd: {dateLabel(task.dueDate,true)}</p>}
        {!review?.changed && !task.generatedFor && !task.dependsOn && recipe && <button disabled={saving || !!updateBlock} className={s.secondaryButton} onClick={onRefreshPlan}>Met actueel recept bijwerken</button>}
        <form onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); setError(await onMove(task.id, String(data.get("date")), data.get("department") as DepartmentId) || ""); }}><label className={s.field}>Datum<input name="date" type="date" defaultValue={task.date} required /></label><label className={s.field}>Afdeling<select name="department" defaultValue={task.departmentId}>{DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><button disabled={saving} className={s.secondaryButton} type="submit">Verplaatsen</button></form><button disabled={saving} className={s.textLink} onClick={onNext}><Icon name="plus" size={15} />Volgende stap in deze batch</button>
      </details>}
    </>}
    {error && <p className={s.formError} role="alert">{error}</p>}
  </div><footer className={s.dialogFooter}>
    {canManage && task.status==="planned" && <button disabled={saving} aria-label="Geplande taak verwijderen" title="Geplande taak verwijderen" aria-expanded={removing} className={`${s.taskIconButton} ${s.taskDeleteButton}`} onClick={async()=>{setError("");if(following.length || production.length>1)setRemoving(!removing);else setError(await onRemove() || "");}}><Icon name="trash" size={19}/></button>}
    <button className={`${s.taskIconButton} ${s.taskBackButton}`} onClick={onClose} aria-label="Terug naar het bord" title="Terug naar het bord"><Icon name="back" size={20}/></button>
  </footer></ModalFrame>;
}

function ItemDetail({ item, state, onClose, onPlan, onLink, onUpdate, onRecipe }: { item: Item; state: PreviewState; onClose: () => void; onPlan: () => void; onLink: (id: string) => Promise<string|undefined>; onUpdate:(changes:Partial<Item>)=>Promise<string|undefined>; onRecipe?:()=>void }) {
  const {recipes:recipeList,canManage,saving}=useContext(WorkspaceContext);
  const [error,setError]=useState("");
  const [recipeId, setRecipeId] = useState(item.recipeId || "");
  const recipe=recipeList.find(r=>r.id===item.recipeId);
  const temporary = !item.recipeId && !recipeList.some(r=>item.id===`recipe:${r.id}`) && item.kind!=="activity";
  const [viewAmount,setViewAmount]=useState(()=>String(recipe?.yield || 1));
  const [multiplier,setMultiplier]=useState("1");
  const parsedAmount=Number(viewAmount.replace(",","."));
  const validAmount=Number.isFinite(parsedAmount) && parsedAmount>0 && parsedAmount<=1000000;
  function changeAmount(value:string) {
    setViewAmount(value);
    const amount=Number(value.replace(",","."));
    setMultiplier(recipe && recipe.yield>0 && amount>0 ? String(Number((amount/recipe.yield).toFixed(8))).replace(".",",") : "");
  }
  function changeMultiplier(value:string) {
    setMultiplier(value);
    const factor=Number(value.replace(",","."));
    setViewAmount(recipe && factor>0 && Number.isFinite(factor) ? String(Number((recipe.yield*factor).toFixed(8))) : "");
  }
  const compatible = recipeList.filter(r => r.unit === item.unit);
  return <ModalFrame title={item.name} subtitle={`${KIND_LABELS[item.kind]} · ${departmentName(item.departmentId)} · ${item.unit}`} onClose={onClose}>
    <div className={s.dialogBody}>
      {temporary && <span className={s.recipeMissingBadge}><Icon name="warning" size={13}/>Zonder recept</span>}
      {canManage && onRecipe && item.kind!=="activity" && <div className={s.itemRecipeActions}><button disabled={saving} className={s.secondaryButton} onClick={onRecipe}><Icon name="book" size={15}/>{item.recipeId?"Recept aanpassen":temporary?"Nieuw recept maken":"Recept herstellen"}</button></div>}
      {recipe && recipe.yield>0 && <div className={s.recipeCalculator}>
        <label className={s.field}>Berekenen voor ({item.unit})<input aria-label="Hoeveelheid werkrecept" type="number" min="0.000001" max="1000000" step="any" value={viewAmount} onChange={e=>changeAmount(e.target.value)}/></label>
        <label className={s.field}>× basisrecept<input aria-label="Aantal keer basisrecept" type="text" inputMode="decimal" value={multiplier} onChange={e=>changeMultiplier(e.target.value)} placeholder="Bijv. 1,5 of 6" /></label>
        <button type="button" className={s.secondaryButton} onClick={()=>{setViewAmount(String(recipe.yield));setMultiplier("1");}}>1 basisrecept · {quantity(recipe.yield)} {recipe.unit}</button>
      </div>}
      {recipe && recipe.yield>0 && !validAmount ? <p className={s.formError} role="status">Vul een hoeveelheid groter dan 0 en maximaal 1.000.000 {item.unit} in.</p> : <RecipeContent recipeId={item.recipeId} amount={validAmount?parsedAmount:recipe?.yield || 1} note={item.note} />}
      {canManage && !item.recipeId && item.kind!=="activity" && <form className={s.recipeLinkForm} onSubmit={async e=>{e.preventDefault();setError(await onLink(recipeId)||"");}}>
        <SearchableChoice label="Bestaand recept koppelen" choices={compatible.map(r=>({id:r.id,name:r.name,description:`${r.yield} ${r.unit}`,searchValues:r.ingredients.map(i=>i.name)}))} value={recipeId} onChange={setRecipeId} required disabled={saving} placeholder="Zoek een recept of ingrediënt…"/>
        <button className={s.secondaryButton} disabled={saving || !recipeId} type="submit"><Icon name="link" size={15}/>Koppelen</button>
      </form>}
      {canManage && <form className={s.recipeLinkForm} onSubmit={async e=>{
        e.preventDefault();
        const data=new FormData(e.currentTarget);
        setError(await onUpdate({departmentId:data.get("department") as DepartmentId,note:String(data.get("note")),...(temporary?{name:String(data.get("name"))}:{})})||"");
      }}>
        {temporary && <label className={s.field}>Naam onderdeel<input name="name" defaultValue={item.name} required maxLength={120} disabled={saving}/></label>}
        <label className={s.field}>Standaardafdeling<select name="department" defaultValue={item.departmentId} disabled={saving}>{DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label className={s.field}>Opmerking<textarea name="note" rows={2} defaultValue={item.note} maxLength={1000} disabled={saving}/></label>
        <button disabled={saving} className={s.secondaryButton}>Wijzigingen opslaan</button>
      </form>}
      {error && <p className={s.formError} role="alert">{error}</p>}
      <RecipeWorkHistory state={state} recipes={recipeList} itemId={item.id} quantity={validAmount?parsedAmount:recipe?.yield||1} unit={item.unit}/>
      <div className={s.detailFacts}>{state.tasks.filter(t=>t.itemId===item.id).length} ingeplande taken</div>
    </div>
    <footer className={s.dialogFooter}><button className={s.secondaryButton} onClick={onClose}>Sluiten</button><button disabled={!canManage || saving || item.productionBlocked} className={s.primaryButton} onClick={onPlan}><Icon name="plus" size={16}/>Inplannen</button></footer>
  </ModalFrame>;
}

function RecipeContent({ recipeId, amount, note, hideAllergens=false, heading, override }: { override?:import("../../productie/planning").DemoRecipe; recipeId?: string; amount: number; note: string; hideAllergens?:boolean; heading?:string }) {
  const {recipes:recipeList,demo}=useContext(WorkspaceContext);
  const recipe = override||recipeList.find(r => r.id === recipeId);
  return <section className={s.recipeContent}><h3><Icon name="book" size={17} />{recipe ? heading || recipe.name : "Werkinstructie"}</h3>{note && <p>{note}</p>}{recipe ? <>{recipe.reviewRequired && <p className={s.formError}>Dit bronrecept bevat ontbrekende grondstoffen of onderdelen. De oorspronkelijke verwijzingen zijn bewaard; controleer ze vóór productie.</p>}{demo && <span className={s.exampleLabel}>VOORBEELDRECEPT · GEEN PRODUCTIE-INSTRUCTIE</span>}<div className={s.ingredientAmounts}>{recipe.ingredients.map((i,index) => <div key={`${i.name}-${index}`}><span>{i.name}</span><strong>{(i.quantity > 0 ? quantity(recipe.yield > 0 ? i.quantity * amount / recipe.yield : i.quantity) : "Nog invullen")} {i.unit}</strong></div>)}</div><small className={s.fieldHint}>{recipe.yield > 0 ? `Geschaald naar ${quantity(amount)} ${recipe.unit} · basis ${recipe.yield} ${recipe.unit}` : "Basisopbrengst ontbreekt; bronhoeveelheden worden ongeschaald getoond."}</small><ol>{recipe.steps.map(step => <li key={step}>{step}</li>)}</ol>{!hideAllergens && <p className={s.allergenNote}>{demo ? "Voorbeeld allergenen" : "Opgegeven allergenen"}: {recipe.allergens.join(", ") || "Nog controleren"}.</p>}</> : <p className={s.fieldHint}>Nog geen recept gekoppeld. Dit onderdeel blijft gewoon selecteerbaar en in te plannen.</p>}</section>;
}

function isPreviewState(value: unknown): value is PreviewState {
  return validWorkspace(value,demoRecipes);
}
