'use client';
import { useState } from 'react';
import { fields, mapCsv, parseCsv, suggestMapping, type CsvData, type Mapping } from './csv';
import { stores, storeLabel, type OrderInput } from './model';
import { isSupplierCsv, mapSupplierCsv } from './supplierCsv';
import styles from './page.module.css';
export default function ImportPanel({edition,onImport}:{edition:string;onImport:(orders:OrderInput[],filename:string)=>Promise<void>}) {
  const [data,setData]=useState<CsvData|null>(null),[mapping,setMapping]=useState<Mapping>({}),[filename,setFilename]=useState(''),[reference,setReference]=useState(''),[store,setStore]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [orderDate,setOrderDate]=useState('');
  const supplier=!!data&&isSupplierCsv(data);
  const supplierMapped=(()=>{if(!data||!supplier||!orderDate)return null;try{return mapSupplierCsv(data,{edition,orderDate,sourceName:filename});}catch(e){return {orders:[],errors:[e instanceof Error?e.message:'Bestand niet herkend.'],sample:false,warnings:[]};}})();
  const mapped=supplier?supplierMapped:data?mapCsv(data,mapping,{edition,reference,store}):null;
  async function readFile(file?:File) {
    if(!file)return;setError('');setData(null);
    try {if(file.size>2_000_000)throw Error('Het bestand is te groot (maximaal 2 MB).');const bytes=await file.arrayBuffer();let content:string;try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{content=new TextDecoder('windows-1252').decode(bytes);}const parsed=parseCsv(content);setData(parsed);setMapping(suggestMapping(parsed.headers));setFilename(file.name);}
    catch(e){setError(e instanceof Error?e.message:'Dit bestand kon niet worden gelezen.');}
  }
  async function save(){if(!mapped || mapped.errors.length || supplierMapped?.sample || busy)return;setBusy(true);setError('');try{await onImport(mapped.orders,filename);setData(null);}catch(e){setError(e instanceof Error?e.message:'Importeren mislukt.');}finally{setBusy(false);}}
  return <details className={styles.panel}>
    <summary>Bestellingen importeren uit CSV</summary>
    <p>Kies het bestand, controleer de kolommen en bekijk het voorbeeld voordat je opslaat. Bestaande afhaalregistraties blijven behouden.</p>
    <label>CSV-bestand<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>void readFile(e.target.files?.[0])}/></label>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {data&&<>
      {supplier?<><p>Persoonlijke Noot-indeling herkend. Naam, klantcode, cadeaukaartwaarde en winkel worden automatisch overgenomen.</p><label>Besteldatum uit de mail<input type="date" value={orderDate} onChange={e=>setOrderDate(e.target.value)}/></label></>:<><div className={styles.formGrid}>{fields.map(([key,label])=><label key={key}>{label}<select value={mapping[key]||''} onChange={e=>setMapping(m=>({...m,[key]:e.target.value}))}><option value="">Niet in bestand</option>{data.headers.map(h=><option key={h} value={h}>{h}</option>)}</select></label>)}</div>
      <div className={styles.formGrid}><label>Bestelreferentie uit de mail<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Bijvoorbeeld 07-01-2026" maxLength={200}/></label><label>Winkel voor regels zonder herkende winkel<select value={store} onChange={e=>setStore(e.target.value)}><option value="">Winkel later kiezen</option>{stores.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label></div></>}
      {supplierMapped?.sample&&<p className={styles.success}>Dit is een voorbeeldbestand. Je kunt de verwerking bekijken; het wordt niet als echte bestelling opgeslagen.</p>}
      {supplierMapped?.warnings.map(w=><p key={w} className={styles.error}>{w}</p>)}
      {mapped?.errors.length ? <div role="alert" className={styles.error}>{mapped.errors.slice(0,8).map((e,i)=><p key={i}>{e}</p>)}{mapped.errors.length>8&&<p>En {mapped.errors.length-8} andere regels. Er wordt nog niets opgeslagen.</p>}</div> : null}
      <h3>Controlevoorbeeld · {mapped?.orders.length||0} regels · seizoen {edition}</h3>
      <div className={styles.tableWrap}><table><thead><tr><th>Bestelnummer / naam</th><th>Product</th><th>Aantal</th><th>Afhalen</th><th>Factuurprijs excl. btw</th></tr></thead><tbody>{mapped?.orders.slice(0,8).map((o,i)=><tr key={i}><td>{o.orderNumber}<br/>{o.name}{o.customerCode&&<><br/><small>Klantcode {o.customerCode}</small></>}<br/><small>Referentie {o.reference}</small></td><td>{o.product}</td><td>{o.quantity}</td><td>{storeLabel(o.store)}<br/>{o.pickupDateKind==='from'?'Vanaf ':''}{o.pickupDate||'Datum nog afstemmen'}</td><td>{o.unitPriceEx===null?'Nog niet bekend':new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(o.unitPriceEx)}</td></tr>)}</tbody></table></div>
      <p>{supplier?'Afhalen kan vanaf twee werkdagen na de besteldatum. De factuurprijs is de afgesproken vergoeding aan Strik, niet de waarde van de cadeaukaart.':'Het voorbeeld toont maximaal acht regels. Een leeg afhaalmoment blijft ‘Datum nog afstemmen’. Een onbekende winkel wordt niet automatisch toegewezen.'}</p>
      <button className={styles.primary} disabled={busy||!mapped?.orders.length||!!mapped.errors.length||!!supplierMapped?.sample} onClick={()=>void save()}>{busy?'Opslaan…':supplierMapped?.sample?'Alleen voorbeeld · niet opslaan':`${mapped?.orders.length||0} regels gecontroleerd · importeren`}</button>
    </>}
  </details>;
}
