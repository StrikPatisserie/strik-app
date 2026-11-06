"use client";
import {useEffect,useRef} from 'react';
import {encodeReloadView,newerRelease,RELOAD_VIEW_KEY,updateIsSafe,type PlanningView} from './productionUpdates';

export function pageIsBeingEdited(){
 if(document.querySelector('dialog[open]'))return true;
 if([...document.querySelectorAll('form,[data-production-update-block="true"],[aria-busy="true"]')].some(el=>el.getClientRects().length>0))return true;
 return !!document.activeElement?.matches('input,textarea,[contenteditable="true"]');
}
export default function useProductionUpdates(options:{enabled:boolean;clientVersion?:string;serverVersion?:string;blocked:boolean;view:PlanningView}){
 const latest=useRef(options);
 useEffect(()=>{latest.current=options;});
 useEffect(()=>{
  let interacted=Date.now(),reloading=false;
  const activity=()=>{interacted=Date.now();};
  const events=['pointerdown','keydown','input','change','dragstart'] as const;
  events.forEach(event=>window.addEventListener(event,activity,true));
  const timer=setInterval(()=>{
   const current=latest.current;
   if(reloading||!current.enabled||!updateIsSafe({pending:newerRelease(current.clientVersion,current.serverVersion),blocked:current.blocked,visible:document.visibilityState==='visible',online:navigator.onLine,editing:pageIsBeingEdited(),idleMs:Date.now()-interacted}))return;
   // Synchronous last check and preference write; no network/data write occurs.
   try{sessionStorage.setItem(RELOAD_VIEW_KEY,encodeReloadView(current.view,location.pathname+location.search,Date.now()));}
   catch{return;} // Preserve XL/week settings when browser storage is unavailable.
   reloading=true;window.location.reload();
  },5000);
  return()=>{clearInterval(timer);events.forEach(event=>window.removeEventListener(event,activity,true));};
 },[]);
 return options.enabled&&newerRelease(options.clientVersion,options.serverVersion);
}
