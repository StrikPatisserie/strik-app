"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { weddingSlotInstant } from "../lib/weddingAppointments";
import type { WeddingStoreAlert } from "./weddingAlertModel";
import styles from "./WeddingAppointmentAlert.module.css";

function Bell(){return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;}
export default function WeddingAppointmentAlert({alert,stale,storageAvailable,now,onDismiss}:{now:number;alert:WeddingStoreAlert;stale:boolean;storageAvailable:boolean;onDismiss:()=>void}) {
  const root=useRef<HTMLElement>(null),button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const previous=document.activeElement,overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";button.current?.focus();
    return()=>{document.body.style.overflow=overflow;if(previous instanceof HTMLElement && previous.isConnected)previous.focus();};
  },[]);
  const reminder=alert.phase==="reminder",plural=alert.appointments.length>1;
  const next=alert.appointments[0];
  const minutes=Math.max(0,Math.ceil((weddingSlotInstant(next.appointment_date,next.start_time).getTime()-now)/60000));
  return <div className={styles.overlay} onKeyDown={event=>{
    if(event.key==="Escape"){event.stopPropagation();onDismiss();}
    if(event.key==="Tab"){
      const items=root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]');if(!items?.length)return;
      if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items[items.length-1].focus();}
      else if(!event.shiftKey&&document.activeElement===items[items.length-1]){event.preventDefault();items[0].focus();}
    }
  }}>
    <section ref={root} role="dialog" aria-modal="true" aria-labelledby="store-wedding-alert-heading" aria-describedby="store-wedding-alert-description" className={styles.dialog}>
      <header className={styles.topline}><span className={styles.bell}><Bell/></span><span className={styles.eyebrow}>{reminder?"BINNENKORT IN DE WINKEL":"VANDAAG IN DE WINKEL"}</span><button type="button" className={styles.close} aria-label="Melding wegklikken" onClick={onDismiss}>×</button></header>
      <h2 id="store-wedding-alert-heading">{reminder?minutes>0?`Let op, over ${minutes} ${minutes===1?"minuut":"minuten"} een bruidstaartafspraak`:"Let op, de bruidstaartafspraak is begonnen":`Let op, vandaag ${plural?"bruidstaartafspraken":"een bruidstaartafspraak"}`}</h2>
      <p id="store-wedding-alert-description" className={styles.intro}>{reminder?"Het bruidspaar komt zo langs. Hieronder staan de actuele afspraaktijden.":`Er ${plural?"komen vandaag bruidsparen":"komt vandaag een bruidspaar"} langs in de Ziekerstraat.`}</p>
      <div className={styles.appointments}>{alert.appointments.map(item=><div key={item.id} className={styles.appointment}><div className={styles.time}><strong>{item.start_time}</strong><span>tot {item.end_time}</span></div><div className={styles.couple}><strong>{item.names}</strong><span>Bruidstaartgesprek{item.status==="pending"?" · nog niet bevestigd":""}</span></div></div>)}</div>
      <div className={styles.actions}><button ref={button} type="button" className={styles.acknowledge} onClick={onDismiss}>Ik heb het gezien <span aria-hidden="true">✓</span></button><Link className={styles.agenda} href="/bruidstaarten/agenda" onClick={onDismiss}>Bekijk agenda →</Link></div>
      <p className={styles.note}>{reminder?"Deze herinnering blijft staan tot je hem wegklikt.":`Je krijgt 15 minuten vóór ${plural?"elke afspraak":"de afspraak"} nog een herinnering.`}</p>
      {stale&&<p className={styles.warning} role="status">De agenda kon tijdelijk niet worden vernieuwd. Controleer de afspraak bij twijfel in de agenda.</p>}
      {!storageAvailable&&<p className={styles.warning}>Deze iPad kan wegklikken niet bewaren na het opnieuw openen van de app.</p>}
    </section>
  </div>;
}
