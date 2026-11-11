"use client";

import { createPortal } from "react-dom";
import type { ProductionBatchSeed } from "./ProductionPlanningClient";
import { productionSections, productionVariant } from "./productionPresentation";
import { productionRecipientsFor, productionSourceBreakdown } from "./productionSources";
import styles from "./ProductionPrint.module.css";

const CRATES = [
  {id:"winkel",number:1,label:"Winkelbestellingen"},
  {id:"voorraad",number:2,label:"Winkelvoorraad"},
  {id:"online",number:3,label:"Online Lettershop"},
  {id:"b2b",number:4,label:"B2B-bestellingen"},
  {id:"onbekend",number:0,label:"Herkomst controleren"},
] as const;
const shops:Record<string,string>={ziekerstraat:"Ziekerstraat",heyendaal:"Heyendaal",daalseweg:"Daalseweg",lent:"Lent"};
const date=(value:string)=>new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));

const logoMark=()=><strong className={styles.inlineLogo}><svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true"><rect x="2" y="2" width="16" height="16" rx="1" fill="none" stroke="currentColor"/><circle cx="7" cy="7" r="2" fill="none" stroke="currentColor"/><path d="m3 16 5-5 3 3 3-4 4 6" fill="none" stroke="currentColor"/></svg> LOGO!</strong>;

