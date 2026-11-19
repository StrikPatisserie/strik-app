"use client";
import {useState} from "react";
import ScreenMessageCard from "../../productie/ScreenMessageCard";
import type {ScreenMessageView} from "../../productie/screenMessages";

export default function WelcomeMessagePreview({message}:{message:ScreenMessageView}){
 const [open,setOpen]=useState(true);
 return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#f8f3f1",color:"#704558"}}>
  <button type="button" onClick={()=>setOpen(true)} style={{font:"inherit",padding:"14px 24px",border:"1px solid #e5c2cd",borderRadius:30,background:"white",color:"inherit",cursor:"pointer"}}>Bekijk het welkomstscherm voor Wendy</button>
  {open&&<ScreenMessageCard message={message} preview onClose={()=>setOpen(false)}/>}
 </main>;
}
