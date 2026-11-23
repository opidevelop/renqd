"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
type ConfirmOptions = { title: string; description: string; confirmLabel?: string; cancelLabel?: string; tone?: "default" | "danger" };
export function useConfirmDialog() {
 const [pending,setPending]=useState<ConfirmOptions|null>(null);
 const resolverRef=useRef<((value:boolean)=>void)|null>(null);
 const dialogRef=useRef<HTMLElement>(null);
 const cancelRef=useRef<HTMLButtonElement>(null);
 const titleId=useId(),descriptionId=useId();
 const confirm=useCallback((options:ConfirmOptions)=>new Promise<boolean>(resolve=>{resolverRef.current?.(false);resolverRef.current=resolve;setPending(options);}),[]);
 const settle=useCallback((value:boolean)=>{const resolve=resolverRef.current;resolverRef.current=null;setPending(null);resolve?.(value);},[]);
 useEffect(()=>{
  if(!pending)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const overflow=document.body.style.overflow;
  document.body.style.overflow="hidden";cancelRef.current?.focus();
  function keydown(event:KeyboardEvent){
   if(event.key==="Escape"){event.preventDefault();settle(false);return;}
   if(event.key!=="Tab")return;
   const nodes=dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');
   if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  document.addEventListener("keydown",keydown);
  return()=>{document.removeEventListener("keydown",keydown);document.body.style.overflow=overflow;previous?.focus();};
 },[pending,settle]);
 const dialog=pending?<div className="renqd-confirm-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)settle(false);}}>
  <section ref={dialogRef} className={"renqd-confirm-dialog"+(pending.tone==="danger"?" is-danger":"")} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
   <header className="renqd-confirm-header"><span>CONFERMA OPERAZIONE</span><button type="button" onClick={()=>settle(false)} aria-label="Chiudi"><span aria-hidden="true">×</span></button></header>
   <div className="renqd-confirm-copy"><span className="renqd-confirm-icon"><AlertTriangle size={21}/></span><h2 id={titleId}>{pending.title}</h2><p id={descriptionId}>{pending.description}</p></div>
   <div className="renqd-confirm-actions"><button type="button" className="renqd-confirm-cancel" ref={cancelRef} onClick={()=>settle(false)}>{pending.cancelLabel??"Annulla"}</button><button type="button" className="renqd-confirm-submit" onClick={()=>settle(true)}>{pending.confirmLabel??"Conferma"}</button></div>
  </section></div>:null;
 return {confirm,dialog};
}
