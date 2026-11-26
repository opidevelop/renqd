"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Gamepad2, Sparkles, Trash2, Trophy } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

type ArchiveItem={id:string;title:string;public_slug:string|null;mode:string;status:string;updated_at:string;settings:Record<string,unknown>|null};
const levelOrder:Record<string,number>={"Principiante":1,"Allenatore":2,"Capopalestra":3,"Superquattro":4,"Campione":5,"Maestro Pokémon":6};
const levelNames=Object.keys(levelOrder);

function snapshot(item:ArchiveItem){return (item.settings?.resultSnapshot??{}) as Record<string,unknown>;}
function score(item:ArchiveItem){const result=snapshot(item);return Number(result.personalFoundCount??result.foundCount??result.score??0);}
function level(item:ArchiveItem){return String(snapshot(item).level??"");}
function generations(item:ArchiveItem){const result=snapshot(item);const config=(result.config??{}) as Record<string,unknown>;return Array.isArray(config.generations)?config.generations.map(Number):[];}
function specials(item:ArchiveItem){const result=snapshot(item);const ids=result.specialSpeciesIds;return ids&&typeof ids==="object"?Object.keys(ids as Record<string,unknown>):[];}
function isFullCatalog(item:ArchiveItem){
  const ids=snapshot(item).catalogSpeciesIds;
  const count=Array.isArray(ids)?ids.length:Number(snapshot(item).catalogCount??0);
  return count>=1025;
}
function artwork(item:ArchiveItem){
  let id=0;
  if(item.mode==="POKEMON_NAME_EM_ALL"){
    const key=String(snapshot(item).medalKey??"eevee");
    id=({eevee:133,sylveon:700,espeon:196,umbreon:197,leafeon:470,glaceon:471} as Record<string,number>)[key]??133;
  }else{
    const matrix=(item.settings?.matrix??{}) as Record<string,{speciesId?:number}>;
    id=Number(matrix["r10-c22"]?.speciesId??0);
  }
  return id>0?"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/"+id+".png":null;
}
function romeDate(value:string){const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));const get=(type:string)=>parts.find(part=>part.type===type)?.value??"00";return get("year")+"-"+get("month")+"-"+get("day");}

