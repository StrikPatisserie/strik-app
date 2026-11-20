"use client";

import { useId, useState } from "react";
import type { Ingredient, Recipe } from "./types";
import { resolveDecorationCosts, formatEuro } from "./utils";
import { validateDecorations } from "../../productie/decorations";
import OperationalDialog from "../../productie/OperationalDialog";
import s from "./DecorationsList.module.css";

export default function DecorationsList({ ingredients, recipes, onSave, readOnly = false, financialAccess = true }: {
  ingredients: Ingredient[]; recipes: Recipe[]; onSave?: (ingredient: Ingredient) => Promise<void>; readOnly?: boolean; financialAccess?: boolean;
}) {
  const [query,setQuery] = useState("");
  const [draft,setDraft] = useState<Ingredient|null>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  const heading = useId();
  const catalog = resolveDecorationCosts(ingredients).filter(i=>i.decoration);
  const rows = catalog.filter(i=>`${i.name} ${i.decoration!.code}`.toLocaleLowerCase("nl").includes(query.toLocaleLowerCase("nl"))).sort((a,b)=>a.decoration!.code.localeCompare(b.decoration!.code,"nl",{numeric:true}));
  const raw = ingredients.filter(i=>!i.decoration && ["gram","kg"].includes(i.recipeUnit) && i.status === "active").sort((a,b)=>a.name.localeCompare(b.name,"nl"));
  const d = draft?.decoration;
  const preview = draft ? resolveDecorationCosts([...ingredients.filter(i=>i.id!==draft.id),draft]).find(i=>i.id===draft.id) : null;
  function change(values: Partial<NonNullable<Ingredient["decoration"]>>) { if(draft && d) setDraft({...draft,decoration:{...d,...values}}); }
  function open(item:Ingredient) { setDraft(structuredClone(item)); setError(""); }
  function create() {
    const number = Math.max(0,...catalog.map(i=>Number.parseInt(i.decoration!.code)||0))+1;
    open({id:`deco:${crypto.randomUUID()}`,name:"",supplier:"Eigen productie",supplierArticleNumber:"",packageSize:"1 stuk",recipeUnit:"stuk",lastPrice:0,previousPrice:0,pricePerBaseUnit:0,allergens:[],lastUpdated:new Date().toISOString().slice(0,10),status:"active",lastInvoice:"",aliases:[],decoration:{code:`${String(number).padStart(2,"0")}-`,shape:"",size:"",color:"",pattern:"",method:"homemade",materials:[]}});
  }
  async function save() {
    if (!draft || !d || !onSave || busy) return;
    setBusy(true);setError("");
    try {
      const name = draft.name.replace(/^[A-Z0-9-]+\s*·\s*/i,"").trim();
      if(!name) throw Error("Vul een naam in.");
      const next = {...draft,name:`${d.code.toUpperCase()} · ${name}`,supplierArticleNumber:d.code.toUpperCase(),decoration:{...d,code:d.code.toUpperCase()},lastUpdated:new Date().toISOString().slice(0,10)};
      validateDecorations([...ingredients.filter(i=>i.id!==next.id),next]);
      await onSave(next);setDraft(null);
    } catch(cause) {setError(cause instanceof Error?cause.message:"Opslaan mislukt.");} finally {setBusy(false);}
  }
  async function photo(file?:File) {
    if(!file || !draft) return;
    setError("");
    try {
      if(!["image/jpeg","image/png","image/webp"].includes(file.type)) throw Error("Kies een JPG-, PNG- of WebP-foto.");
      const bitmap = await createImageBitmap(file), scale = Math.min(1,640/Math.max(bitmap.width,bitmap.height));
      const canvas = document.createElement("canvas"); canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
      canvas.getContext("2d")!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      const data = canvas.toDataURL("image/jpeg",.8);
      if(data.length>400000) throw Error("Deze foto is te groot. Kies een kleinere foto.");
      change({photo:data});
    }catch(cause){setError(cause instanceof Error?cause.message:"Foto openen mislukt.");}
  }
  return <section className={s.catalog} aria-label="Chocoladedecoraties">
    <header><div><h2>Chocoladedecoraties</h2><p>Kies bij een recept de code en het aantal stuks per batch.</p></div>{!readOnly && onSave && <button type="button" onClick={create}>+ Decoratie</button>}</header>
    <input className={s.search} aria-label="Zoek decoratie" placeholder="Zoek op code, vorm of kleur…" value={query} onChange={e=>setQuery(e.target.value)}/>
    <div className={s.rows}>{rows.map(item=><button type="button" className={s.row} key={item.id} onClick={()=>open(item)}>
      {item.decoration!.photo?<img src={item.decoration!.photo} alt=""/>:<span className={s.placeholder} aria-hidden="true">{item.decoration!.shape === "Vierkant"?"□":"○"}</span>}
      <span><strong>{item.name}</strong><small>{item.decoration!.method==="purchased"?"Inkoop":"Eigen productie"}{item.status==="inactive"?" · Niet actief":""} · {recipes.filter(r=>r.ingredients.some(line=>line.ingredientId===item.id)).length} recepten</small></span>
      <span>{item.decoration!.weightGrams?`${item.decoration!.weightGrams.toLocaleString("nl")} g`:<small>Nog wegen</small>}{financialAccess && <small>{item.decoration!.costKnown?`${formatEuro(item.pricePerBaseUnit)} / stuk`:"Kostprijs aanvullen"}</small>}</span>
    </button>)}</div>{!rows.length&&<p>Geen decoraties gevonden.</p>}
    {draft && d && <OperationalDialog className={s.dialog} labelledBy={heading} busy={busy} onClose={()=>setDraft(null)}>
      <form onSubmit={e=>{e.preventDefault();void save();}}><header><h2 id={heading}>{readOnly?draft.name:"Decoratie"}</h2><button type="button" disabled={busy} aria-label="Sluiten" onClick={()=>setDraft(null)}>×</button></header>
        {d.photo&&<img className={s.largePhoto} src={d.photo} alt={draft.name}/>}
        <fieldset disabled={readOnly || busy} className={s.fields}>
          <label>Code<input required maxLength={40} pattern="[A-Za-z0-9-]+" value={d.code} onChange={e=>change({code:e.target.value})}/></label>
          <label className={s.wide}>Naam<input required maxLength={150} value={draft.name.replace(/^[A-Z0-9-]+\s*·\s*/i,"")} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
          {([['shape','Vorm'],['size','Formaat'],['color','Chocolade / kleur'],['pattern','Opdruk / afwerking']] as const).map(([key,label])=><label key={key}>{label}<input value={d[key]} maxLength={120} onChange={e=>change({[key]:e.target.value})}/></label>)}
          <label>Herkomst<select value={d.method} onChange={e=>change({method:e.target.value as typeof d.method})}><option value="homemade">Eigen productie</option><option value="purchased">Inkoop</option></select></label>
          <label>Gewicht per stuk (g)<input type="number" min="0.001" max="10000" step="any" value={d.weightGrams??""} placeholder="Nog wegen" onChange={e=>change({weightGrams:e.target.value?Number(e.target.value):undefined})}/></label>
          <label>Actief<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Ingredient['status']})}><option value="active">Ja</option><option value="inactive">Nee</option></select></label>
          {!readOnly&&<label>Foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void photo(e.target.files?.[0])}/></label>}
          {d.method === "homemade" && <div className={s.wide}><h3>Grondstoffen per decoratie</h3>{d.materials.map((line,index)=><div className={s.material} key={index}>
            <select aria-label={`Grondstof ${index+1}`} required value={line.ingredientId} onChange={e=>change({materials:d.materials.map((m,i)=>i===index?{...m,ingredientId:e.target.value}:m)})}><option value="">Kies grondstof</option>{raw.map(i=><option value={i.id} key={i.id}>{i.name}</option>)}</select>
            <input aria-label={`Grammen grondstof ${index+1}`} type="number" min="0.001" max="10000" step="any" required value={line.grams||""} placeholder="Gram" onChange={e=>change({materials:d.materials.map((m,i)=>i===index?{...m,grams:Number(e.target.value)}:m)})}/>
            <button type="button" aria-label={`Grondstof ${index+1} verwijderen`} onClick={()=>change({materials:d.materials.filter((_,i)=>i!==index)})}>×</button>
          </div>)}{!readOnly&&<button type="button" onClick={()=>change({materials:[...d.materials,{ingredientId:"",grams:d.materials.length?0:d.weightGrams||0}]})}>+ Grondstof</button>}</div>}
          {financialAccess&&(d.method==="homemade"?<label>Extra kosten per stuk (€ ex.)<input type="number" step="any" min="0" max="10000" value={d.extraCostPerPiece??""} placeholder="Bijv. transfer of kleurstof" onChange={e=>change({extraCostPerPiece:e.target.value?Number(e.target.value):undefined})}/></label>:<label>Inkoopprijs per stuk (€ ex.)<input type="number" step="any" min="0" max="10000" value={d.purchasePricePerPiece??""} onChange={e=>change({purchasePricePerPiece:e.target.value?Number(e.target.value):undefined})}/></label>)}
        </fieldset>
        {financialAccess&&<p className={s.price}>{preview?.decoration?.costKnown?`Kostprijs ${formatEuro(preview.pricePerBaseUnit)} per stuk (ex. btw)`:<span>Gewicht en kostprijs nog aanvullen. Gekoppelde receptprijzen zijn voorlopig.</span>}</p>}
        {error&&<p role="alert" className={s.error}>{error}</p>}
        <footer><button type="button" disabled={busy} onClick={()=>setDraft(null)}>{readOnly?"Sluiten":"Annuleren"}</button>{!readOnly&&onSave&&<button type="submit" disabled={busy}>{busy?"Opslaan…":"Opslaan"}</button>}</footer>
      </form>
    </OperationalDialog>}
  </section>;
}
