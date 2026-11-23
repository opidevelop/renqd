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
    <div className="renqd-loading-wordmark">renqd<span>.</span></div>
    <svg className="renqd-loading-serpentina" viewBox="0 0 240 150" role="presentation" aria-hidden="true">
     <path className="renqd-loading-serpentina-shadow" d="M18 76 C18 34 69 20 91 54 C111 85 72 122 47 103 C25 87 42 58 66 65 C91 72 104 128 143 119 C183 110 181 64 153 48 C128 34 111 54 121 75 C133 102 181 105 203 75 C222 50 205 22 184 25"/>
     <path className="renqd-loading-serpentina-line" d="M18 76 C18 34 69 20 91 54 C111 85 72 122 47 103 C25 87 42 58 66 65 C91 72 104 128 143 119 C183 110 181 64 153 48 C128 34 111 54 121 75 C133 102 181 105 203 75 C222 50 205 22 184 25"/>
     <path className="renqd-loading-spark" d="M203 13 L207 23 L217 27 L207 31 L203 41 L199 31 L189 27 L199 23 Z"/>
    </svg>
    <p>Le tue scelte, in ordine.</p>
   </div>
  </div>}
 </>;
}