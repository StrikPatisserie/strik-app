"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {DEPARTMENTS,type BoardId,type DepartmentId,type Item,type Task} from './planning';
import {requestDepartmentId,requestsForBoard,type ProductionRequest,type RequestCommand} from './requestPlanning';
import Icon from './ProductionIcon';
import SearchableChoice from './SearchableChoice';
import s from './requests.module.css';
type Data={revision:number;canCreate:boolean;departments:DepartmentId[];items:Pick<Item,'id'|'name'|'unit'|'departmentId'|'productionBlocked'>[];requests:(ProductionRequest&{plannedTask?:Task;canEdit?:boolean;planningUrl?:string})[]};
export default function ProductionRequests({board,week,onPlanned,logistics=false,compact=false}:{compact?:boolean;board?:BoardId;week?:string;onPlanned?:()=>Promise<void>;logistics?:boolean}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[adding,setAdding]=useState(false),[planning,setPlanning]=useState(''),[showPlanned,setShowPlanned]=useState(false),[newItem,setNewItem]=useState(false);
 const [editing,setEditing]=useState<ProductionRequest|null>(null),[selectedItem,setSelectedItem]=useState('');
 const lock=useRef(false),serial=useRef(0),formRevision=useRef<number|null>(null);
 const load=useCallback(async()=>{
  const current=++serial.current;
  try{const response=await fetch('/api/productie/verzoeken',{cache:'no-store'}),result=await response.json();if(!response.ok)throw Error(result.message||'Verzoeken laden mislukt.');if(current===serial.current){setData(result);setError('');}}
  catch(e){if(current===serial.current)setError((e as Error).message);}
 },[]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(!document.hidden&&!lock.current&&formRevision.current===null)void load();},15000);const sequence=serial;return()=>{clearInterval(timer);sequence.current++;};},[load]);
 function closeEditor(){setAdding(false);setEditing(null);setNewItem(false);setSelectedItem('');formRevision.current=null;}
 function openEditor(request?:ProductionRequest){
  if(!data)return;
  serial.current++;setAdding(!request);setEditing(request||null);setSelectedItem(request?.itemId||'');setNewItem(false);setPlanning('');setError('');formRevision.current=data.revision;
 }
 function openPlanning(id:string){
  closeEditor();setPlanning(planning===id?'':id);formRevision.current=planning===id?null:data?.revision??null;
 }
 async function act(command:RequestCommand,revision=data?.revision){
  if(!data||lock.current)return;lock.current=true;serial.current++;setBusy(true);setError('');
  try{const response=await fetch('/api/productie/verzoeken',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,command})}),result=await response.json();if(!response.ok)throw Error(response.status===409&&command.kind==='edit'?'De planning is intussen gewijzigd. Sluit bewerken en open het verzoek opnieuw.':result.message||'Opslaan mislukt.');closeEditor();setPlanning('');await load();if(command.kind==='plan')await onPlanned?.();}
  catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 function saveRequest(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);void act({...(editing?{kind:'edit' as const,id:editing.id}:{kind:'create' as const}),itemId:String(form.get('itemId')),quantity:Number(form.get('quantity')),departmentId:(String(form.get('departmentId'))||null) as DepartmentId|null,neededBy:String(form.get('neededBy'))||undefined,note:String(form.get('note')),...(newItem?{newItem:{name:String(form.get('name')),kind:String(form.get('kind')) as 'product'|'component',unit:String(form.get('unit')) as Item['unit']}}:{})},formRevision.current??undefined);}
 const items=data?.items||[];
 const requests=requestsForBoard(data?.requests||[],items,board);
 const open=requests.filter(r=>!r.plannedTask&&r.canEdit!==false),planned=requests.filter(r=>r.plannedTask||r.canEdit===false);
 return <aside className={`${s.panel} ${compact?s.compact:""}`} aria-label="Productieverzoeken" aria-busy={busy} data-production-update-block={adding||!!editing||!!planning||busy||undefined}>
  <header><div>{!compact&&<small>Van logistiek naar bakkerij</small>}<h2>Productieverzoeken {!!open.length&&<span>{open.length}</span>}</h2></div>{data?.canCreate&&<button type="button" disabled={busy} onClick={()=>adding?closeEditor():openEditor()} aria-label="Productieverzoek toevoegen" aria-expanded={adding}><Icon name="plus" size={18}/></button>}</header>
  {!compact&&<p className={s.intro}>{logistics?'Zet klaar wat de bakkers nog moeten inplannen.':'Nog in te plannen · kies met + een productiedag.'}</p>}
  {error&&<div role="alert" className={s.error}>{error} <button type="button" disabled={busy} onClick={()=>void load()}>Verversen</button></div>}
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
   const item=data?.items.find(i=>i.id===r.itemId),departmentId=requestDepartmentId(r,item),allowed=(data?.departments||[]).filter(id=>!board||DEPARTMENTS.find(d=>d.id===id)?.board===board);
   return <article key={r.id}><div className={s.row}><div><strong>{item?.name||'Product niet meer beschikbaar'}</strong><span>{r.quantity.toLocaleString('nl-NL')} {item?.unit}{r.neededBy?` · uiterlijk ${r.neededBy.split('-').reverse().join('-')}`:''}{departmentId===null?' · Nog geen afdeling':''}</span></div>{!logistics&&allowed.length>0&&<button type="button" disabled={busy||!item||item.productionBlocked} onClick={()=>openPlanning(r.id)} aria-label={`Inplannen: ${item?.name}`} aria-expanded={planning===r.id}><Icon name="plus" size={17}/></button>}</div>{r.note&&<p>{r.note}</p>}
   {planning===r.id&&<form className={s.form} onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget),minutes=String(form.get('minutes')??'').trim();void act({kind:'plan',id:r.id,date:String(form.get('date')),departmentId:String(form.get('departmentId')) as DepartmentId,...(minutes!==''?{minutes:Number(minutes)}:{}),...(form.get('pour')==='on'?{pour:true}:{})},formRevision.current??undefined);}}>
    <label>Productiedag<input name="date" type="date" defaultValue={week||r.neededBy} max={r.neededBy} required disabled={busy}/></label>
    <label>Afdeling<select name="departmentId" required defaultValue={departmentId&&allowed.includes(departmentId)?departmentId:''} disabled={busy}><option value="">Kies afdeling</option>{DEPARTMENTS.filter(d=>allowed.includes(d.id)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label>Geschatte tijd (min, optioneel)<input name="minutes" type="number" min="0" max="1440" step="any" placeholder="Bijv. 45" disabled={busy}/></label>
    <label className={s.checkbox}><input name="pour" type="checkbox" disabled={busy}/>Storten</label>
    <small>De volledige hoeveelheid wordt één keer ingepland. Halffabricaten kun je daarna bij de productietaak meeplannen.</small><button disabled={busy} type="submit">{busy?'Inplannen…':'In weekplanning zetten'}</button>
   </form>}
   {data?.canCreate&&<div className={s.actions}><button className={s.edit} disabled={busy} type="button" onClick={()=>openEditor(r)} aria-label={`Bewerk verzoek: ${item?.name}`}>Bewerken</button><button className={s.withdraw} disabled={busy} type="button" onClick={()=>void act({kind:'cancel',id:r.id})}>Intrekken</button></div>}
   </article>;
  })}</div>
  {!compact&&data&&!open.length&&<p className={s.empty}>Geen open productieverzoeken.</p>}
  {!!planned.length&&<details open={showPlanned} onToggle={event=>setShowPlanned(event.currentTarget.open)}><summary>Ingepland ({planned.length})</summary>{planned.map(r=><div key={r.id} className={s.planned}><span>{data?.items.find(i=>i.id===r.itemId)?.name} · {r.quantity.toLocaleString('nl-NL')}{r.plannedTask?` · ${r.plannedTask.date.split('-').reverse().join('-')}`:''}{r.plannedTask?.status==='done'?' · klaar':''}</span>{r.planningUrl&&!!data?.departments.length?<a href={r.planningUrl}>Open in weekplanning <Icon name="arrow" size={13}/></a>:<small>{r.plannedTask?'Wijzigen via de bakkerijplanning.':'Dit verzoek heeft al productieregistraties.'}</small>}</div>)}</details>}
 </aside>;
}
