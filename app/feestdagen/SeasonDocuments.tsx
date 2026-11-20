'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {uploadSeasonDocument} from './assortment-actions';
import {productPhotoUrl,type SeasonFile} from './assortment';
import styles from './Feestdagen.module.css';
export default function SeasonDocuments({season,year,files}:{season:string;year:number;files:SeasonFile[]}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 return <><form className={styles.panel} onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);setBusy(true);setError('');setNotice('');try{const result=await uploadSeasonDocument(season,year,data);if(result.ok){form.reset();setNotice(result.message);router.refresh();}else setError(result.message);}catch{setError('Bewaren is niet gelukt. Probeer opnieuw.');}finally{setBusy(false);}}}><label className={styles.field}>Document toevoegen<input name="file" type="file" required disabled={busy} accept=".pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.gif"/><small>Bijvoorbeeld een assortimentslijst of planning · maximaal 8 MB</small></label><button className={styles.button} disabled={busy}>{busy?'Bewaren…':'Document bewaren'}</button></form>{error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.success}>{notice}</p>}<div className={styles.documentList}>{files.length?files.map(f=><a href={productPhotoUrl(f.id)} key={f.id} className={styles.documentRow}><span><strong>{f.name}</strong><small>{new Date(f.created_at).toLocaleDateString('nl-NL',{timeZone:'Europe/Amsterdam'})} · {Math.max(1,Math.round(f.size/1024))} kB</small></span><span>Download ↓</span></a>):<p className={styles.muted}>Nog geen documenten bij deze editie.</p>}</div></>;
}
