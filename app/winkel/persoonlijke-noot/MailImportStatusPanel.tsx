import {storeLabel} from './model';
import styles from './page.module.css';
export type MailImportStatus={enabled?:boolean;lastCheck?:string;lastTest?:string;testPassed?:boolean;lastImport?:string;testRows?:{product:string;quantity:number;store:string}[];lastConflicts?:number};
const stamp=(v:string)=>new Intl.DateTimeFormat('nl-NL',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Amsterdam'}).format(new Date(v));
export default function ImportStatus({status}:{status?:MailImportStatus|null}) {
  return <details className={styles.panel} open={status?.testPassed&&!status?.lastImport}>
    <summary>Automatische import · {status?.enabled?'CSV-bijlagen gekoppeld':'CSV-koppeling klaarzetten'}</summary>
    {status?.lastCheck&&<p>Laatste mailboxcontrole: {stamp(status.lastCheck)}.</p>}
    {status?.testPassed&&<p className={styles.success}>CSV-test geslaagd op {stamp(status.lastTest!)}. {status.testRows?.map((r,i)=><span key={i}>{r.quantity}× {r.product} · {storeLabel(r.store)}. </span>)}Het voorbeeld telt niet mee als bestelling.</p>}
    <p>Nieuwe CSV-bijlagen worden iedere 30 minuten tussen 07:00 en 22:00 gecontroleerd. Opgehaalde bestellingen blijven bij opnieuw inlezen afgevinkt.</p>
    {status?.lastImport&&<p>Laatst ingelezen: {stamp(status.lastImport)}.</p>}
    {!!status?.lastConflicts&&<p role="alert" className={styles.error}>Er zijn afwijkingen bij bestaande bestellingen. Controleer het Gmail-label ‘Persoonlijke Noot controleren’.</p>}
    <p>Mails met alleen een downloadlink wachten nog op aansluiting. Deze blijven met het label ‘Persoonlijke Noot controleren’ in de inbox staan.</p>
  </details>;
}
