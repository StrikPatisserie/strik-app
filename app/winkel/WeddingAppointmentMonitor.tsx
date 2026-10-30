"use client";
import { useEffect, useRef, useState } from "react";
import type { UserProfile } from "../lib/supabase/types";
import { canReceiveZiekerstraatWeddingAlerts } from "../lib/auth/access";
import { weddingLocalDate } from "../lib/weddingAppointments";
import WeddingAppointmentAlert from "./WeddingAppointmentAlert";
import { acknowledgeWeddingAlert, isIpadDevice, nextWeddingStoreAlert, readWeddingAcknowledgements, weddingAlertStorageKey, type StoreWeddingAppointment, type WeddingStoreAlert } from "./weddingAlertModel";

type View = { now: number; alert: WeddingStoreAlert; stale: boolean; storageAvailable: boolean };
function validAppointment(value: unknown): value is StoreWeddingAppointment {
  if(!value||typeof value!=="object")return false;
  const item=value as Record<string,unknown>;
  return typeof item.id==="string" && typeof item.names==="string" && typeof item.appointment_date==="string" &&
    typeof item.start_time==="string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.start_time) &&
    typeof item.end_time==="string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.end_time) && item.end_time>item.start_time && ["confirmed","pending"].includes(String(item.status));
}
export default function WeddingAppointmentMonitor({profile}:{profile:UserProfile|null}) {
  const [view,setView]=useState<View|null>(null);
  const dismiss=useRef<(()=>void)|null>(null);
  const enabled=canReceiveZiekerstraatWeddingAlerts(profile),account=profile?.id||"";
  useEffect(()=>{
    if(!enabled || !isIpadDevice(navigator))return;
    let active=true,busy=false,failed=false,storageAvailable=true,lastRead=0,serverDate="",date="",current:WeddingStoreAlert|null=null,signature="";
    let items:StoreWeddingAppointment[]=[],acknowledged=new Set<string>();
    let request:AbortController|null=null,requestTimeout:number|undefined;
    function readAcknowledgements(){try{acknowledged=readWeddingAcknowledgements(localStorage.getItem(weddingAlertStorageKey(account,date)));}catch{storageAvailable=false;}}
    function paint(){
      if(!active||document.hidden)return;
      const today=weddingLocalDate();
      if(today!==date){date=today;acknowledged=new Set();readAcknowledgements();}
      const fresh=!failed&&serverDate===today&&Date.now()-lastRead<120000;
      current=nextWeddingStoreAlert(items,new Date(),acknowledged,current,fresh);
      const next=current?{now:Math.floor(Date.now()/60000)*60000,alert:current,stale:!fresh,storageAvailable}:null;
      const serialized=JSON.stringify(next);
      if(serialized!==signature){signature=serialized;setView(next);}
    }
    async function refresh(){
      if(!active||busy||document.hidden)return;
      busy=true;request=new AbortController();requestTimeout=window.setTimeout(()=>request?.abort(),20000);
      try{
        const response=await fetch("/api/wedding-appointments/store-alerts",{cache:"no-store",credentials:"same-origin",signal:request.signal});
        if(!active)return;
        if(response.status===401||response.status===403){items=[];current=null;lastRead=0;failed=true;paint();return;}
        if(!response.ok)throw Error("Agenda niet beschikbaar");
        const data=await response.json();if(!active)return;
        if(data.today!==weddingLocalDate()||!Array.isArray(data.appointments)||!data.appointments.every(validAppointment))throw Error("Agenda niet leesbaar");
        items=data.appointments;serverDate=data.today;lastRead=Date.now();failed=false;
      }catch{if(active)failed=true;}
      finally{window.clearTimeout(requestTimeout);busy=false;paint();}
    }
    dismiss.current=()=>{
      if(!current)return;
      // Merge another tab's acknowledgement before saving our own.
      readAcknowledgements();acknowledged=acknowledgeWeddingAlert(current,acknowledged);
      try{localStorage.setItem(weddingAlertStorageKey(account,date),JSON.stringify([...acknowledged]));}catch{storageAvailable=false;}
      current=null;paint();
    };
    const resume=()=>{void refresh();};
    const storage=(event:StorageEvent)=>{if(event.key===weddingAlertStorageKey(account,date)||event.key===null){readAcknowledgements();paint();}};
    const tick=()=>{if(weddingLocalDate()!==date)void refresh();paint();};
    void refresh();
    const poll=window.setInterval(resume,60000),clock=window.setInterval(tick,15000);
    document.addEventListener("visibilitychange",resume);window.addEventListener("focus",resume);window.addEventListener("online",resume);window.addEventListener("pageshow",resume);window.addEventListener("storage",storage);
    return()=>{active=false;dismiss.current=null;request?.abort();window.clearTimeout(requestTimeout);window.clearInterval(poll);window.clearInterval(clock);document.removeEventListener("visibilitychange",resume);window.removeEventListener("focus",resume);window.removeEventListener("online",resume);window.removeEventListener("pageshow",resume);window.removeEventListener("storage",storage);};
  },[enabled,account]);
  if(!enabled||!view)return null;
  return <WeddingAppointmentAlert key={`${account}:${view.alert.date}:${view.alert.phase}`} {...view} onDismiss={()=>dismiss.current?.()}/>;
}
