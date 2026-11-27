"use client";
import { useCallback, useId, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
type ConfirmOptions = { title: string; description: string; confirmLabel?: string; cancelLabel?: string; tone?: "default" | "danger" };
export function useConfirmDialog() {
 const [pending,setPending]=useState<ConfirmOptions|null>(null);
 const resolverRef=useRef<((value:boolean)=>void)|null>(null);
 const titleId=useId(),descriptionId=useId();
 const confirm=useCallback((options:ConfirmOptions)=>new Promise<boolean>(resolve=>{resolverRef.current?.(false);resolverRef.current=resolve;setPending(options);}),[]);
 const settle=useCallback((value:boolean)=>{const resolve=resolverRef.current;resolverRef.current=null;setPending(null);resolve?.(value);},[]);
 const dialog=<Dialog open={Boolean(pending)} onClose={()=>settle(false)} overlayClassName="renqd-confirm-overlay" className={"renqd-confirm-dialog"+(pending?.tone==="danger"?" is-danger":"")} role="alertdialog" labelledBy={titleId} describedBy={descriptionId}>
  {pending&&<>
   <header className="renqd-confirm-header"><span>CONFERMA OPERAZIONE</span><button type="button" onClick={()=>settle(false)} aria-label="Chiudi"><span aria-hidden="true">×</span></button></header>
   <div className="renqd-confirm-copy"><span className="renqd-confirm-icon"><AlertTriangle size={21}/></span><h2 id={titleId}>{pending.title}</h2><p id={descriptionId}>{pending.description}</p></div>
   <div className="renqd-confirm-actions"><button type="button" className="renqd-confirm-cancel" autoFocus onClick={()=>settle(false)}>{pending.cancelLabel??"Annulla"}</button><button type="button" className="renqd-confirm-submit" onClick={()=>settle(true)}>{pending.confirmLabel??"Conferma"}</button></div>
  </>}
 </Dialog>;
 return {confirm,dialog};
}
