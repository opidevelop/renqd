"use client";

import { useState, type ReactNode } from "react";

export function PublicProfileTabs({collections,renqs,pokemon}:{collections:ReactNode;renqs:ReactNode;pokemon:ReactNode}) {
  const [active,setActive]=useState<"RENQ"|"POKEMON">("RENQ");
  return <>
    <nav className="profile-content-tabs" aria-label="Sezioni del profilo">
      <button type="button" className={active==="RENQ"?"is-active":""} aria-pressed={active==="RENQ"} onClick={()=>setActive("RENQ")}>Renq e Collezioni</button>
      <button type="button" className={active==="POKEMON"?"is-active":""} aria-pressed={active==="POKEMON"} onClick={()=>setActive("POKEMON")}>Pokémon</button>
    </nav>
    {active==="RENQ"?<>{collections}{renqs}</>:<section className="profile-pokemon-integrated"><div className="profile-section-heading"><div><span>IL SUO SPAZIO POKÉMON</span><h2>Pokémon</h2></div></div>{pokemon}</section>}
  </>;
}
