"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {BOARDS,DEPARTMENTS,addDays,dateLabel,departmentsFor,mondayOf,type BoardId,type DepartmentId,type Item,type Task,type PreviewState} from './planning';
import {canEditProductionRequest,requestDepartmentId,requestPlanningTask,requestsForBoard,type ProductionRequest,type RequestCommand} from './requestPlanning';
import Icon from './ProductionIcon';
import OperationalDialog from './OperationalDialog';
import SearchableChoice from './SearchableChoice';
import s from './requests.module.css';
type Data={revision:number;canCreate:boolean;departments:DepartmentId[];items:Pick<Item,'id'|'name'|'unit'|'departmentId'|'productionBlocked'>[];requests:(ProductionRequest&{plannedTask?:Task;canEdit?:boolean;planningUrl?:string})[]};
type Props={
 board?:BoardId;week?:string;today?:string;selectedDay?:string;selectedDepartment?:DepartmentId;
 onPlanned?:()=>Promise<void>;logistics?:boolean;compact?:boolean;
 preview?:{readOnly?:boolean;canPlan?:boolean;state:PreviewState;onCommand:(command:RequestCommand)=>Promise<void>};
};
export default function ProductionRequests({board,week,today,selectedDay,selectedDepartment,onPlanned,logistics=false,compact=false,preview}:Props){
 const [remoteData,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[adding,setAdding]=useState(false),[planning,setPlanning]=useState(''),[showPlanned,setShowPlanned]=useState(false),[newItem,setNewItem]=useState(false);
 const [expanded,setExpanded]=useState(false),[planningDepartment,setPlanningDepartment]=useState<DepartmentId|''>('');
 const [editing,setEditing]=useState<ProductionRequest|null>(null),[selectedItem,setSelectedItem]=useState('');
 const [moving,setMoving]=useState<ProductionRequest|null>(null);
 const [moveDepartment,setMoveDepartment]=useState<DepartmentId|''>('');
 const [notice,setNotice]=useState('');
 const data:Data|null=preview?{
  revision:0,canCreate:!preview.readOnly,departments:preview.readOnly&&!preview.canPlan?[]:DEPARTMENTS.map(department=>department.id),items:preview.state.items,
  requests:(preview.state.productionRequests||[]).map(request=>({...request,plannedTask:requestPlanningTask(preview.state,request),canEdit:canEditProductionRequest(preview.state,request)})),
 }:remoteData;
 const previewMode=!!preview;
 const lock=useRef(false),serial=useRef(0),formRevision=useRef<number|null>(null);
 const load=useCallback(async()=>{
  if(previewMode)return;
  const current=++serial.current;
  try{const response=await fetch('/api/productie/verzoeken',{cache:'no-store'}),result=await response.json();if(!response.ok)throw Error(result.message||'Verzoeken laden mislukt.');if(current===serial.current){setData(result);setError('');}}
  catch(e){if(current===serial.current)setError((e as Error).message);}
 },[previewMode]);
 useEffect(()=>{
  if(previewMode)return;
  void load();
  const timer=setInterval(()=>{if(!document.hidden&&!lock.current&&formRevision.current===null)void load();},15000);
  const sequence=serial;
  return()=>{clearInterval(timer);sequence.current++;};
 },[load,previewMode]);
 function closeEditor(){setAdding(false);setEditing(null);setMoving(null);setNewItem(false);setSelectedItem('');formRevision.current=null;}
 function openEditor(request?:ProductionRequest){
  if(!data)return;
  serial.current++;setMoving(null);setNotice('');if(compact)setExpanded(true);setAdding(!request);setEditing(request||null);setSelectedItem(request?.itemId||'');setNewItem(false);setPlanning('');setError('');formRevision.current=data.revision;
 }
 function openMove(request:ProductionRequest){
  if(!data)return;
  closeEditor();serial.current++;setPlanning('');setMoving(request);setError('');setNotice('');
  setMoveDepartment(requestDepartmentId(request,data.items.find(item=>item.id===request.itemId))||'');
  formRevision.current=data.revision;
  if(compact)setExpanded(true);
 }
 function closePanel(){
  if(busy)return;
  setExpanded(false);closeEditor();setPlanning('');
 }
 function openPlanning(request:ProductionRequest,allowed:DepartmentId[]){
  closeEditor();setError('');setNotice('');setPlanning(request.id);formRevision.current=data?.revision??null;
  const inherited=requestDepartmentId(request,data?.items.find(item=>item.id===request.itemId));
  setPlanningDepartment(inherited&&allowed.includes(inherited)?inherited:selectedDepartment&&allowed.includes(selectedDepartment)?selectedDepartment:'');
  if(compact)setExpanded(true);
 }

 async function act(command:RequestCommand,revision=data?.revision){
  if(!data||lock.current)return;lock.current=true;serial.current++;setBusy(true);setError('');setNotice('');
  try{
   if(preview){await preview.onCommand(command);closeEditor();setPlanning('');showMoveNotice(command);return;}
   const response=await fetch('/api/productie/verzoeken',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,command})}),result=await response.json();if(!response.ok)throw Error(response.status===409&&(command.kind==='edit'||command.kind==='move')?'De planning is intussen gewijzigd. Sluit bewerken en open het verzoek opnieuw.':result.message||'Opslaan mislukt.');closeEditor();setPlanning('');await load();showMoveNotice(command);if(command.kind==='plan'||command.kind==='move')await onPlanned?.();}
  catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 function showMoveNotice(command:RequestCommand){
  if(command.kind!=='move')return;
  const target=DEPARTMENTS.find(department=>department.id===command.departmentId);
  setNotice(target?`Verplaatst naar ${target.id==='bak'?'Bakkant':target.name}.`:'Verzoek zonder afdeling opgeslagen.');
 }
 function saveRequest(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);void act({...(editing?{kind:'edit' as const,id:editing.id}:{kind:'create' as const}),itemId:String(form.get('itemId')),quantity:Number(form.get('quantity')),departmentId:(String(form.get('departmentId'))||null) as DepartmentId|null,neededBy:String(form.get('neededBy'))||undefined,note:String(form.get('note')),...(newItem?{newItem:{name:String(form.get('name')),kind:String(form.get('kind')) as 'product'|'component',unit:String(form.get('unit')) as Item['unit']}}:{})},formRevision.current??undefined);}
 function planRequest(element:HTMLFormElement,id:string,date?:string){
  const form=new FormData(element),minutes=String(form.get('minutes')??'').trim();
  void act({
   kind:'plan',id,date:date||String(form.get('date')),departmentId:planningDepartment as DepartmentId,
   ...(minutes!==''?{minutes:Number(minutes)}:{}),...(form.get('pour')==='on'?{pour:true}:{}),
  },formRevision.current??undefined);
 }
 const referenceDay=today||new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const items=data?.items||[];
 const requests=requestsForBoard(data?.requests||[],items,board);
 const open=requests.filter(r=>!r.plannedTask&&r.canEdit!==false),planned=requests.filter(r=>r.plannedTask||r.canEdit===false);
 const title=<h2 id="production-requests-heading">Productieverzoeken {!!open.length&&<span>{open.length}</span>}</h2>;
 const content=<>

  <header><div>{!compact&&<small>Van logistiek naar bakkerij</small>}{title}</div><div className={s.headerActions}>
   {compact&&!expanded&&<button type="button" disabled={busy} onClick={()=>setExpanded(true)} aria-label="Productieverzoeken vergroten" title="Uitklappen" aria-haspopup="dialog" aria-expanded={expanded}><Icon name="expand" size={19}/></button>}
   {data?.canCreate&&<button type="button" disabled={busy} onClick={()=>adding?closeEditor():openEditor()} aria-label="Productieverzoek toevoegen" aria-expanded={adding}><Icon name="plus" size={18}/></button>}
   {expanded&&<button type="button" disabled={busy} onClick={closePanel} aria-label="Productieverzoeken sluiten" title="Sluiten"><Icon name="close" size={22}/></button>}
  </div></header>
  {!compact&&<p className={s.intro}>{logistics?'Zet klaar wat de bakkers nog moeten inplannen.':'Nog in te plannen · kies met + een productiedag.'}</p>}
  {error&&<div role="alert" className={s.error}>{error} <button type="button" disabled={busy} onClick={()=>void load()}>Verversen</button></div>}
  {notice&&<p role="status" className={s.notice}>{notice}</p>}
  {!data&&!error&&<p role="status">Verzoeken laden…</p>}
  {(adding||editing)&&data&&<form key={editing?.id||'create'} onSubmit={saveRequest} className={s.form}>
   <div className={s.formHeader}><strong>{editing?'Verzoek wijzigen':'Nieuw verzoek'}</strong><button type="button" disabled={busy} onClick={closeEditor} aria-label="Verzoekformulier sluiten"><Icon name="close" size={15}/></button></div>
   <SearchableChoice name="itemId" label="Product" value={selectedItem} onChange={id=>{setSelectedItem(id);setNewItem(id==='__new');}} required disabled={busy} choices={[{id:'__new',name:'+ Nieuw onderdeel zonder recept'},...items.map(item=>({id:item.id,name:item.name,description:item.unit,disabled:item.productionBlocked}))]} placeholder="Zoek een product…"/>
   {newItem&&<><label>Naam nieuw onderdeel<input name="name" required maxLength={120} disabled={busy}/></label><label>Type<select name="kind"><option value="product">Product</option><option value="component">Halffabricaat / onderdeel</option></select></label><label>Eenheid<select name="unit">{['stuks','gram','kg','ml','liter','platen'].map(unit=><option key={unit}>{unit}</option>)}</select></label><small>Een recept is nog niet nodig. De bakker kan dit later aanvullen.</small></>}
   <label>Afdeling (optioneel)<select name="departmentId" defaultValue={editing?requestDepartmentId(editing,items.find(item=>item.id===editing.itemId))||'':''} disabled={busy}><option value="">Nog geen afdeling</option>{DEPARTMENTS.map(department=><option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
   <label>Hoeveelheid<input name="quantity" type="number" min="0.000001" max="1000000" step="any" required defaultValue={editing?.quantity} disabled={busy}/></label>
   <label>Gewenst uiterlijk (optioneel)<input name="neededBy" type="date" defaultValue={editing?.neededBy||''} disabled={busy}/></label>
   <label>Opmerking<textarea name="note" rows={2} maxLength={2000} defaultValue={editing?.note||''} disabled={busy}/></label>
   <button type="submit" disabled={busy}>{busy?'Opslaan…':editing?'Wijzigingen opslaan':'Verzoek toevoegen'}</button>
  </form>}
  <div className={s.list}>{open.sort((a,b)=>(a.neededBy||'9999').localeCompare(b.neededBy||'9999')||a.createdAt.localeCompare(b.createdAt)).map(r=>{
   const item=data?.items.find(i=>i.id===r.itemId),departmentId=requestDepartmentId(r,item),allowed=(data?.departments||[]).filter(id=>!board||departmentsFor(board).some(department=>department.id===id));
   const deadline=r.neededBy?productionRequestDeadline(r.neededBy,referenceDay):undefined;
   return <article key={r.id} data-deadline-urgency={deadline?.urgency}><div className={s.row}>
    <div className={s.requestName}><strong>{item?.name||'Product niet meer beschikbaar'} <small className={s.requestQuantity}>{r.quantity.toLocaleString('nl-NL')}{item?.unit&&item.unit!=='stuks'?` ${item.unit}`:''}</small></strong>{departmentId===null&&<span>Nog geen afdeling</span>}</div>
    <div className={s.rowActions}>
     {data?.canCreate&&<button disabled={busy} type="button" onClick={()=>openMove(r)} aria-label={`Verplaats verzoek: ${item?.name}`} title="Afdeling wijzigen" aria-expanded={moving?.id===r.id}><Icon name="arrow" size={16}/></button>}
     {(!compact||expanded||logistics)&&data?.canCreate&&<><button disabled={busy} type="button" onClick={()=>openEditor(r)} aria-label={`Bewerk verzoek: ${item?.name}`} title="Verzoek bewerken"><Icon name="edit" size={14}/></button><button className={s.withdraw} disabled={busy} type="button" onClick={()=>void act({kind:'cancel',id:r.id})} aria-label={`Verzoek intrekken: ${item?.name}`} title="Verzoek intrekken"><Icon name="trash" size={14}/></button></>}
     {!logistics&&allowed.length>0&&<button className={s.plan} type="button" disabled={busy||!item||item.productionBlocked} onClick={()=>openPlanning(r,allowed)} aria-label={`Inplannen: ${item?.name}`} title="Inplannen" aria-expanded={planning===r.id}><Icon name="plus" size={17}/></button>}
    </div>
   </div>{deadline&&<time className={s.deadline} dateTime={r.neededBy} data-urgency={deadline.urgency} title={`Uiterlijk ${dateLabel(r.neededBy!,true)}`}><Icon name={deadline.urgency==='overdue'?'warning':'grid'} size={16}/>{deadline.label}</time>}{r.note&&<p title={r.note}>{r.note}</p>}
   {moving?.id===r.id&&<form className={s.form} onSubmit={event=>{
    event.preventDefault();void act({kind:'move',id:r.id,departmentId:moveDepartment||null},formRevision.current??undefined);
   }}>
    <div className={s.formHeader}><strong>Verplaatsen</strong><button type="button" disabled={busy} onClick={closeEditor} aria-label="Verplaatsen annuleren"><Icon name="close" size={15}/></button></div>
    <label>Afdeling<select name="departmentId" aria-label="Afdeling" value={moveDepartment} onChange={event=>setMoveDepartment(event.target.value as DepartmentId|'')} disabled={busy}>
     <option value="">Nog geen afdeling</option>
     {BOARDS.map(target=><optgroup key={target.id} label={target.name}>{departmentsFor(target.id).map(department=><option key={department.id} value={department.id}>{department.id==='bak'?'Bakkant':department.name}</option>)}</optgroup>)}
    </select></label>
    <button type="submit" disabled={busy}>{busy?'Verplaatsen…':'Verplaatsen'}</button>
   </form>}
   {planning===r.id&&<form className={s.form} onSubmit={event=>{
    event.preventDefault();planRequest(event.currentTarget,r.id);
   }}>
    <label>Afdeling<select name="departmentId" required value={planningDepartment} onChange={event=>setPlanningDepartment(event.target.value as DepartmentId)} disabled={busy}><option value="">Kies afdeling</option>{DEPARTMENTS.filter(d=>allowed.includes(d.id)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <div className={s.quickDays} role="group" aria-label="Kies productiedag">{Array.from({length:7},(_,index)=>addDays(week||mondayOf(referenceDay),index)).map(date=><button
     key={date} type="button" disabled={busy||!planningDepartment||!!r.neededBy&&date>r.neededBy}
     data-selected={date===(selectedDay||referenceDay)||undefined} aria-label={`Inplannen op ${dateLabel(date,true)}`}
     onClick={event=>{const form=event.currentTarget.form;if(form)planRequest(form,r.id,date);}}
    >{date===referenceDay?'Vandaag':dateLabel(date)}<small>{date.slice(8)}-{date.slice(5,7)}</small></button>)}</div>
    <details className={s.planOptions}><summary>Andere datum of opties</summary>
     <label>Productiedag<input name="date" type="date" defaultValue={selectedDay||week||r.neededBy||referenceDay} max={r.neededBy} required disabled={busy}/></label>
     <label>Geschatte tijd (min, optioneel)<input name="minutes" type="number" min="0" max="1440" step="any" placeholder="Bijv. 45" disabled={busy}/></label>
     <label className={s.checkbox}><input name="pour" type="checkbox" disabled={busy}/>Storten</label>
     <button disabled={busy||!planningDepartment} type="submit">{busy?'Inplannen…':'Inplannen'}</button>
    </details>
   </form>}
   </article>;
  })}</div>
  {data&&!open.length&&<p className={s.empty}>Geen open productieverzoeken.</p>}
  {!!planned.length&&<details open={showPlanned} onToggle={event=>setShowPlanned(event.currentTarget.open)}><summary>Ingepland ({planned.length})</summary>{planned.map(r=><div key={r.id} className={s.planned}><span>{data?.items.find(i=>i.id===r.itemId)?.name} · {r.quantity.toLocaleString('nl-NL')}{r.plannedTask?` · ${r.plannedTask.date.split('-').reverse().join('-')}`:''}{r.plannedTask?.status==='done'?' · klaar':''}</span>{r.planningUrl&&!!data?.departments.length?<a href={r.planningUrl}>Open in weekplanning <Icon name="arrow" size={13}/></a>:<small>{r.plannedTask?'Wijzigen via de bakkerijplanning.':'Dit verzoek heeft al productieregistraties.'}</small>}</div>)}</details>}
 </>;
 return <aside className={`${s.panel} ${compact?s.compact:""}`} aria-label="Productieverzoeken" aria-busy={busy} data-production-update-block={expanded||adding||!!editing||!!moving||!!planning||busy||undefined}>
  {expanded?<><header><h2>Productieverzoeken <span>{open.length}</span></h2><button type="button" onClick={closePanel} aria-label="Productieverzoeken sluiten"><Icon name="close"/></button></header>
   <OperationalDialog className={`${s.panel} ${s.expanded}`} labelledBy="production-requests-heading" busy={busy} onClose={closePanel}>{content}</OperationalDialog>
  </>:content}
 </aside>;
}

export function productionRequestDeadline(date:string,today:string){
 const label=dateLabel(date,true);
 const urgency=date<today?'overdue':date<=addDays(today,2)?'soon':'upcoming';
 const prefix=date<today?'Te laat':date===today?'Vandaag':date===addDays(today,1)?'Morgen':'Uiterlijk';
 return {urgency,label:`${prefix} · ${label}`};
}
