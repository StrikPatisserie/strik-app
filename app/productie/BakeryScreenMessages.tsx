"use client";
import {useEffect,useRef,useState} from "react";
import Icon from "./ProductionIcon";
import ScreenMessageCard from "./ScreenMessageCard";
import {SCREEN_SEEN_KEY,readScreenSeen,screenDate,screenMessageToken,type ScreenMessageView} from "./screenMessages";
import s from "./screenMessages.module.css";
export type ScreenMessageFeed={now:string;messages:ScreenMessageView[]};
async function loadMessages():Promise<ScreenMessageFeed>{
 const response=await fetch("/api/productie/schermberichten",{cache:"no-store"});
 if(!response.ok)throw Error(String(response.status));return response.json();
}
export default function BakeryScreenMessages({blocked=false,request=loadMessages}:{blocked?:boolean;request?:()=>Promise<ScreenMessageFeed>}){
 const [feed,setFeed]=useState<ScreenMessageFeed>({now:"1970-01-01T00:00:00Z",messages:[]}),[clock,setClock]=useState(0),[seen,setSeen]=useState<string[]|null>(null),[opened,setOpened]=useState<string|null>(null);
 const [anchor,setAnchor]=useState({server:0,local:0}),serial=useRef(0);
 const currentDate=screenDate(anchor.server+clock-anchor.local);
 const active=feed.messages.filter(message=>message.startDate<=currentDate&&currentDate<=message.endDate);
 const current=active.find(message=>screenMessageToken(message)===opened);
 useEffect(()=>{try{setSeen(readScreenSeen(localStorage.getItem(SCREEN_SEEN_KEY)));}catch{setSeen([]);}},[]);
 useEffect(()=>{
  let mounted=true;
  const refresh=async()=>{const id=++serial.current;try{const data=await request();if(!mounted||id!==serial.current)return;const now=Date.parse(data.now);if(!Number.isFinite(now))return;setAnchor({server:now,local:Date.now()});setFeed(data);setClock(Date.now());}catch(error){if(mounted&&(error as Error).message==="403")setFeed({now:new Date().toISOString(),messages:[]});}};
  void refresh();const poll=setInterval(()=>{if(!document.hidden)void refresh();},60000);
  // Expire on the screen itself, even if the network drops at midnight.
  const tick=setInterval(()=>setClock(Date.now()),1000);
  const visible=()=>{if(!document.hidden){setClock(Date.now());void refresh();}};document.addEventListener("visibilitychange",visible);
  return()=>{mounted=false;clearInterval(poll);clearInterval(tick);document.removeEventListener("visibilitychange",visible);};
 },[request]);
 useEffect(()=>{
  if(blocked||document.hidden||seen===null||current)return;
  if(document.querySelector('dialog[open],[role="dialog"],[aria-busy="true"]')||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))return;
  const next=active.find(message=>!seen.includes(screenMessageToken(message)));if(next)setOpened(screenMessageToken(next));
 },[active,blocked,current,seen,clock]);
 function dismiss(){
  if(opened){const next=[...(seen||[]).filter(value=>value!==opened),opened].slice(-100);setSeen(next);try{localStorage.setItem(SCREEN_SEEN_KEY,JSON.stringify(next));}catch{/* Acknowledged for this open screen when browser storage is disabled. */}}
  const next=active[active.findIndex(message=>screenMessageToken(message)===opened)+1];setOpened(next&&!blocked?screenMessageToken(next):null);
 }
 if(!active.length)return null;
 return <><button type="button" className={s.reopen} aria-label="Schermberichten teruglezen" title="Bericht van Feline" onClick={()=>{if(!blocked)setOpened(screenMessageToken(active[0]));}} disabled={blocked}><Icon name="screen" size={21}/><span>{active.length}</span></button>{current&&<ScreenMessageCard key={screenMessageToken(current)} message={current} onClose={dismiss}/>}</>;
}
