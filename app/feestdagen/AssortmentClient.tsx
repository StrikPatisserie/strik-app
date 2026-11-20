'use client';
/* eslint-disable @next/next/no-img-element */
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {importAssortment,saveSeasonProduct,toggleSeasonProduct} from './assortment-actions';
import {PRODUCT_CATEGORIES,productMoney,productPhotoUrl,type SeasonProduct} from './assortment';
import styles from './Feestdagen.module.css';
import SeasonProductPhoto from './SeasonProductPhoto';
export default function AssortmentClient({season,year,products,editable,canImport}:{season:string;year:number;products:SeasonProduct[];editable:boolean;canImport:boolean}){
 const router=useRouter(),[editing,setEditing]=useState<SeasonProduct|'new'|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[category,setCategory]=useState('Alles'),[showRemoved,setShowRemoved]=useState(false),[photo,setPhoto]=useState<SeasonProduct|null>(null);
 const current=editing&&editing!=='new'?editing:null;
 async function run(action:()=>Promise<{ok?:boolean;message:string}>,close=false){setBusy(true);setError('');setNotice('');try{const result=await action();if(result.ok){setNotice(result.message);if(close)setEditing(null);}else setError(result.message);router.refresh();}catch{setError('De verbinding is onderbroken. Probeer opnieuw.');}finally{setBusy(false);}}
 const visible=products.filter(p=>(showRemoved||p.active)&&(category==='Alles'||p.category===category));
 const groups=[
  {id:'gebak-taart',title:'Gebak & taart',products:visible.filter(p=>p.category==='Gebak'||p.category==='Taart'),secondary:false},
  {id:'overige-producten',title:'Overige producten',products:visible.filter(p=>p.category!=='Gebak'&&p.category!=='Taart'),secondary:true},
 ];
 return <>
  <div className={styles.assortmentToolbar}><label className={styles.filterField}>Categorie<select value={category} onChange={e=>setCategory(e.target.value)}><option>Alles</option>{PRODUCT_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><span className={styles.muted}>{products.filter(p=>p.active).length} producten · {year}</span>{editable&&<button className={styles.button} disabled={busy} onClick={()=>{setEditing('new');setError('');}}>+ Product toevoegen</button>}</div>

  {notice&&<p role="status" className={styles.success}>{notice}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}
  {editing&&<form key={current?.id||'new'} className={styles.panel} onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void run(()=>saveSeasonProduct(season,year,form),true);}}><h2>{current?'Product aanpassen':`Product voor ${year}`}</h2><fieldset disabled={busy}><input type="hidden" name="id" value={current?.id||''}/><input type="hidden" name="revision" value={current?.revision||0}/><div className={styles.fields}>
   <label className={styles.field}>Productnaam<input name="name" autoFocus required maxLength={180} defaultValue={current?.name||''}/></label><label className={styles.field}>Categorie<select name="category" defaultValue={current?.category||'Gebak'}>{PRODUCT_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
   <label className={styles.field}>Uitvoering / formaat<input name="variant" maxLength={500} defaultValue={current?.variant||''} placeholder="Bijv. 6 personen of per stuk"/></label><label className={styles.field}>Prijs<input name="price" inputMode="decimal" required defaultValue={current?(current.price_cents/100).toFixed(2).replace('.',','):''} placeholder="0,00"/></label>
   <label className={styles.field}>Btw<select name="vat" defaultValue={current?.price_includes_vat===false?'excl':'incl'}><option value="incl">Inclusief btw</option><option value="excl">Exclusief btw</option></select></label><label className={styles.field}>{current?.photo_id?'Foto vervangen':'Productfoto'}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif"/><small>JPG, PNG, WebP of GIF · maximaal 8 MB</small></label>
  </div><div className={styles.tools}><button className={styles.button}>{busy?'Bewaren…':'Product bewaren'}</button><button type="button" className={styles.secondary} onClick={()=>setEditing(null)}>Annuleren</button></div></fieldset></form>}
  {visible.length?groups.filter(group=>group.products.length>0).map(group=><section key={group.id} className={`${styles.assortmentSection} ${group.secondary?styles.otherAssortment:''}`} aria-labelledby={group.id}>
   <header className={styles.assortmentSectionHeader}><h2 id={group.id}>{group.title}</h2><span>{group.products.length}</span></header>
   <div className={styles.productGrid}>{group.products.map(p=>{
    const fromPrice=/^Vanafprijs\b/.test(p.variant);
    const variant=p.variant.replace(/^Vanafprijs(?: · uitvoering volgens webshop)?(?: · )?/, '');
    return <article className={styles.productCard} key={p.id} data-product-name={p.name}>
     {p.photo_id?<button type="button" className={styles.productPhotoButton} aria-label={`Bekijk foto van ${p.name}`} aria-haspopup="dialog" onClick={()=>setPhoto(p)}><img src={productPhotoUrl(p.photo_id)} alt="" loading="lazy"/></button>:<div className={styles.noPhoto}>Geen foto</div>}
     <div className={styles.productBody}><h3>{p.name}</h3>{variant&&<p className={styles.productVariant}>{variant}</p>}<p className={styles.productPrice}>{fromPrice?'Vanaf ':''}{productMoney(p.price_cents)} <small>{p.price_includes_vat?'incl.':'excl.'} btw</small></p>{!p.active&&<p className={styles.removedProduct}>Uit assortiment</p>}</div>
     {editable&&<details className={styles.productMenu}><summary aria-label={`Opties voor ${p.name}`}>⋯</summary><div><button type="button" disabled={busy} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');setEditing(p);setError('');}}>Aanpassen</button><button type="button" disabled={busy} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');void run(()=>toggleSeasonProduct(season,year,p.id,p.revision,!p.active));}}>{p.active?'Uit assortiment':'Terugzetten'}</button></div></details>}
    </article>;
   })}</div>
  </section>):<p className={styles.panel}>{products.length?'Geen producten in deze selectie.':`Nog geen producten voor ${year}.`}</p>}
  {photo&&<SeasonProductPhoto key={photo.id} product={photo} onClose={()=>setPhoto(null)}/>}

  {products.some(p=>!p.active)&&<label className={styles.check}><input type="checkbox" checked={showRemoved} onChange={e=>setShowRemoved(e.target.checked)}/>Ook producten tonen die uit het assortiment zijn gehaald</label>}
  {editable&&canImport&&<details className={styles.importOptions}><summary>Producten overnemen</summary><p>Nieuwe producten toevoegen vanuit de webshop of folder.</p><div className={styles.tools}><button className={styles.secondary} disabled={busy} onClick={()=>run(()=>importAssortment(season,year,'webshop'))}>{busy?'Bezig…':'Uit de webshop'}</button>{season==='kerst'&&<button className={styles.secondary} disabled={busy} onClick={()=>run(()=>importAssortment(season,year,'folder'))}>Uit de kerstfolder</button>}</div></details>}
 </>;
}
