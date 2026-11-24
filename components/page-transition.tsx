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
   <img className="renqd-loading-star" src="/brand/stellina.svg" alt="" aria-hidden="true"/>
  </div>}
 </>;
}
