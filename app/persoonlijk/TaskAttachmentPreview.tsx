"use client";
import {useEffect,useRef} from "react";
import type {PersonalAttachment} from "./model";
import s from "./personal.module.css";
export function AttachmentIcon(){return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg>;}
export default function TaskAttachmentPreview({file,onClose}:{file:PersonalAttachment;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const url=`/api/persoonlijk/bijlage?${new URLSearchParams({path:file.path,name:file.name,view:"1"})}`;
 useEffect(()=>{
  const element=dialog.current,previous=document.activeElement as HTMLElement|null;
  element?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
  return()=>{element?.close();document.body.style.overflow=overflow;previous?.focus();};
 },[]);
 return <dialog ref={dialog} className={s.attachmentDialog} aria-label={`Bijlage: ${file.name}`} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div className={s.attachmentPreview}>
   <header><span>{file.name}</span><button type="button" autoFocus onClick={onClose} aria-label="Bijlage sluiten">×</button></header>
   {file.type.startsWith("image/")?
    // Private, authenticated image: bypass the shared Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={file.name}/>:<iframe src={url} title={file.name}/>}
   <footer><a href={url} target="_blank" rel="noopener noreferrer">Open groter ↗</a><a href={`/api/persoonlijk/bijlage?${new URLSearchParams({path:file.path,name:file.name})}`} download>Downloaden</a></footer>
  </div>
 </dialog>;
}
