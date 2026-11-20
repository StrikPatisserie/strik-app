import Link from "next/link";
import {notFound} from "next/navigation";
import {StrikShell} from "../../StrikUI";
import {requireCurrentProfile} from "../../lib/auth/session";
import {hasFullAccess,canAccessPath} from "../../lib/auth/access";
import {getSeason,getSeasonArchive,getActiveSeason} from "../server";
import {amsterdamYear,holiday} from "../model";
import SeasonArchivePanel from "../SeasonArchivePanel";
import styles from "../Feestdagen.module.css";
export const dynamic="force-dynamic";
export default async function SeasonPage({params,searchParams}:{params:Promise<{season:string}>;searchParams:Promise<{jaar?:string}>}){
 const {season:id}=await params,query=await searchParams,h=holiday(id);if(!h)notFound();
 const profile=await requireCurrentProfile(),manager=hasFullAccess(profile),year=/^20\d{2}$/.test(query.jaar||"")?Number(query.jaar):(await getActiveSeason(h.id))?.year||amsterdamYear();
 const season=await getSeason(id,year),archive=manager&&season?.state==="closed"?await getSeasonArchive(id,year):null;
 const modules=season?.state==="active"?[
 ...(season.config.letters?[{href:"/sinterklaas/letters",title:"Chocoladeletters",detail:"Winkel, lettershop, productie en verdeellijsten"}]:[]),
 ...(season.config.business?[{href:`/feestdagen/bedrijven?seizoen=${id}&jaar=${year}`,permission:id==="kerst"?"/kerst/b2b":"/sinterklaas/b2b",title:"B2B-bestellingen",detail:"De gezamenlijke lijst voor Sint en Kerst"}]:[]),
 ...(season.config.mailing?[{href:`/feestdagen/nieuwsbrief?seizoen=${id}&jaar=${year}`,permission:id==="kerst"?"/kerst/mailing":"/sinterklaas/mailing",title:"Nieuwsbrief",detail:"Gedeelde contacten, eigen campagne per seizoen en jaar"}]:[]),
 ...(id==="vierdaagse"?[{href:"/vierdaagse",title:"Kraam & bediening",detail:"De bestaande Vierdaagse-werkomgeving"}]:[]),
 ]:[];
 return <StrikShell extraWide><div className={styles.page}><Link className={styles.muted} href={`/feestdagen?jaar=${year}`}>← Feestdagen {year}</Link><header className={styles.header}><div><p className={styles.eyebrow}>Feestdagen · {year}</p><h1>{h.name}</h1></div><span className={`${styles.badge} ${season?.state==="active"?"":styles.off}`}>{season?.state==="active"?"Aan":season?.state==="closed"?"Afgesloten":season?"Nog afronden":"Uit"}</span></header>
 {modules.length>0&&<div className={styles.grid}>{modules.filter(m=>canAccessPath(profile,("permission" in m?m.permission:undefined)||m.href)).map(m=><Link key={m.href} className={styles.card} href={m.href}><h2>{m.title}</h2><p className={styles.muted}>{m.detail}</p><span>Open →</span></Link>)}</div>}
 {season?.state==="active"&&<section className={styles.panel}><h2>Afspraken voor deze editie</h2><dl className={styles.definition}><dt>Verantwoordelijke</dt><dd>{season.config.owner}</dd><dt>Periode</dt><dd>{season.config.startDate} t/m {season.config.endDate}</dd><dt>Assortiment</dt><dd className={styles.pre}>{season.config.assortment}</dd><dt>Werkwijze</dt><dd className={styles.pre}>{season.config.instructions||"Geen extra afspraken vastgelegd."}</dd></dl>{season.config.legacy&&<p className={styles.muted}>De bestaande inrichting van 2026 is behouden. De volgende editie begint met de vragen van de seizoensstart.</p>}</section>}
 {archive&&<SeasonArchivePanel archive={archive}/>}
 {season?.state==="closed"&&!manager&&<p className={styles.panel}>Deze editie is afgesloten. Het jaararchief staat bij management.</p>}
 {manager&&<div className={styles.tools}><Link className={styles.secondary} href={`/management/cijfers-evaluaties/${h.slug}-${year}`}>Evaluatie & documenten</Link>{(!season||season.state==="opening")&&<Link className={styles.button} href={`/feestdagen/${id}/start?jaar=${year}`}>{season?"Seizoensstart hervatten":"Seizoen starten"}</Link>}{season&&["active","closing"].includes(season.state)&&<Link className={styles.secondary} href={`/feestdagen/${id}/afsluiten?jaar=${year}`}>{season.state==="closing"?"Afsluiting hervatten":"Seizoen afsluiten"}</Link>}{season?.state==="closed"&&<Link className={styles.button} href={`/feestdagen/${id}/start?jaar=${year+1}`}>Volgende editie inrichten →</Link>}</div>}</div></StrikShell>;
}