export function PokemonProfileArchive({items,referenceNow,persistentHighestLevel,maestroAchievedAt}:{items:ArchiveItem[];referenceNow:number;persistentHighestLevel:string|null;maestroAchievedAt:string|null}) {
  const [mode,setMode]=useState<"ALL"|"POKEMON_NAME_EM_ALL"|"POKEMON_ULTIMATE_FAVOURITE">("ALL");
  const [playMode,setPlayMode]=useState<"ALL"|"SOLO"|"MULTIPLAYER">("ALL");
  const [startDate,setStartDate]=useState("");
  const [endDate,setEndDate]=useState("");
  const [levelFilter,setLevelFilter]=useState("ALL");
  const [generationFilter,setGenerationFilter]=useState("ALL");
  const [specialFilter,setSpecialFilter]=useState("ALL");
  const [catalogFilter,setCatalogFilter]=useState<"ALL"|"FULL"|"CUSTOM">("ALL");
  const [sort,setSort]=useState<"RECENT"|"SCORE">("RECENT");
  const [deleteTarget,setDeleteTarget]=useState<string|null>(null);
  const [deleteStep,setDeleteStep]=useState(1);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const completed=items.filter(item=>item.status==="COMPLETED");
  const nameResults=completed.filter(item=>item.mode==="POKEMON_NAME_EM_ALL").map(snapshot);
  void referenceNow;
  const historyBestLevel=nameResults.map(result=>String(result.level??"")).sort((a,b)=>(levelOrder[b]??0)-(levelOrder[a]??0))[0]??"—";
  const bestLevel=persistentHighestLevel??historyBestLevel;
  const maestroPermanent=Boolean(maestroAchievedAt)||nameResults.some(result=>result.perfect===true);
  const bestScore=Math.max(0,...completed.filter(item=>item.mode==="POKEMON_NAME_EM_ALL").map(score));
  const perfectCount=nameResults.filter(result=>result.perfect===true).length;
  const specialOptions=[...new Set(completed.flatMap(specials))].sort();
  const filtered=completed.filter(item=>{
    if(mode!=="ALL"&&item.mode!==mode)return false;
    const gameMode=String(snapshot(item).gameMode??"");
    if(playMode==="SOLO"&&gameMode!=="SOLO")return false;
    if(playMode==="MULTIPLAYER"&&!["INDIVIDUAL","COLLABORATIVE"].includes(gameMode))return false;
    const date=romeDate(item.updated_at);
    if(startDate&&date<startDate)return false;
    if(endDate&&date>endDate)return false;
    if(levelFilter!=="ALL"&&level(item)!==levelFilter)return false;
    if(generationFilter!=="ALL"&&!generations(item).includes(Number(generationFilter)))return false;
    if(specialFilter!=="ALL"&&!specials(item).includes(specialFilter))return false;
    if(catalogFilter==="FULL"&&(item.mode!=="POKEMON_NAME_EM_ALL"||!isFullCatalog(item)))return false;
    if(catalogFilter==="CUSTOM"&&(item.mode!=="POKEMON_NAME_EM_ALL"||isFullCatalog(item)))return false;
    return true;
  }).sort((a,b)=>sort==="RECENT"?b.updated_at.localeCompare(a.updated_at):score(b)-score(a)||b.updated_at.localeCompare(a.updated_at));

  async function deleteResults(){
    if(!deleteTarget||busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/pokemon/name-em-all/results",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(deleteTarget==="ALL"?{action:"delete-all"}:{action:"delete-one",rankingId:deleteTarget})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Eliminazione non riuscita.");
      setMessage(deleteTarget==="ALL"?"Tutti i risultati Name ’Em All sono stati eliminati dal tuo profilo.":"Risultato eliminato dal tuo profilo.");
      setDeleteTarget(null);setDeleteStep(1);window.location.reload();
    }catch(e){setError(e instanceof Error?e.message:"Eliminazione non riuscita.");}
    finally{setBusy(false);}
  }

  const recent=filtered.slice(0,5);
  return <>
    <section className="pokemon-profile-stats">
      <article><span>ATTIVITÀ SALVATE</span><strong>{items.length}</strong><small>Nel tuo profilo Renqd</small></article>
      <article><span>MIGLIOR LIVELLO</span><strong>{bestLevel}</strong><small>Name ’Em All</small></article>
      <article><span>RECORD PERSONALE</span><strong>{bestScore}</strong><small>Pokémon trovati</small></article>
      <article className={maestroPermanent?"has-maestro-medal":""}>{maestroPermanent&&<span className="pokemon-profile-maestro-medal"><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/471.png" alt=""/></span>}<span>MEDAGLIA MAESTRO</span><strong>{maestroPermanent?"Conquistata":"—"}</strong><small>{maestroAchievedAt?"Permanente nel profilo":perfectCount+" partite perfette"}</small></article>
    </section>
    <section className="pokemon-profile-archive">
      <div className="pokemon-profile-archive-heading"><div><span className="pokemon-page-eyebrow">IL TUO POKÉDEX PERSONALE</span><h2>Partite e attività</h2><p>Apri ogni risultato per consultare statistiche, Pokédex e classifica.</p></div>
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>{setDeleteTarget("ALL");setDeleteStep(1);}} disabled={!completed.some(item=>item.mode==="POKEMON_NAME_EM_ALL")}><Trash2 size={14}/> Elimina tutti i risultati Name ’Em All</button>
      </div>
      {error&&<p className="pokemon-social-feedback is-error" role="alert">{error}</p>}
      {message&&<p className="pokemon-social-feedback" role="status">{message}</p>}
      <div className="pokemon-profile-filters">
        <select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="ALL">Tutte le attività</option><option value="POKEMON_NAME_EM_ALL">Name ’Em All</option><option value="POKEMON_ULTIMATE_FAVOURITE">Ultimate Favourite</option></select>
        <select value={playMode} onChange={e=>setPlayMode(e.target.value as typeof playMode)}><option value="ALL">Solo e Multiplayer</option><option value="SOLO">Solo</option><option value="MULTIPLAYER">Multiplayer</option></select>
        <label className="pokemon-profile-date-filter"><span>Dal</span><input type="date" value={startDate} max={endDate||undefined} onChange={e=>setStartDate(e.target.value)}/></label>
        <label className="pokemon-profile-date-filter"><span>Al</span><input type="date" value={endDate} min={startDate||undefined} onChange={e=>setEndDate(e.target.value)}/></label>
        <select value={levelFilter} onChange={e=>setLevelFilter(e.target.value)}><option value="ALL">Tutti i livelli</option>{levelNames.map(name=><option key={name}>{name}</option>)}</select>
        <select value={generationFilter} onChange={e=>setGenerationFilter(e.target.value)}><option value="ALL">Tutte le generazioni</option>{Array.from({length:9},(_,i)=><option key={i+1} value={String(i+1)}>Generazione {i+1}</option>)}</select>
        <select value={specialFilter} onChange={e=>setSpecialFilter(e.target.value)}><option value="ALL">Tutte le sezioni speciali</option>{specialOptions.map(name=><option key={name} value={name}>{name}</option>)}</select>
        <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="RECENT">Più recenti</option><option value="SCORE">Punteggio più alto</option></select>
      </div>
      <div className="pokemon-profile-recent"><div className="pokemon-profile-section-heading"><h3>Partite recenti</h3><span>{recent.length} risultati</span></div>
        <div className="pokemon-profile-recent-track">{recent.map(item=><Link href={"/r/"+(item.public_slug??item.id)} key={item.id} className="pokemon-profile-recent-card">
          <span className="pokemon-profile-card-medal">{artwork(item)?<img src={artwork(item)??undefined} alt="" loading="lazy"/>:<Trophy size={18}/>}</span><small>{item.mode==="POKEMON_NAME_EM_ALL"?"NAME ’EM ALL":"ULTIMATE FAVOURITE"}</small><strong>{item.mode==="POKEMON_NAME_EM_ALL"?level(item)||"Risultato salvato":"Matrice salvata"}</strong><b>{item.mode==="POKEMON_NAME_EM_ALL"?score(item)+" Pokémon":"Apri la matrice"}</b><time>{new Date(item.updated_at).toLocaleDateString("it-IT")}</time>
        </Link>)}</div>
      </div>
      <div className="pokemon-profile-section-heading"><h3>Tutte le attività</h3><span>{filtered.length} elementi</span></div>
      <div className="pokemon-profile-list">{filtered.map(item=><article key={item.id} className="pokemon-profile-list-item">
        <span className="pokemon-profile-list-art">{artwork(item)?<img src={artwork(item)??undefined} alt="" loading="lazy"/>:item.mode==="POKEMON_NAME_EM_ALL"?<Trophy size={20}/>:<Gamepad2 size={20}/>}</span>
        <div><small>{item.mode==="POKEMON_NAME_EM_ALL"?"NAME ’EM ALL":"ULTIMATE FAVOURITE"} · {new Date(item.updated_at).toLocaleDateString("it-IT")}</small><strong>{item.mode==="POKEMON_NAME_EM_ALL"?level(item)||"Risultato salvato":"Ultimate Favourite"}</strong><p>{item.mode==="POKEMON_NAME_EM_ALL"?score(item)+" Pokémon · "+Number(snapshot(item).completion??0)+"% completamento":"La tua matrice Pokémon personale"}</p></div>
        <Link href={"/r/"+(item.public_slug??item.id)} aria-label="Apri risultato"><ArrowUpRight size={17}/></Link>
        {item.mode==="POKEMON_NAME_EM_ALL"&&<button type="button" onClick={()=>{setDeleteTarget(item.id);setDeleteStep(1);}} aria-label="Elimina risultato"><Trash2 size={16}/></button>}
      </article>)}</div>
      {!filtered.length&&<p className="pokemon-profile-empty"><Sparkles size={20}/> Nessuna attività corrisponde ai filtri selezionati.</p>}
    </section>
    <Dialog open={Boolean(deleteTarget)} onClose={()=>setDeleteTarget(null)} overlayClassName="pokemon-nae-pause-backdrop" className="pokemon-nae-pause-card" role="alertdialog" labelledBy="pokemon-delete-results-title">
      {deleteTarget&&<>
        <span className="pokemon-page-eyebrow">CONFERMA ELIMINAZIONE</span>
        <h2 id="pokemon-delete-results-title">{deleteTarget==="ALL"?"Eliminare tutti i risultati Name ’Em All?":"Eliminare questo risultato?"}</h2>
        {deleteStep===1?<><p>L’operazione rimuove soltanto la tua copia dal profilo. I risultati degli altri partecipanti restano intatti.</p><div><button type="button" className="pokemon-favourite-secondary" autoFocus onClick={()=>setDeleteTarget(null)}>Annulla</button><button type="button" className="pokemon-favourite-primary" onClick={()=>setDeleteStep(2)}>Continua</button></div></>:<><p>Seconda conferma: l’eliminazione è irreversibile per il tuo profilo e non potrai recuperare questo risultato.</p><div><button type="button" className="pokemon-favourite-secondary" autoFocus onClick={()=>setDeleteTarget(null)}>Annulla</button><button type="button" className="pokemon-favourite-primary" onClick={()=>void deleteResults()} disabled={busy}>Conferma eliminazione</button></div></>}
      </>}
    </Dialog>
  </>;
}
