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
   <svg className="renqd-loading-star" viewBox="0 0 220 190" aria-hidden="true" focusable="false">
    <defs>
     <linearGradient id="renqd-loading-star-gradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#FF9B32"/>
      <stop offset="55%" stopColor="#FF7900"/>
      <stop offset="100%" stopColor="#E96800"/>
     </linearGradient>
     <filter id="renqd-loading-star-glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
     </filter>
    </defs>
    <path fill="url(#renqd-loading-star-gradient)" filter="url(#renqd-loading-star-glow)" d="M110 0 C120 34 136 52 190 95 C136 138 120 156 110 190 C100 156 84 138 30 95 C84 52 100 34 110 0 Z">
     <animate attributeName="d" dur="2.8s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines=".42 0 .58 1;.42 0 .58 1" values="M110 0 C120 34 136 52 190 95 C136 138 120 156 110 190 C100 156 84 138 30 95 C84 52 100 34 110 0 Z;M110 14 C120 48 145 72 174 95 C145 118 120 142 110 176 C100 142 75 118 46 95 C75 72 100 48 110 14 Z;M110 0 C120 34 136 52 190 95 C136 138 120 156 110 190 C100 156 84 138 30 95 C84 52 100 34 110 0 Z"/>
    </path>
   </svg>
  </div>}
 </>;
}
