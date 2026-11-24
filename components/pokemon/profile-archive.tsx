"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Gamepad2, Sparkles, Trophy } from "lucide-react";

type ArchiveItem={
  id:string;title:string;public_slug:string|null;mode:string;status:string;updated_at:string;settings:Record<string,unknown>|null;
};
const levelOrder:Record<string,number>={"Principiante":1,"Allenatore":2,"Capopalestra":3,"Superquattro":4,"Campione":5,"Maestro Pokémon":6};

export function PokemonProfileArchive({items,referenceNow}:{items:ArchiveItem[];referenceNow:number}) {
  const [mode,setMode]=useState<"ALL"|"POKEMON_NAME_EM_ALL"|"POKEMON_ULTIMATE_FAVOURITE">("ALL");
  const [period,setPeriod]=useState<"ALL"|"30"|"90"|"365">("ALL");
  const completed=items.filter(item=>item.status==="COMPLETED");
  const nameResults=completed.filter(item=>item.mode==="POKEMON_NAME_EM_ALL").map(item=>(item.settings?.resultSnapshot??{}) as Record<string,unknown>);
  const bestLevel=nameResults.map(result=>String(result.level??"")).sort((a,b)=>(levelOrder[b]??0)-(levelOrder[a]??0))[0]??"—";
  const bestScore=Math.max(0,...nameResults.map(result=>Number(result.score??result.foundCount??0)));
  const perfectCount=nameResults.filter(result=>result.perfect===true).length;
  const filtered=useMemo(()=>{
    const cutoff=period==="ALL"?null:referenceNow-Number(period)*24*60*60*1000;
    return items.filter(item=>(mode==="ALL"||item.mode===mode)&&(!cutoff||new Date(item.updated_at).getTime()>=cutoff));
  },[items,mode,period,referenceNow]);
  return <>
    <section className="pokemon-profile-stats">
      <article><span>ATTIVITÀ SALVATE</span><strong>{items.length}</strong><small>Nel tuo profilo Renqd</small></article>
      <article><span>MIGLIOR LIVELLO</span><strong>{bestLevel}</strong><small>Name ’Em All</small></article>
      <article><span>RECORD PERSONALE</span><strong>{bestScore}</strong><small>Pokémon trovati</small></article>
      <article><span>PARTITE PERFETTE</span><strong>{perfectCount}</strong><small>Maestro Pokémon</small></article>
    </section>
    <section className="pokemon-profile-results">
      <div className="pokemon-section-heading"><div><span className="pokemon-page-eyebrow">IL TUO ARCHIVIO</span><h2>Le tue attività.</h2></div></div>
      <div className="pokemon-profile-filter-row">
        <div className="pokemon-profile-filter-group" aria-label="Filtra per modalità">
          {[["ALL","Tutte"],["POKEMON_NAME_EM_ALL","Name ’Em All"],["POKEMON_ULTIMATE_FAVOURITE","Ultimate Favourite"]].map(([value,label])=><button type="button" key={value} aria-pressed={mode===value} className={mode===value?"is-active":""} onClick={()=>setMode(value as typeof mode)}>{label}</button>)}
        </div>
        <div className="pokemon-profile-filter-group" aria-label="Filtra per periodo">
          {[["ALL","Sempre"],["30","30 giorni"],["90","90 giorni"],["365","1 anno"]].map(([value,label])=><button type="button" key={value} aria-pressed={period===value} className={period===value?"is-active":""} onClick={()=>setPeriod(value as typeof period)}>{label}</button>)}
        </div>
      </div>
      {filtered.length ? <div className="pokemon-profile-list">{filtered.map(item=>{
        const isUltimate=item.mode==="POKEMON_ULTIMATE_FAVOURITE";
        const completedItem=item.status==="COMPLETED";
        const result=(item.settings?.resultSnapshot??{}) as Record<string,unknown>;
        const href=completedItem?"/r/"+(item.public_slug||item.id):(isUltimate?"/pokemon/ultimate-favourite":"/pokemon/name-em-all");
        const detail=isUltimate?(Object.keys((item.settings?.matrix??{}) as Record<string,unknown>).length+" celle compilate"):completedItem?(String(result.level??"Risultato")+" · "+String(result.score??0)+" Pokémon"):"Partita da completare";
        return <Link key={item.id} href={href} className="pokemon-profile-result">
          <span className="pokemon-profile-result-icon">{isUltimate?<Sparkles size={17}/>:<Trophy size={17}/>}</span>
          <span><strong>{isUltimate?"Ultimate Favourite":"Name ’Em All"}</strong><small>{completedItem?"Completato":"In corso"} · {detail} · {new Date(item.updated_at).toLocaleDateString("it-IT")}</small></span>
          <ArrowUpRight size={16}/>
        </Link>;
      })}</div>:<div className="pokemon-profile-empty"><Gamepad2 size={22}/><strong>Nessuna attività in questo periodo</strong><p>Modifica i filtri o inizia una nuova attività Pokémon.</p></div>}
    </section>
  </>;
}
