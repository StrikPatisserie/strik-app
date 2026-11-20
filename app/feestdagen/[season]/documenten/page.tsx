import Link from 'next/link';
import {notFound} from 'next/navigation';
import {StrikShell} from '@/app/StrikUI';
import {requireAdminProfile} from '@/app/lib/auth/session';
import {getSeason} from '../../server';
import {amsterdamYear,holiday} from '../../model';
import {readSeasonFiles} from '../../assortment.server';
import SeasonDocuments from '../../SeasonDocuments';
import styles from '../../Feestdagen.module.css';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{season:string}>;searchParams:Promise<{jaar?:string}>}){
 await requireAdminProfile();const {season:id}=await params,query=await searchParams,h=holiday(id);if(!h)notFound();
 const year=/^20\d{2}$/.test(query.jaar||'')?Number(query.jaar):amsterdamYear();if(!await getSeason(id,year))notFound();
 return <StrikShell wide><div className={styles.page}><Link className={styles.muted} href={`/feestdagen/${id}?jaar=${year}`}>← {h.name} {year}</Link><header className={styles.header}><div><p className={styles.eyebrow}>{h.name} · {year}</p><h1>Documenten</h1></div></header><SeasonDocuments season={id} year={year} files={await readSeasonFiles(id,year)}/></div></StrikShell>;
}
