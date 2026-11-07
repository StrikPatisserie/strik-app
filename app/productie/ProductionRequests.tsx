"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {DEPARTMENTS,type BoardId,type DepartmentId,type Item,type Task} from './planning';
import {requestDepartmentId,requestsForBoard,type ProductionRequest,type RequestCommand} from './requestPlanning';
import Icon from './ProductionIcon';
import s from './requests.module.css';
type Data={revision:number;canCreate:boolean;departments:DepartmentId[];items:Pick<Item,'id'|'name'|'unit'|'departmentId'|'productionBlocked'>[];requests:(ProductionRequest&{plannedTask?:Task})[]};
export default function ProductionRequests({board,week,onPlanned,logistics=false,compact=false}:{compact?:boolean;board?:BoardId;week?:string;onPlanned?:()=>Promise<void>;logistics?:boolean}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[adding,setAdding]=useState(false),[planning,setPlanning]=useState(''),[showPlanned,setShowPlanned]=useState(false),[search,setSearch]=useState(''),[newItem,setNewItem]=useState(false);
 const lock=useRef(false),serial=useRef(0);
 const load=useCallback(async()=>{
  const current=++serial.current;
  try{const response=await fetch('/api/productie/verzoeken',{cache:'no-store'}),result=await response.json();if(!response.ok)throw Error(result.message||'Verzoeken laden mislukt.');if(current===serial.current){setData(result);setError('');}}
  catch(e){if(current===serial.current)setError((e as Error).message);}
 },[]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(!document.hidden&&!lock.current)void load();},15000);const sequence=serial;return()=>{clearInterval(timer);sequence.current++;};},[load]);
 async function act(command:RequestCommand){
  if(!data||lock.current)return;lock.current=true;serial.current++;setBusy(true);setError('');
  try{const response=await fetch('/api/productie/verzoeken',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:data.revision,command})}),result=await response.json();if(!response.ok)throw Error(result.message||'Opslaan mislukt.');setAdding(false);setNewItem(false);setPlanning('');await load();if(command.kind==='plan')await onPlanned?.();}
  catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 function create(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);void act({kind:'create',itemId:String(form.get('itemId')),quantity:Number(form.get('quantity')),departmentId:(String(form.get('departmentId'))||null) as DepartmentId|null,neededBy:String(form.get('neededBy'))||undefined,note:String(form.get('note')),...(newItem?{newItem:{name:String(form.get('name')),kind:String(form.get('kind')) as 'product'|'component',unit:String(form.get('unit')) as Item['unit']}}:{})});}
 const items=data?.items||[];
 const requests=requestsForBoard(data?.requests||[],items,board);
 const open=requests.filter(r=>!r.plannedTask),planned=requests.filter(r=>r.plannedTask);
 return <aside className={`${s.panel} ${compact?s.compact:""}`} aria-label="Productieverzoeken" aria-busy={busy} data-production-update-block={adding||!!planning||busy||undefined}>
  <header><div>{!compact&&<small>Van logistiek naar bakkerij</small>}<h2>Productieverzoeken {!!open.length&&<span>{open.length}</span>}</h2></div>{data?.canCreate&&<button type="button" disabled={busy} onClick={()=>setAdding(!adding)} aria-label="Productieverzoek toevoegen" aria-expanded={adding}><Icon name="plus" size={18}/></button>}</header>
  {!compact&&<p className={s.intro}>{logistics?'Zet klaar wat de bakkers nog moeten inplannen.':'Nog in te plannen · kies met + een productiedag.'}</p>}
  {error&&<div role="alert" className={s.error}>{error} <button type="button" disabled={busy} onClick={()=>void load()}>Verversen</button></div>}
  {!data&&!error&&<p role="status">Verzoeken laden…</p>}
  {adding&&data&&<form onSubmit={create} className={s.form}>
   <label>Product zoeken<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Naam of product…"/></label>
   <label>Product<select name="itemId" required disabled={busy} onChange={event=>setNewItem(event.target.value==='__new')}><option value="">Kies product</option><option value="__new">+ Nieuw onderdeel zonder recept</option>{items.filter(i=>!i.productionBlocked&&i.name.toLocaleLowerCase('nl-NL').includes(search.toLocaleLowerCase('nl-NL'))).map(i=><option key={i.id} value={i.id}>{i.name} · {i.unit}</option>)}</select></label>
   {newItem&&<><label>Naam nieuw onderdeel<input name="name" required maxLength={120} disabled={busy}/></label><label>Type<select name="kind"><option value="product">Product</option><option value="component">Halffabricaat / onderdeel</option></select></label><label>Eenheid<select name="unit">{['stuks','gram','kg','ml','liter','platen'].map(unit=><option key={unit}>{unit}</option>)}</select></label><small>Een recept is nog niet nodig. De bakker kan dit later aanvullen.</small></>}
   <label>Afdeling (optioneel)<select name="departmentId" defaultValue="" disabled={busy}><option value="">Nog geen afdeling</option>{DEPARTMENTS.map(department=><option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
   <label>Hoeveelheid<input name="quantity" type="number" min="0.000001" max="1000000" step="any" required disabled={busy}/></label>
   <label>Gewenst uiterlijk (optioneel)<input name="neededBy" type="date" disabled={busy}/></label>
   <label>Opmerking<textarea name="note" rows={2} maxLength={2000} disabled={busy}/></label>
   <button type="submit" disabled={busy}>{busy?'Opslaan…':'Verzoek toevoegen'}</button>
  </form>}
  <div className={s.list}>{open.sort((a,b)=>(a.neededBy||'9999').localeCompare(b.neededBy||'9999')||a.createdAt.localeCompare(b.createdAt)).map(r=>{
   const item=data?.items.find(i=>i.id===r.itemId),departmentId=requestDepartmentId(r,item),allowed=(data?.departments||[]).filter(id=>!board||DEPARTMENTS.find(d=>d.id===id)?.board===board);
   return <article key={r.id}><div className={s.row}><div><strong>{item?.name||'Product niet meer beschikbaar'}</strong><span>{r.quantity.toLocaleString('nl-NL')} {item?.unit}{r.neededBy?` · uiterlijk ${r.neededBy.split('-').reverse().join('-')}`:''}{departmentId===null?' · Nog geen afdeling':''}</span></div>{!logistics&&allowed.length>0&&<button type="button" disabled={busy||!item||item.productionBlocked} onClick={()=>setPlanning(planning===r.id?'':r.id)} aria-label={`Inplannen: ${item?.name}`} aria-expanded={planning===r.id}><Icon name="plus" size={17}/></button>}</div>{r.note&&<p>{r.note}</p>}
   {planning===r.id&&<form className={s.form} onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget),minutes=String(form.get('minutes')??'').trim();void act({kind:'plan',id:r.id,date:String(form.get('date')),departmentId:String(form.get('departmentId')) as DepartmentId,...(minutes!==''?{minutes:Number(minutes)}:{}),...(form.get('pour')==='on'?{pour:true}:{})});}}>
    <label>Productiedag<input name="date" type="date" defaultValue={week||r.neededBy} max={r.neededBy} required disabled={busy}/></label>
    <label>Afdeling<select name="departmentId" required defaultValue={departmentId&&allowed.includes(departmentId)?departmentId:''} disabled={busy}><option value="">Kies afdeling</option>{DEPARTMENTS.filter(d=>allowed.includes(d.id)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label>Geschatte tijd (min, optioneel)<input name="minutes" type="number" min="0" max="1440" step="any" placeholder="Bijv. 45" disabled={busy}/></label>
    <label className={s.checkbox}><input name="pour" type="checkbox" disabled={busy}/>Storten</label>
    <small>De volledige hoeveelheid wordt één keer ingepland. Halffabricaten kun je daarna bij de productietaak meeplannen.</small><button disabled={busy} type="submit">{busy?'Inplannen…':'In weekplanning zetten'}</button>
   </form>}
   {data?.canCreate&&<button className={s.withdraw} disabled={busy} type="button" onClick={()=>void act({kind:'cancel',id:r.id})}>Verzoek intrekken</button>}
   </article>;
  })}</div>
  {!compact&&data&&!open.length&&<p className={s.empty}>Geen open productieverzoeken.</p>}
  {!!planned.length&&<details open={showPlanned} onToggle={event=>setShowPlanned(event.currentTarget.open)}><summary>Ingepland ({planned.length})</summary>{planned.map(r=><p key={r.id}>{data?.items.find(i=>i.id===r.itemId)?.name} · {r.quantity.toLocaleString('nl-NL')} · {r.plannedTask?.date.split('-').reverse().join('-')}{r.plannedTask?.status==='done'?' · klaar':''}</p>)}</details>}
 </aside>;
}
