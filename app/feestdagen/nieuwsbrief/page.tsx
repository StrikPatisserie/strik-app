import Link from "next/link";
import {StrikShell} from "../../StrikUI";
import {requireCurrentProfile} from "../../lib/auth/session";
import {canAccessPath} from "../../lib/auth/access";
import {getSeasons} from "../server";
import SinterklaasMailingClient from "../../sinterklaas/mailing/SinterklaasMailingClient";
import styles from "../Feestdagen.module.css";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{seizoen?:string;jaar?:string;q?:string}>}){
 const profile=await requireCurrentProfile(),query=await searchParams,seasons=await getSeasons();
 const allowed=(id:string)=>canAccessPath(profile,id==="kerst"?"/kerst/mailing":"/sinterklaas/mailing");
 const active=seasons.filter(s=>s.state==="active"&&s.config.mailing&&["sint","kerst"].includes(s.season)&&allowed(s.season));
 const selected=(query.seizoen?active.find(s=>s.season===query.seizoen):active[0]);
 const valid=selected&&(!query.jaar||String(selected.year)===query.jaar);
 return <StrikShell extraWide><div className={styles.page}><Link className={styles.muted} href="/feestdagen">← Feestdagen</Link><h1 className="my-4 text-3xl font-black">Gezamenlijke nieuwsbrief</h1>{!valid?<p className={styles.panel}>Dit onderdeel staat voor deze editie uit. Open het seizoen via Feestdagen of bekijk het jaararchief.</p>:<><nav className={styles.tabs} aria-label="Actieve zakelijke seizoenen">{active.map(s=><Link key={s.season} href={`/feestdagen/nieuwsbrief?seizoen=${s.season}&jaar=${s.year}`} aria-current={s.season===selected.season?"page":undefined}>{s.season==="sint"?"Sint":"Kerst"} {s.year}</Link>)}</nav><SinterklaasMailingClient key={`${selected.season}:${selected.year}`} season={selected.season as "sint"|"kerst"} initialYear={String(selected.year)} /></>}</div></StrikShell>;
}
