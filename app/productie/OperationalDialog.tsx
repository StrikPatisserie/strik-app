"use client";
import {useEffect,useRef,type ReactNode} from "react";

export default function OperationalDialog({children,className,labelledBy,busy,closeOnBackdrop=false,focusPanel=false,onClose}:{children:ReactNode;className:string;labelledBy:string;busy:boolean;closeOnBackdrop?:boolean;focusPanel?:boolean;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 const pointerStartedOutside=useRef(false);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;dialog.showModal();if(focusPanel)dialog.focus();return()=>dialog.close();},[focusPanel]);
 function outside(dialog:HTMLDialogElement,x:number,y:number){
  const bounds=dialog.getBoundingClientRect();
  return x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom;
 }
 return <dialog ref={ref} className={className} aria-labelledby={labelledBy} tabIndex={focusPanel?-1:undefined}
  onCancel={event=>{event.preventDefault();if(!busy)onClose();}}
  onPointerDown={event=>{pointerStartedOutside.current=closeOnBackdrop&&event.target===event.currentTarget&&outside(event.currentTarget,event.clientX,event.clientY);}}
  onClick={event=>{
   const dismiss=closeOnBackdrop&&pointerStartedOutside.current&&event.target===event.currentTarget&&outside(event.currentTarget,event.clientX,event.clientY);
   pointerStartedOutside.current=false;
   if(dismiss&&!busy)onClose();
  }}
 >{children}</dialog>;
}
