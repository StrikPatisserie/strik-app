"use client";
import {useCallback,useRef} from "react";
import Link from "next/link";
import ProductionPreview from "./ProductionPreview";
import BakeryScreenMessages from "../../productie/BakeryScreenMessages";
import ScreenMessagesEditor,{type SaveScreenMessageInput} from "../../productie/ScreenMessagesEditor";
import {initialScreenMessages,activeScreenMessages,saveScreenMessage} from "../../productie/screenMessages";
const previewNow="2026-11-06T10:00:00Z";
export default function ScreenMessagesPreview({editor=false}:{editor?:boolean}){
 const doc=useRef(initialScreenMessages());
 const request=useCallback(async()=>({now:previewNow,messages:activeScreenMessages(doc.current.messages,previewNow)}),[]);
 const adminRequest=useCallback(async(input?:SaveScreenMessageInput)=>{
  if(input)doc.current=saveScreenMessage(doc.current,input.message,{id:"demo",name:"Feline (preview)"},previewNow);
  return{...doc.current,now:previewNow};
 },[]);
 if(editor)return <main style={{padding:"clamp(18px,3vw,45px)",maxWidth:1200,margin:"auto",color:"#1b3343"}}><nav style={{display:"flex",gap:20,marginBottom:30}}><Link href="?view=schermbericht">← Bekijk het bakkerijscherm</Link><small>Lokale preview · niets wordt opgeslagen</small></nav><h1>Schermberichten</h1><ScreenMessagesEditor request={adminRequest}/></main>;
 return <><ProductionPreview/><BakeryScreenMessages request={request}/><Link style={{position:"fixed",bottom:15,left:"50%",transform:"translateX(-50%)",zIndex:40,background:"#fff",border:"1px solid #c3d3bc",borderRadius:8,padding:"8px 14px",color:"#1b3343",fontSize:12}} href="?view=schermberichten">Preview · schermberichten klaarzetten</Link></>;
}
