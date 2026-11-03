"use client";
import { useEffect,useRef } from "react";
const channelName=(owner:string)=>`strik-personal-sync:${owner}`;
// Invalidation only: note text and attachments never go through browser storage.
export function announcePersonalSave(owner:string) {
 if(!owner)return;
 try{const channel=new BroadcastChannel(channelName(owner));channel.postMessage("changed");channel.close();}catch{/* polling is the fallback */}
}
export function usePersonalSync(owner:string,disabled:boolean,onRefresh:()=>Promise<void>) {
 const refresh=useRef(onRefresh);
 useEffect(()=>{refresh.current=onRefresh;});
 useEffect(()=>{
  if(disabled||!owner)return;
  let busy=false,disposed=false;
  const run=async()=>{if(busy||disposed||document.visibilityState==="hidden")return;busy=true;try{await refresh.current();}finally{busy=false;}};
  let channel:BroadcastChannel|undefined;
  try{channel=new BroadcastChannel(channelName(owner));channel.onmessage=event=>{if(event.data==="changed")void run();};}catch{/* focus and interval remain available */}
  const onFocus=()=>void run();const timer=window.setInterval(onFocus,15000);
  window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onFocus);
  return()=>{disposed=true;channel?.close();clearInterval(timer);window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onFocus);};
 },[owner,disabled]);
}
