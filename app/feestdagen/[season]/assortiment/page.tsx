import Link from 'next/link';
import {notFound} from 'next/navigation';
import {StrikShell} from '@/app/StrikUI';
import {requireCurrentProfile} from '@/app/lib/auth/session';
import {canAccessPath,hasFullAccess} from '@/app/lib/auth/access';
import {getSeason,getSeasons} from '../../server';
import {holiday,amsterdamYear} from '../../model';
import {readAssortment} from '../../assortment.server';
import AssortmentClient from '../../AssortmentClient';
import styles from '../../Feestdagen.module.css';
export const dynamic='force-dynamic';
export const maxDuration=120;
export default async function Page({params,searchParams}:{params:Promise<{season:string}>;searchParams:Promise<{jaar?:string}>}){
 const profile=await requireCurrentProfile();if(!canAccessPath(profile,'/feestdagen'))notFound();
 const {season:id}=await params,query=await searchParams,h=holiday(id);if(!h)notFound();
 const year=/^20\d{2}$/.test(query.jaar||'')?Number(query.jaar):amsterdamYear(),[edition,seasons]=await Promise.all([getSeason(id,year),getSeasons()]);if(!edition)notFound();
 const products=await readAssortment(id,year),years=seasons.filter(s=>s.season===id).map(s=>s.year);
 return <StrikShell extraWide><div className={styles.page}><Link className={styles.muted} href={`/feestdagen/${id}?jaar=${year}`}>← {h.name} {year}</Link><header className={styles.header}><div><p className={styles.eyebrow}>{h.name} · jaarassortiment</p><h1>Assortiment {year}</h1><p className={styles.muted}>Producten, prijzen en foto’s van deze editie.{edition.state==='closed'?' Dit jaar is afgesloten en blijft zo bewaard.':''}</p></div><nav className={styles.tabs} aria-label="Assortimentsjaar">{years.map(y=><Link key={y} aria-current={y===year?'page':undefined} href={`/feestdagen/${id}/assortiment?jaar=${y}`}>{y}</Link>)}</nav></header><AssortmentClient season={id} year={year} products={products} editable={hasFullAccess(profile)&&['active','opening'].includes(edition.state)} canImport={year===amsterdamYear()}/></div></StrikShell>;
}
