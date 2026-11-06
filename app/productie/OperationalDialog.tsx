"use client";
import {useEffect,useRef,type ReactNode} from "react";

export default function OperationalDialog({children,className,labelledBy,busy,onClose}:{children:ReactNode;className:string;labelledBy:string;busy:boolean;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;dialog.showModal();return()=>dialog.close();},[]);
 return <dialog ref={ref} className={className} aria-labelledby={labelledBy} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>{children}</dialog>;
}
