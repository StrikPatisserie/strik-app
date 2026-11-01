"use client";
import {useState,type FormEvent} from 'react';
import type {Item} from './planning';
import type {IngredientView} from './workspaceData';
import s from './requests.module.css';
export default function QuickRecipeForm({item,ingredients,getRevision,recipeRevision,onSaved,onClose}:{item:Item;ingredients:IngredientView[];getRevision:()=>number;recipeRevision:number;onSaved:()=>Promise<void>;onClose:()=>void}){
 const [rows,setRows]=useState([0]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;const form=new FormData(event.currentTarget);setBusy(true);setError('');
  try{const response=await fetch('/api/productie/snel-recept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:getRevision(),recipeRevision,command:{itemId:item.id,yield:Number(form.get('yield')),instructions:String(form.get('instructions')),ingredients:rows.map(row=>({ingredientId:String(form.get(`ingredient-${row}`)),quantity:Number(form.get(`quantity-${row}`)),unit:String(form.get(`unit-${row}`))}))}})}),data=await response.json();if(!response.ok)throw Error(data.message||'Recept opslaan mislukt.');await onSaved();onClose();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <form className={`${s.panel} ${s.form}`} onSubmit={submit}><p>Leg het werkrecept vast. Het wordt als concept bij dit bestaande onderdeel opgeslagen; controle van allergenen en kostprijs volgt in receptenbeheer.</p>
  <label>Basisopbrengst ({item.unit})<input name="yield" type="number" min="0.000001" max="1000000" step="any" required disabled={busy}/></label>
  {rows.map(row=><fieldset key={row} className={s.form}><legend>Grondstof {rows.indexOf(row)+1}</legend><label>Grondstof<select name={`ingredient-${row}`} required disabled={busy}><option value="">Kies grondstof</option>{ingredients.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><label>Hoeveelheid<input name={`quantity-${row}`} type="number" min="0.000001" max="1000000" step="any" required disabled={busy}/></label><label>Eenheid<select name={`unit-${row}`} disabled={busy}>{['gram','kg','ml','liter','stuk'].map(unit=><option key={unit}>{unit}</option>)}</select></label>{rows.length>1&&<button type="button" disabled={busy} onClick={()=>setRows(current=>current.filter(id=>id!==row))}>Regel verwijderen</button>}</fieldset>)}
  <button type="button" disabled={busy||rows.length>=50} onClick={()=>setRows(current=>[...current,Math.max(...current)+1])}>+ Grondstof</button>
  <label>Werkwijze<textarea name="instructions" rows={4} required maxLength={10000} disabled={busy} placeholder="Hoe maken jullie dit?"/></label>
  {error&&<p role="alert" className={s.error}>{error}</p>}
  <button type="submit" disabled={busy}>{busy?'Opslaan…':'Werkrecept opslaan'}</button><button type="button" disabled={busy} onClick={onClose}>Later aanvullen</button>
 </form>;
}
