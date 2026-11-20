import Link from "next/link";
import {StrikShell} from "../../StrikUI";
import {requireCurrentProfile} from "../../lib/auth/session";
import {canAccessPath,canAccessLogistiek} from "../../lib/auth/access";
import {getSeasons} from "../server";
import SinterklaasB2BClient from "../../sinterklaas/b2b/SinterklaasB2BClient";
import styles from "../Feestdagen.module.css";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{seizoen?:string;jaar?:string;q?:string}>}){
 const profile=await requireCurrentProfile(),query=await searchParams,seasons=await getSeasons();
 const allowed=(id:string)=>canAccessPath(profile,id==="kerst"?"/kerst/b2b":"/sinterklaas/b2b");
 const active=seasons.filter(s=>s.state==="active"&&s.config.business&&["sint","kerst"].includes(s.season)&&allowed(s.season));
 const selected=(query.seizoen?active.find(s=>s.season===query.seizoen):active[0]);
 const valid=selected&&(!query.jaar||String(selected.year)===query.jaar);
 return <StrikShell extraWide><div className={styles.page}><Link className={styles.muted} href="/feestdagen">← Feestdagen</Link>{!valid?<p className={styles.panel}>Dit onderdeel staat voor deze editie uit. Open het seizoen via Feestdagen of bekijk het jaararchief.</p>:<><SinterklaasB2BClient key={`${selected.season}:${selected.year}`} season={selected.season as "sint"|"kerst"} initialYear={String(selected.year)} canViewProduction={canAccessLogistiek(profile)} initialSearch={query.q||""}/></>}</div></StrikShell>;
}
