"use client";
import { useState } from "react";
import { UUID } from "./model";
type PictureWindow=Window&{documentPictureInPicture?:{window:Window|null;requestWindow(options:{width:number;height:number}):Promise<Window>}};
let floating:Window|null=null;
let opening=false;
export default function PersonalPopoutButton({noteId,disabled=false}:{noteId?:string;disabled?:boolean}) {
 const [error,setError]=useState("");
 async function open(){
  if(disabled||opening)return;
  setError("");
  if(floating&&!floating.closed){floating.focus();return;}
  const url=new URL("/persoonlijk/mini",window.location.origin);
  if(noteId&&UUID.test(noteId))url.searchParams.set("note",noteId);
  const pip=(window as PictureWindow).documentPictureInPicture;
  if(pip){
   opening=true;
   try{
    const child=await pip.requestWindow({width:460,height:640});floating=child;
    child.document.title="Mijn to-do’s · Strik";
    const frame=child.document.createElement("iframe");frame.src=url.href;frame.title="Mijn persoonlijke to-do’s";
    child.document.body.style.cssText="margin:0;height:100dvh;overflow:hidden;background:#eaf0e4";
    frame.style.cssText="display:block;border:0;width:100%;height:100%";child.document.body.append(frame);
    child.addEventListener("pagehide",()=>{if(floating===child)floating=null;},{once:true});
   }catch{setError("Het zwevende venster kon niet openen. Probeer opnieuw vanuit Chrome op je computer.");}
   finally{opening=false;}
  }else{
   floating=window.open(url.href,"strik-personal-todos","popup,width=460,height=640,resizable=yes,scrollbars=yes");
   if(!floating)setError("Sta pop-ups toe voor deze app en klik opnieuw op ‘Los venster’.");
  }
 }
 return <><button type="button" disabled={disabled} onClick={()=>void open()} title="Open je to-do’s in een klein verplaatsbaar venster"><span aria-hidden="true">↗</span> Los venster</button>{error&&<span role="alert">{error}</span>}</>;
}
