"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
export default function PageTransition({children}:{children:ReactNode}){
 const pathname=usePathname();
 const [settledPath,setSettledPath]=useState<string | null>(null);
 const loading=settledPath!==pathname;
 useEffect(()=>{
  const id=window.setTimeout(()=>setSettledPath(pathname),560);
  return ()=>window.clearTimeout(id);
 },[pathname]);
 return <>
  <div key={pathname} className="platform-route-transition">{children}</div>
  {loading&&<div className="renqd-loading-overlay" role="status" aria-live="polite" aria-label="Caricamento Renqd">
   <div className="renqd-loading-content">
    <div className="renqd-loading-mark" aria-label="Renqd"><img className="renqd-loading-r" src="/brand/r-logo.svg" alt="" /><img className="renqd-loading-spark" src="/brand/stellina.svg" alt="" /></div>
    <img className="renqd-loading-serpentina" src="/brand/serpentina-podio.svg" alt="" />
    <p>Le tue scelte, in ordine.</p>
   </div>
  </div>}
 </>;
}