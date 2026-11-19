"use client";
import type {CSSProperties} from "react";
import OperationalDialog from "./OperationalDialog";
import Icon from "./ProductionIcon";
import type {ScreenMessageView} from "./screenMessages";
import s from "./screenMessages.module.css";

export default function ScreenMessageCard({message,onClose,preview=false}:{message:ScreenMessageView;onClose:()=>void;preview?:boolean}){
 if(message.variant==="welcome-baby")return <OperationalDialog className={`${s.popup} ${s.celebration}`} labelledBy="screen-message-title" busy={false} onClose={onClose}>
  <div className={s.confetti} aria-hidden="true">{Array.from({length:64},(_,i)=><span key={i} style={{"--x":`${(i*37+3)%100}%`,"--delay":`${-(i*1.37)%12}s`,"--duration":`${8+(i%6)}s`,"--drift":`${(i%2?1:-1)*(30+i%5*18)}px`,"--turn":`${i*29}deg`,"--color":["#e7a4b7","#f1c9d4","#cb798f","#d8bd91","#c3d3bc"][i%5],"--size":`${7+i%5*2}px`} as CSSProperties}/> )}</div>
  <article className={s.welcomeCard}>
   <button className={s.welcomeClose} onClick={onClose} aria-label="Welkomstbericht sluiten"><Icon name="close" size={27}/></button>
   <span className={s.welcomeBrand}>STRAK <span>gepland</span></span>
   <svg className={s.babyMobile} viewBox="0 0 240 150" fill="none" aria-hidden="true">
    <path d="M120 4v16M47 40c30-33 116-33 146 0M58 35v43m62-57v73m62-60v44" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M60 74c-9-10-23 5 0 22 23-17 9-32 0-22Z" fill="#e6a7b9"/>
    <path d="m181 76 5 12 13 1-10 9 3 13-11-7-12 7 3-13-10-9 14-1 5-12Z" fill="#d6bb8e"/>
    <path d="M133 93c-17 2-21 26-2 35-29 7-44-30-18-43 5-2 13-1 20 8Z" fill="#efc6d1"/>
    <path d="M38 135h164" stroke="#ecdce0" strokeWidth="1"/>
   </svg>
   <p className={s.welcomeEyebrow}>{preview?"Voorbeeld · ":""}Een heel fijn weerzien</p>
   <h1 id="screen-message-title">{message.title}</h1>
   <div className={s.welcomeRule} aria-hidden="true"><span/><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21C-4 11 3-2 12 6 21-2 28 11 12 21Z"/></svg><span/></div>
   <p className={s.welcomeBody}>{message.body}</p>
   <p className={s.welcomeSignoff}>Liefs, je collega’s bij Strik</p>
   <button className={s.welcomeButton} onClick={onClose}>Fijn om terug te zijn<Icon name="check" size={20}/></button>
  </article>
 </OperationalDialog>;
 return <OperationalDialog className={s.popup} labelledBy="screen-message-title" busy={false} onClose={onClose}>
  <div className={s.hero}>
   <div className={s.eyebrow}><span className={s.liveDot}/>{preview?"VOORBEELD":"VOOR DE BAKKERIJ"}<span className={s.brand}>STRAK <span>gepland</span></span></div>
   <button className={s.dismiss} onClick={onClose} aria-label="Schermbericht sluiten"><Icon name="close" size={24}/></button>
   <div className={s.symbol} aria-hidden="true"><Icon name="check" size={42}/></div>
   <h1 id="screen-message-title">{message.title}</h1>
   <div className={s.ribbon} aria-hidden="true"><span/><span/><span/></div>
  </div>
  <div className={s.content}><p>{message.body}</p><footer><span>Een bericht van Feline</span><button onClick={onClose}>Helemaal goed<Icon name="arrow" size={20}/></button></footer></div>
 </OperationalDialog>;
}
