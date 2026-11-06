"use client";
import OperationalDialog from "./OperationalDialog";
import Icon from "./ProductionIcon";
import type {ScreenMessageView} from "./screenMessages";
import s from "./screenMessages.module.css";

export default function ScreenMessageCard({message,onClose,preview=false}:{message:ScreenMessageView;onClose:()=>void;preview?:boolean}){
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
