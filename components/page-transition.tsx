"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
export default function PageTransition({children}:{children:ReactNode}){
 const pathname=usePathname();
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  setLoading(true);
  const id=window.setTimeout(()=>setLoading(false),560);
  return ()=>window.clearTimeout(id);
 },[pathname]);
 return <>
  <div key={pathname} className="platform-route-transition">{children}</div>
  {loading&&<div className="renqd-loading-overlay" role="status" aria-live="polite" aria-label="Caricamento Renqd">
   <div className="renqd-loading-content">
    <img className="renqd-loading-wordmark" src="/brand/renqd-logo.svg" alt="Renqd" />
    <div className="renqd-loading-brand-art"><img className="renqd-loading-serpentina" src="/brand/serpentina-podio.svg" alt="" /><img className="renqd-loading-spark" src="/brand/stellina.svg" alt="" /></div>
    <p>Le tue scelte, in ordine.</p>
   </div>
  </div>}
 </>;
}