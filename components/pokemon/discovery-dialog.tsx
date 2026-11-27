"use client";

import { useEffect, useState } from "react";
import { AudioLines, BookOpen, Eye, HelpCircle, LoaderCircle, Type, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { PokemonSpecies } from "@/lib/pokemon/catalog";
import { POKEMON_TYPE_LABELS } from "@/lib/pokemon/catalog";

type LetterHint={nameLength:number;revealedPrefix:string;hintCount:number};
type Props={selected:PokemonSpecies;discovered:boolean;spellingHelp:boolean;onClose:()=>void;onRevealLetter:()=>Promise<LetterHint|null>};

export function PokemonDiscoveryDialog(props: Omit<Props, "selected"> & { selected: PokemonSpecies | null }) {
  if (!props.selected) return null;
  return <PokemonDiscoveryDialogContent key={props.selected.id + "-" + String(props.discovered)} {...props} selected={props.selected} />;
}

function PokemonDiscoveryDialogContent({selected,discovered,spellingHelp,onClose,onRevealLetter}:Props){
  const [hint,setHint]=useState<LetterHint|null>(null);
  const [hintBusy,setHintBusy]=useState(false);
  const [revealed,setRevealed]=useState<Set<string>>(new Set());
  const [description,setDescription]=useState("");
  const [descriptionBusy,setDescriptionBusy]=useState(discovered);
  const [descriptionError,setDescriptionError]=useState("");
  const [audioBusy,setAudioBusy]=useState(false);
  const [audioMessage,setAudioMessage]=useState("");

  useEffect(()=>{
    if(!discovered)return;
    let alive=true;
    fetch("https://pokeapi.co/api/v2/pokemon-species/"+selected.id+"/")
      .then(response=>{if(!response.ok)throw new Error();return response.json();})
      .then((data:{flavor_text_entries?:Array<{language:{name:string};flavor_text:string}>})=>{
        const entries=data.flavor_text_entries??[];
        const entry=entries.find(item=>item.language.name==="it")??entries.find(item=>item.language.name==="en");
        if(alive)setDescription(entry?.flavor_text.replace(/[\n\f]+/g," ").replace(/\s+/g," ").trim()??"Descrizione Pokédex non disponibile.");
      })
      .catch(()=>{if(alive)setDescriptionError("Non è stato possibile caricare la descrizione Pokédex.");})
      .finally(()=>{if(alive)setDescriptionBusy(false);});
    return()=>{alive=false;};
  },[selected?.id,discovered]);

  const revealLetter=async()=>{
    if(hintBusy||!spellingHelp)return;
    setHintBusy(true);
    try{const next=await onRevealLetter();if(next)setHint(next);}
    finally{setHintBusy(false);}
  };
  const revealInfo=async(key:"types"|"pokedex"|"silhouette")=>{
    if(key==="pokedex"&&!description&&!descriptionBusy){
      setDescriptionBusy(true);setDescriptionError("");
      try{
        const response=await fetch("https://pokeapi.co/api/v2/pokemon-species/"+selected?.id+"/");
        if(!response.ok)throw new Error();
        const data=await response.json() as {flavor_text_entries?:Array<{language:{name:string};flavor_text:string}>};
        const entries=data.flavor_text_entries??[];
        const entry=entries.find(item=>item.language.name==="it")??entries.find(item=>item.language.name==="en");
        setDescription(entry?.flavor_text.replace(/[\n\f]+/g," ").replace(/\s+/g," ").trim()??"Descrizione Pokédex non disponibile.");
      }catch{setDescriptionError("Non è stato possibile caricare la descrizione Pokédex.");}
      finally{setDescriptionBusy(false);}
    }
    setRevealed(current=>new Set(current).add(key));
  };
  const playCry=async()=>{
    if(!selected||audioBusy)return;
    setAudioBusy(true);setAudioMessage("");
    try{
      const audio=new Audio("https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/"+selected.id+".ogg");
      audio.onended=()=>setAudioBusy(false);
      audio.onerror=()=>{setAudioBusy(false);setAudioMessage("Verso non disponibile.");};
      await audio.play();
    }catch{setAudioBusy(false);setAudioMessage("Impossibile riprodurre il verso.");}
  };
  const isRevealed=(key:string)=>revealed.has(key);
  return <Dialog open={Boolean(selected)} onClose={onClose} overlayClassName="pokemon-nae-detail-backdrop" className="pokemon-nae-detail pokemon-nae-discovery-dialog" ariaLabel={discovered?"Scheda Pokémon":"Aiuti Pokémon"}>
    <header><span className="pokemon-page-eyebrow">{discovered?"SCHEDA POKÉMON":"AIUTI DISPONIBILI"}</span><button type="button" onClick={onClose} aria-label="Chiudi"><X size={18}/></button></header>
    {discovered?<>
      <div className="pokemon-nae-detail-hero"><img src={selected.artworkUrl} alt={selected.name}/><div><h2>{selected.name}</h2><small>#{String(selected.id).padStart(4,"0")} · Generazione {selected.generation}</small><p>{selected.types.map(type=>POKEMON_TYPE_LABELS[type]??type).join(" · ")}</p></div></div>
      <section className="pokemon-nae-discovery-description"><h3>Descrizione Pokédex</h3>{descriptionBusy?<p><LoaderCircle size={14}/> Caricamento…</p>:descriptionError?<p>{descriptionError}</p>:<p>{description||"Descrizione Pokédex non disponibile."}</p>}</section>
      <button type="button" className="pokemon-favourite-primary" onClick={()=>void playCry()} disabled={audioBusy}><AudioLines size={16}/>{audioBusy?"Riproduzione…":"Riproduci verso"}</button>
      {audioMessage&&<small className="pokemon-nae-discovery-feedback" role="status">{audioMessage}</small>}
    </>:<>
      <p className="pokemon-nae-discovery-intro">Scegli uno o più aiuti. La risposta non verrà mai mostrata prima della scoperta.</p>
      <div className="pokemon-nae-discovery-actions">
        <button type="button" onClick={()=>void revealLetter()} disabled={!spellingHelp||hintBusy}><span><HelpCircle size={17}/></span><strong>Rivela lettera</strong><small>{hintBusy?"Caricamento…":"Mostra la prossima lettera"}</small>{hintBusy&&<LoaderCircle size={14}/>}</button>
        <button type="button" onClick={()=>void playCry()} disabled={audioBusy}><span><AudioLines size={17}/></span><strong>Riproduci verso</strong><small>{audioBusy?"Riproduzione…":"Ascolta il verso del Pokémon"}</small></button>
        <button type="button" onClick={()=>void revealInfo("types")}><span><Type size={17}/></span><strong>Tipo</strong><small>Mostra i tipi Pokémon</small></button>
        <button type="button" onClick={()=>void revealInfo("pokedex")}><span><BookOpen size={17}/></span><strong>Pokédex</strong><small>Mostra la descrizione ufficiale</small></button>
        <button type="button" onClick={()=>void revealInfo("silhouette")}><span><Eye size={17}/></span><strong>Silhouette</strong><small>Mostra la sagoma del Pokémon</small></button>
      </div>
      {hint&&<section className="pokemon-nae-discovery-reveal"><strong>Lettere rivelate · {hint.hintCount}</strong><div>{hint.revealedPrefix.split("").join(" ")}{Array.from({length:Math.max(0,hint.nameLength-hint.revealedPrefix.length)},()=> "＿").join(" ")}</div></section>}
      {isRevealed("types")&&<section className="pokemon-nae-discovery-reveal"><strong>Tipo</strong><div className="pokemon-nae-discovery-types">{selected.types.map(type=><span key={type}>{POKEMON_TYPE_LABELS[type]??type}</span>)}</div></section>}
      {isRevealed("pokedex")&&<section className="pokemon-nae-discovery-reveal"><strong>Descrizione Pokédex</strong>{descriptionBusy?<p><LoaderCircle size={14}/> Caricamento…</p>:<p>{descriptionError||description||"Descrizione non disponibile."}</p>}</section>}
      {isRevealed("silhouette")&&<section className="pokemon-nae-discovery-silhouette"><img src={selected.artworkUrl} alt="Silhouette Pokémon" style={{filter:"brightness(0) saturate(0) opacity(.9)"}}/></section>}
      {audioMessage&&<small className="pokemon-nae-discovery-feedback" role="status">{audioMessage}</small>}
      {!spellingHelp&&<small className="pokemon-nae-discovery-feedback">L’aiuto «Rivela lettera» è disattivato nelle impostazioni della partita.</small>}
    </>}
    <button type="button" className="pokemon-favourite-secondary" onClick={onClose}>Chiudi</button>
  </Dialog>;
}
