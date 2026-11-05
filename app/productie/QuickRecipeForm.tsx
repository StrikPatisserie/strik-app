"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {Item} from './planning';
import type {IngredientView} from './workspaceData';
import type {WorkRecipeInput} from './workRecipe';
import s from './requests.module.css';
export default function QuickRecipeForm({item,ingredients,getRevision,recipeRevision,onSaved,onClose}:{item:Item;ingredients:IngredientView[];getRevision:()=>number;recipeRevision:number;onSaved:()=>Promise<void>;onClose:()=>void}){
 const editing=Boolean(item.recipeId);
 const nextRow=useRef(1),nextSemi=useRef(0);
 const [rows,setRows]=useState([0]),[semiRows,setSemiRows]=useState<number[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState<{draft:WorkRecipeInput;recipeRevision:number;semiFinished:{id:string;name:string}[]}|null>(null);
 useEffect(()=>{
  if(!item.recipeId)return;
  let cancelled=false;
  async function load(){try{
   const response=await fetch(`/api/productie/snel-recept?itemId=${encodeURIComponent(item.id)}`,{cache:'no-store'}),data=await response.json();
   if(!response.ok)throw Error(data.message||'Werkrecept laden mislukt.');
   if(!cancelled){setLoaded(data);nextRow.current=data.draft.ingredients.length;nextSemi.current=data.draft.semiFinishedItems.length;setRows(data.draft.ingredients.map((_:unknown,index:number)=>index));setSemiRows(data.draft.semiFinishedItems.map((_:unknown,index:number)=>index));}
  }catch(e){if(!cancelled)setError((e as Error).message);}}
  void load();return()=>{cancelled=true;};
 },[item.id,item.recipeId]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||editing&&!loaded)return;const form=new FormData(event.currentTarget);setBusy(true);setError('');
  try{const response=await fetch('/api/productie/snel-recept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:getRevision(),recipeRevision:editing?loaded!.recipeRevision:recipeRevision,command:{itemId:item.id,yield:Number(form.get('yield')),instructions:String(form.get('instructions')),ingredients:rows.map(row=>({ingredientId:String(form.get(`ingredient-${row}`)),quantity:Number(form.get(`quantity-${row}`)),unit:String(form.get(`unit-${row}`))})),...(editing?{recipeId:loaded!.draft.recipeId,workInstructions:String(form.get('workInstructions')),finishingInstructions:String(form.get('finishingInstructions')),semiFinishedItems:semiRows.map(row=>({recipeId:String(form.get(`semi-${row}`)),quantity:Number(form.get(`semi-quantity-${row}`)),unit:String(form.get(`semi-unit-${row}`))}))}:{})}})}),data=await response.json();if(!response.ok)throw Error(data.message||'Recept opslaan mislukt.');await onSaved();onClose();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 if(editing&&!loaded)return <div className={s.panel}>{error?<p role="alert" className={s.error}>{error} Sluit dit venster en open het opnieuw.</p>:<p role="status">Werkrecept laden…</p>}<button type="button" onClick={onClose}>Sluiten</button></div>;
 const draft=loaded?.draft;
 return <form className={`${s.panel} ${s.form}`} onSubmit={submit}><p>{editing?'Pas het werkrecept aan. De wijziging wordt als concept bewaard; controleer daarna de geplande producties.':'Leg het werkrecept vast. Het wordt als concept bij dit bestaande onderdeel opgeslagen; controle van allergenen en kostprijs volgt in receptenbeheer.'}</p>
  <label>Basisopbrengst ({item.unit})<input name="yield" type="number" min="0.000001" max="1000000" step="any" required disabled={busy} defaultValue={draft?.yield}/></label>
  {rows.map(row=><fieldset key={row} className={s.form}><legend>Grondstof {rows.indexOf(row)+1}</legend><label>Grondstof<select name={`ingredient-${row}`} required disabled={busy} defaultValue={draft?.ingredients[row]?.ingredientId||''}><option value="">Kies grondstof</option>{ingredients.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><label>Hoeveelheid<input name={`quantity-${row}`} type="number" min="0.000001" max="1000000" step="any" required disabled={busy} defaultValue={draft?.ingredients[row]?.quantity}/></label><label>Eenheid<select name={`unit-${row}`} disabled={busy} defaultValue={draft?.ingredients[row]?.unit||'gram'}>{['gram','kg','ml','liter','stuk'].map(unit=><option key={unit}>{unit}</option>)}</select></label>{(editing||rows.length>1)&&<button type="button" disabled={busy} onClick={()=>setRows(current=>current.filter(id=>id!==row))}>Regel verwijderen</button>}</fieldset>)}
  <button type="button" disabled={busy||rows.length>=50} onClick={()=>{const id=nextRow.current++;setRows(current=>[...current,id]);}}>+ Grondstof</button>
  {editing&&<>{semiRows.map(row=><fieldset key={row} className={s.form}><legend>Halffabricaat {semiRows.indexOf(row)+1}</legend><label>Halffabricaat<select name={`semi-${row}`} required disabled={busy} defaultValue={draft?.semiFinishedItems[row]?.recipeId||''}><option value="">Kies halffabricaat</option>{loaded!.semiFinished.map(recipe=><option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select></label><label>Hoeveelheid<input name={`semi-quantity-${row}`} type="number" min="0.000001" max="1000000" step="any" required disabled={busy} defaultValue={draft?.semiFinishedItems[row]?.quantity}/></label><label>Eenheid<select name={`semi-unit-${row}`} disabled={busy} defaultValue={draft?.semiFinishedItems[row]?.unit||'gram'}>{['gram','kg','ml','liter','stuk'].map(unit=><option key={unit}>{unit}</option>)}</select></label><button type="button" disabled={busy} onClick={()=>setSemiRows(current=>current.filter(id=>id!==row))}>Halffabricaat verwijderen</button></fieldset>)}<button type="button" disabled={busy||semiRows.length>=50} onClick={()=>{const id=nextSemi.current++;setSemiRows(current=>[...current,id]);}}>+ Halffabricaat</button><label>Werkvoorbereiding<textarea name="workInstructions" rows={3} maxLength={10000} disabled={busy} defaultValue={draft?.workInstructions}/></label></>}
  <label>Werkwijze<textarea name="instructions" rows={4} required={!editing} maxLength={10000} disabled={busy} placeholder="Hoe maken jullie dit?" defaultValue={draft?.instructions}/></label>
  {editing&&<label>Afwerking<textarea name="finishingInstructions" rows={3} maxLength={10000} disabled={busy} defaultValue={draft?.finishingInstructions}/></label>}
  {error&&<p role="alert" className={s.error}>{error}</p>}
  <button type="submit" disabled={busy}>{busy?'Opslaan…':'Werkrecept opslaan'}</button><button type="button" disabled={busy} onClick={onClose}>{editing?'Annuleren':'Later aanvullen'}</button>
 </form>;
}
