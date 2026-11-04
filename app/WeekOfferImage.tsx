"use client";
/* eslint-disable @next/next/no-img-element */
import {useState} from "react";

export default function WeekOfferImage({src,alt}:{src:string;alt:string}) {
  const [loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false);
  return <div className="relative flex h-full w-full items-center justify-center" aria-busy={!loaded&&!failed}>
    {!loaded&&!failed&&<span role="status" className="absolute flex items-center gap-2 text-xs text-[#63765c]"><svg className="animate-spin motion-reduce:animate-none" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="2"/><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>Foto laden…</span>}
    {failed?<p role="status" className="text-center text-xs text-[#63765c]">Foto kon niet geladen worden. Wissel van week om opnieuw te proberen.</p>:<img src={src} alt={alt} decoding="async" onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} className={`h-full max-w-full rounded-[0.7rem] object-contain transition-opacity ${loaded?"opacity-100":"opacity-0"}`}/>}
  </div>;
}
