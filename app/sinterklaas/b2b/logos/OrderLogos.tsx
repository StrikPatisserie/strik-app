"use client";
import {useState} from "react";
import dynamic from "next/dynamic";
import s from "./Logos.module.css";
const LogoManager=dynamic(()=>import("./OrderLogosDialog"));
export function LogoIcon({kind}:{kind:"attach"|"print"|"image"}) {
 return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==="print"?<><path d="M6 8V3h12v5M6 17H3V9h18v8h-3"/><path d="M6 14h12v7H6zM17 11h1"/></>:kind==="attach"?<><path d="m8 15 7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7L13 4a4 4 0 0 1 6 0"/><path d="m7 16 7-7"/></>:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m4 19 5-6 4 3 3-5 5 8"/></>}</svg>;
}
export default function OrderLogos({orderId,year,customer}:{orderId:string;year:string;customer:string}) {
 const [open,setOpen]=useState(false),[startPrint,setStartPrint]=useState(false);
 return <span className={s.tools}>
  <button type="button" className={s.icon} title="Logo’s uploaden en bekijken" aria-label={`Logo’s van ${customer} uploaden en bekijken`} onClick={()=>{setStartPrint(false);setOpen(true);}}><LogoIcon kind="attach"/></button>
  <button type="button" className={s.icon} title="Logo’s printen" aria-label={`Logo’s van ${customer} printen`} onClick={()=>{setStartPrint(true);setOpen(true);}}><LogoIcon kind="print"/></button>
  {open&&<LogoManager orderId={orderId} year={year} customer={customer} startPrint={startPrint} onClose={()=>setOpen(false)}/>}
 </span>;
}
