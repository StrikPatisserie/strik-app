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
      <div className={styles.titleRow}><div><p className={styles.brand}>Strik Patisserie / Logistiek</p><h2>Verdeellijst chocoladeletters</h2><p className={styles.date}>{date(batch.startDate)}</p></div><span className={styles.version} data-provisional={!batch.checklist}>{batch.checklist?<>Vastgezet<strong>Versie {batch.checklist.planRevision}</strong></>:<>Voorlopig<strong>Nog wijzigbaar</strong></>}</span></div>
      <div className={styles.summary}><dl><div><dt>Totaal te verdelen</dt><dd>{total}</dd></div></dl><p>Pak per krat de juiste letter, smaak, het formaat en de uitvoering. Verdeel daarna per klant of vestiging.</p></div>
      {unresolved>0&&<p className={styles.warning}><strong>EERST CONTROLEREN:</strong> bij {unresolved} letters ontbreekt een sluitende klant- of winkelverdeling. Deze aantallen staan apart gemarkeerd; vul geen klantnaam op eigen inschatting in.</p>}
      {!!batch.checklist?.changes.length&&<p className={styles.warning}><strong>VERDELING NIET ACTUEEL.</strong> Neem eerst de gewijzigde bestellingen over in de app en print opnieuw.</p>}
      <p className={styles.crateGuide}>Overzicht van alle letters. De aantallen per krat en klant volgen hieronder. Printen verandert geen productie- of bestelstatus.</p>
    </header>
    <table className={`${styles.table} ${styles.distributionOverview}`}><thead><tr className={styles.columns}><th>Letter / uitvoering</th>{CRATES.slice(0,4).map(crate=><th key={crate.id}>{crate.number} · {crate.label}</th>)}<th>Totaal</th></tr></thead><tbody>{productionSections(rows).flatMap(section=>section.groups.flatMap(group=>group.rows.map(row=>{
      const variant=productionVariant(row.label),sources=new Map(productionSourceBreakdown(row).map(item=>[item.id,item.quantity]));
      return <tr key={row.key} className={styles.row}><th scope="row"><strong>{variant.letter} · {group.label} · {section.label}</strong>{variant.extras.length>0&&<div className={styles.distributionSpecial}>LET OP: {variant.extras.join(" · ")}</div>}{(sources.get("onbekend")||0)>0&&<div>Herkomst onbekend: {sources.get("onbekend")}</div>}</th>{CRATES.slice(0,4).map(crate=><td key={crate.id} className={styles.quantity}>{sources.get(crate.id)||"—"}</td>)}<td className={styles.total}>{row.orders+row.stock}</td></tr>;
    })))}</tbody></table>
    {crates.map(crate=><section key={crate.id} className={styles.crateSection} aria-label={crate.label}>
      <h2 className={styles.crateTitle}>{crate.number?`Krat ${crate.number} / `:""}{crate.label}<span>{crate.groups.reduce((sum,group)=>sum+group.total,0)} stuks</span></h2>
      {crate.groups.map(group=><table key={group.row.key} className={`${styles.table} ${styles.distributionTable}`}>
        <colgroup><col className={styles.distributionDoneCol}/><col className={styles.distributionQuantityCol}/><col/><col className={styles.distributionDestinationCol}/></colgroup>
        <thead><tr className={styles.groupHeading}><th colSpan={4}><div><h3><strong>{group.variant.letter}</strong> {group.group} · {group.style}</h3><span>{group.total} stuks / {crate.label}</span></div>{group.variant.extras.length>0&&<p className={styles.distributionSpecial}>LET OP: {group.variant.extras.join(" · ")}</p>}</th></tr><tr className={styles.columns}><th>Klaar</th><th>Aantal</th><th>Klant / bestemming</th><th>Vestiging / leverdatum</th></tr></thead>
        <tbody>{group.recipients.map((item,index)=><tr key={`${item.id}-${index}`} className={styles.row} data-unresolved={item.unresolved||undefined}>
          <td className={styles.done}><span className={styles.checkBox} aria-label="Verdeling afvinken"/></td><td className={styles.total} data-distribution-quantity={item.quantity}>{item.quantity}×</td>
          <td className={styles.distributionCustomer}><strong>{item.customerName}</strong>{"code" in item&&item.code&&<small>{item.code}</small>}{item.notes&&<p className={item.unresolved?styles.distributionSpecial:styles.recipientNotes}>{item.unresolved?"CONTROLE: ":"Opmerking: "}{item.notes}</p>}</td>
          <td className={styles.distributionDestination}>{"shop" in item&&item.shop&&<strong>{shops[item.shop]||item.shop}</strong>}{"date" in item&&item.date&&<span>{date(item.date)}</span>}</td>
        </tr>)}</tbody>
      </table>)}
    </section>)}
    {!total&&<p className={styles.empty}>Geen letters te verdelen in deze ronde.</p>}
    <footer className={styles.footer}>Controleer bij iedere klant ook foto/logo, allergiewensen en het inpakken. De vakjes op deze lijst zijn voor het verdelen; de productievoortgang blijft apart in de app staan.</footer>
  </article>;
}

export default function ProductionDistributionPrint({batch,onClose}:Readonly<{batch:ProductionBatchSeed;onClose:()=>void}>) {
  return createPortal(<div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="distribution-print-title"><div className={styles.toolbar}><div><h2 id="distribution-print-title">Verdelen / printvoorbeeld</h2><p>A4 liggend · zwart-wit · per krat, letter en klant</p></div><div className={styles.actions}><button type="button" onClick={onClose}>Sluiten</button><button type="button" className={styles.printButton} onClick={()=>window.print()}>Print verdeellijst</button></div></div><div className={styles.paperViewport}><ProductionDistributionSheet batch={batch}/></div></div>,document.body);
}