export function ProductionDistributionSheet({batch}:Readonly<{batch:ProductionBatchSeed}>) {
  const rows=batch.rows.filter(row=>row.orders+row.stock>0);
  const total=rows.reduce((sum,row)=>sum+row.orders+row.stock,0);
  const crates=CRATES.map(crate=>({...crate,groups:productionSections(rows).flatMap(section=>section.groups.flatMap(group=>group.rows.flatMap(row=>{
    const recipients=productionRecipientsFor(row,crate.id);
    if(!recipients.length)return [];
    return [{row,recipients,variant:productionVariant(row.label),style:section.label,group:group.label,total:recipients.reduce((sum,item)=>sum+item.quantity,0)}];
  })))})).filter(crate=>crate.groups.length);
  const unresolved=crates.flatMap(crate=>crate.groups.flatMap(group=>group.recipients)).filter(item=>item.unresolved).reduce((sum,item)=>sum+item.quantity,0);
  return <article className={`${styles.sheet} ${styles.distributionSheet}`} aria-label="Verdeellijst chocoladeletters per krat en klant">
    <header className={styles.header}>
      <div className={styles.titleRow}><div><p className={styles.brand}>Strik Patisserie / Logistiek</p><h2>Verdeellijst chocoladeletters</h2><p className={styles.date}>{date(batch.startDate)}</p></div><span className={styles.version} data-provisional={!batch.checklist?.lockedAt}>{batch.checklist?.lockedAt?<>Vastgezet<strong>Versie {batch.checklist.planRevision}</strong></>:<>Voorlopig<strong>Nog wijzigbaar</strong></>}</span></div>
      <div className={styles.summary}><dl><div><dt>Totaal te verdelen</dt><dd>{total}</dd></div></dl><p>Pak per krat de juiste letter, smaak, het formaat en de uitvoering. Verdeel daarna per klant of vestiging.</p></div>
      {unresolved>0&&<p className={styles.warning}><strong>EERST CONTROLEREN:</strong> bij {unresolved} letters ontbreekt een sluitende klant- of winkelverdeling. Deze aantallen staan apart gemarkeerd; vul geen klantnaam op eigen inschatting in.</p>}
      {!!batch.checklist?.changes.length&&<p className={styles.warning}><strong>VERDELING NIET ACTUEEL.</strong> Neem eerst de gewijzigde bestellingen over in de app en print opnieuw.</p>}
      <p className={styles.crateGuide}>Overzicht van alle letters. De aantallen per krat en klant volgen hieronder. Printen verandert geen productie- of bestelstatus.</p>
    </header>
    <table className={`${styles.table} ${styles.distributionOverview}`}><thead><tr className={styles.columns}><th>Letter / uitvoering</th>{CRATES.slice(0,4).map(crate=><th key={crate.id}>{crate.number} · {crate.label}</th>)}<th>Totaal</th></tr></thead><tbody>{productionSections(rows).flatMap(section=>section.groups.flatMap(group=>group.rows.map(row=>{
      const variant=productionVariant(row.label),sources=new Map(productionSourceBreakdown(row).map(item=>[item.id,item.quantity]));
      return <tr key={row.key} className={styles.row}><th scope="row"><strong>{variant.letter} · {group.label} · {section.label}</strong>{variant.extras.length>0&&<span className={styles.overviewExtras}> · {variant.extras.map(extra=>extra.toLowerCase()==="logo"?"LOGO!":extra).join(" · ")}</span>}{(sources.get("onbekend")||0)>0&&<div>Herkomst onbekend: {sources.get("onbekend")}</div>}</th>{CRATES.slice(0,4).map(crate=><td key={crate.id} className={styles.quantity}>{sources.get(crate.id)||"—"}</td>)}<td className={styles.total}>{row.orders+row.stock}</td></tr>;
    })))}</tbody></table>
    {crates.map(crate=><section key={crate.id} className={styles.crateSection} aria-label={crate.label}>
      <h2 className={styles.crateTitle}>{crate.number?`Krat ${crate.number} / `:""}{crate.label}<span>{crate.groups.reduce((sum,group)=>sum+group.total,0)} stuks</span></h2>
      {Array.from(crate.groups.reduce((customers,group)=>{
        group.recipients.forEach(item=>{
          const identity=JSON.stringify([item.id,"shop" in item?item.shop:"","date" in item?item.date:""]);
          const customer=customers.get(identity)||{item,lines:[] as {group:typeof group;quantity:number;combinationProduct?:string}[]};
          customer.lines.push({group,quantity:item.quantity,combinationProduct:item.combinationProduct});customers.set(identity,customer);
        });return customers;
      },new Map<string,{item:(typeof crate.groups)[number]["recipients"][number];lines:{group:(typeof crate.groups)[number];quantity:number;combinationProduct?:string}[]}>())).map(([identity,{item,lines}])=><div key={identity} className={styles.customerCutout}>
        <header className={styles.cutoutHeader}><strong>{item.customerName}</strong>{lines.every(({group})=>group.variant.extras.some(extra=>extra.toLowerCase()==="logo"))&&logoMark()}{"code" in item&&item.code&&!item.code.startsWith("b2b-")&&<small>{item.code}</small>}{"shop" in item&&item.shop&&<span>{shops[item.shop]||item.shop}</span>}{"date" in item&&item.date&&<span>{date(item.date)}</span>}</header>
        <div className={styles.cutoutLines}>{lines.map(({group,quantity,combinationProduct},index)=><div key={`${group.row.key}-${index}`} className={styles.cutoutLine} data-unresolved={item.unresolved||undefined}>
          <span className={styles.checkBox} aria-label="Verdeling afvinken"/><strong data-distribution-quantity={quantity}>{quantity}×</strong><span><b>{group.variant.letter}</b> · {group.group} · {group.style}</span>
          {!lines.every(({group})=>group.variant.extras.some(extra=>extra.toLowerCase()==="logo"))&&group.variant.extras.some(extra=>extra.toLowerCase()==="logo")&&logoMark()}
          {combinationProduct&&<strong className={styles.combinationMark}>COMBINATIE: {combinationProduct}</strong>}
          {group.variant.extras.filter(extra=>extra.toLowerCase()!=="logo").map(extra=><strong key={extra}>{extra}</strong>)}
        </div>)}</div>
        {item.notes&&<p className={styles.cutoutNotes}>{item.unresolved?"CONTROLE: ":""}{item.notes}</p>}
      </div>)}
    </section>)}
    {!total&&<p className={styles.empty}>Geen letters te verdelen in deze ronde.</p>}
    <footer className={styles.footer}>Controleer bij iedere klant ook foto/logo, allergiewensen en het inpakken. De vakjes op deze lijst zijn voor het verdelen; de productievoortgang blijft apart in de app staan.</footer>
  </article>;
}

export default function ProductionDistributionPrint({batch,onClose}:Readonly<{batch:ProductionBatchSeed;onClose:()=>void}>) {
  return createPortal(<div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="distribution-print-title"><div className={styles.toolbar}><div><h2 id="distribution-print-title">Verdelen / printvoorbeeld</h2><p>A4 portret · compact · uitknippen per klantbestelling</p></div><div className={styles.actions}><button type="button" onClick={onClose}>Sluiten</button><button type="button" className={styles.printButton} onClick={()=>window.print()}>Print verdeellijst</button></div></div><div className={styles.paperViewport}><ProductionDistributionSheet batch={batch}/></div></div>,document.body);
}
