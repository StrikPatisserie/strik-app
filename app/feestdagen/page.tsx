/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type {CSSProperties} from "react";
import {StrikShell} from "../StrikUI";
import {requireCurrentProfile} from "../lib/auth/session";
import {hasFullAccess,canAccessPath} from "../lib/auth/access";
import {getSeasons} from "./server";
import {HOLIDAYS,amsterdamYear} from "./model";
import styles from "./Feestdagen.module.css";
export const dynamic="force-dynamic";
export default async function FeestdagenPage({searchParams}:{searchParams:Promise<{jaar?:string}>}){
 const profile=await requireCurrentProfile(),manager=hasFullAccess(profile),params=await searchParams;
 const year=/^20\d{2}$/.test(params.jaar||"")?Number(params.jaar):amsterdamYear(), seasons=await getSeasons();
 const years=Array.from(new Set([amsterdamYear()+1,amsterdamYear(),...seasons.map(s=>s.year)])).sort((a,b)=>b-a);
 const editions=seasons.filter(s=>s.year===year),active=HOLIDAYS.filter(h=>editions.some(s=>s.season===h.id&&s.state!=="closed")),inactive=HOLIDAYS.filter(h=>!active.includes(h));
 const business=editions.some(s=>s.state==="active"&&s.config.business),mailing=editions.some(s=>s.state==="active"&&s.config.mailing);
 function cards(list:typeof HOLIDAYS[number][]){return <div className={styles.grid}>{list.map(h=>{const s=editions.find(s=>s.season===h.id),on=s?.state==="active",pending=s&&["opening","closing"].includes(s.state);return <article key={h.id} className={styles.card} style={{"--season-color":h.color} as CSSProperties}><div className={styles.cardHead}><img src={h.icon} alt=""/><span className={`${styles.badge} ${on?"":pending?styles.pending:styles.off}`}>{on?"Aan":pending?"Afronden":s?.state==="closed"?"Afgesloten":"Uit"}</span></div><h2>{h.name}</h2><p className={styles.muted}>{s?.state==="closed"?`Editie ${year} bewaard in het jaararchief.`:on?`${year} · ${s.config.owner}`:pending?"Er staat nog een seizoensactie open.":"Open met een korte inrichting voor deze editie."}</p><div className={styles.tools}>{s?<Link className={styles.secondary} href={`/feestdagen/${h.id}?jaar=${year}`}>{s.state==="closed"?"Bekijk archief":"Open seizoen →"}</Link>:manager&&<Link className={styles.secondary} href={`/feestdagen/${h.id}/start?jaar=${year}`}>Seizoen starten</Link>}</div></article>})}</div>}
 return <StrikShell extraWide><div className={styles.page}><header className={styles.header}><div><p className={styles.eyebrow}>Samen voorbereiden · uitvoeren · leren</p><h1>Feestdagen</h1><p className={styles.muted}>Alle seizoenen op één plek. Zet een editie aan met de seizoensstart en bewaar de resultaten bij het afsluiten.</p></div><nav aria-label="Seizoensjaar" className={styles.tabs}>{years.map(y=><Link key={y} aria-current={y===year?"page":undefined} href={`/feestdagen?jaar=${y}`}>{y}</Link>)}</nav></header>
 <div className={styles.tools}>{business&&(canAccessPath(profile,"/sinterklaas/b2b")||canAccessPath(profile,"/kerst/b2b"))&&<Link className={styles.button} href={`/feestdagen/bedrijven?jaar=${year}`}>B2B-bestellingen</Link>}{mailing&&(canAccessPath(profile,"/sinterklaas/mailing")||canAccessPath(profile,"/kerst/mailing"))&&<Link className={styles.button} href={`/feestdagen/nieuwsbrief?jaar=${year}`}>Gezamenlijke nieuwsbrief</Link>}{manager&&<Link className={styles.secondary} href={`/management/cijfers-evaluaties?jaar=${year}`}>Feestdagenevaluaties</Link>}</div>
 <h2 className="mb-4 mt-6 text-lg font-black">Actief in {year}</h2>{active.length?cards(active):<p className={styles.panel}>Er staan nog geen seizoenen aan voor {year}.{manager?" Kies hieronder een seizoen om te starten.":" Management kan een nieuwe editie openen."}</p>}
 {manager&&<details className={styles.quiet} open={!active.length}><summary>Andere seizoenen & archief ({inactive.length})</summary>{cards(inactive)}</details>}</div></StrikShell>;
}
