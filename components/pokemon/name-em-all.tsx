"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { createClient } from "@/lib/supabase/client";
import { playPokemonSound, preparePokemonAudio } from "@/lib/pokemon/sounds";
import { usePokemonSoundPreference } from "@/components/pokemon/use-pokemon-sound-preference";
import { PokemonResultSocial } from "@/components/pokemon/result-social";
import { PokemonNameEmAllMultiplayerGame } from "@/components/pokemon/multiplayer-game";
import { NameEmAllMultiplayerLobby } from "@/components/pokemon/multiplayer-lobby";
import type { NameEmAllParticipant } from "@/components/pokemon/multiplayer-lobby";
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Eye, EyeOff, Settings,
  Grid3X3, HelpCircle, LoaderCircle, Pause, Play, Sparkles, X,
} from "lucide-react";
import {
  GENERATION_LABELS, POKEMON_TYPE_LABELS, POKEMON_TYPES,
  PokemonCatalog, PokemonSpecies, normalizePokemonName, findExactPokemonMatch, isAmbiguousPokemonName,
} from "@/lib/pokemon/catalog";
import { getPokemonTypeIconUrl } from "@/lib/pokemon/type-icons";
import { Dialog } from "@/components/ui/dialog";
import { PokemonDiscoveryDialog } from "@/components/pokemon/discovery-dialog";
import { useNameEmAllSubmissionQueue } from "@/components/pokemon/use-name-em-all-submission-queue";
import {
  createNameEmAllSoloAction, createNameEmAllMultiplayerAction, deleteNameEmAllSoloAction, finishNameEmAllAction, hintNameEmAllAction,
  pauseNameEmAllAction, resumeNameEmAllAction, submitNameEmAllAnswerAction, setNameEmAllResultVisibilityAction,
} from "@/app/(platform)/pokemon/name-em-all/actions";

type SpecialSections = { mega:boolean; legendary:boolean; mythical:boolean; ultraBeast:boolean; paradox:boolean };
type WizardConfig = {
  generations:number[]; types:string[]; specialSections:SpecialSections;
  showDexNumber:boolean; showType:boolean; spellingHelp:boolean; shadows:boolean|null;
  sortOrder:"RANDOM"|"POKEDEX"|"TYPE"; durationMinutes:number; customMinutes:string;
  mode:"SOLO"|"COLLABORATIVE"|"INDIVIDUAL"; unlimited?:boolean;
};
type ActiveSession = {
  id:string; ranking_id:string; owner_id:string; host_id:string|null; game_mode:string; status:string; config:Record<string,unknown>;
  catalog_species_ids:number[]; special_species_ids:Record<string,number[]>;
  duration_seconds:number; started_at:string|null; deadline_at:string|null;
  paused_at:string|null; remaining_seconds:number|null; paused_total_seconds:number;
};
type ResultSnapshot = Record<string,unknown>;

const defaults:WizardConfig = {
  generations:[1,2,3,4,5,6,7,8,9],types:[],
  specialSections:{mega:true,legendary:true,mythical:true,ultraBeast:true,paradox:true},
  showDexNumber:true,showType:false,spellingHelp:true,shadows:false,
  sortOrder:"POKEDEX",durationMinutes:0,customMinutes:"",mode:"SOLO",unlimited:true,
};
const specialLabels:Record<keyof SpecialSections,string> = {
  mega:"Mega",legendary:"Leggendari",mythical:"Mitici",ultraBeast:"Ultracreature",paradox:"Paradosso",
};
const wizardTitles=["Catalogo","Sezioni speciali","Difficoltà","Visualizzazione","Durata","Modalità","Riepilogo"];

function matchesMainCatalog(species:PokemonSpecies,config:WizardConfig) {
  return config.generations.includes(species.generation) &&
    (config.types.length===0 || species.types.some(type=>config.types.includes(type)));
}
function Wizard({catalog,onStart,catalogReady}:{catalog:PokemonCatalog;onStart:(config:WizardConfig)=>Promise<void>;catalogReady:boolean}) {
  const [config,setConfig]=useState<WizardConfig>(defaults);
  const [step,setStep]=useState(0);
  const [error,setError]=useState("");
  const [busy,startTransition]=useTransition();
  const mainSpecies=useMemo(()=>catalog.species.filter(item=>matchesMainCatalog(item,config)),[catalog,config]);
  const counts=useMemo(()=>({
    mega:mainSpecies.filter(item=>item.megaForms.length>0).length,
    legendary:mainSpecies.filter(item=>item.isLegendary).length,
    mythical:mainSpecies.filter(item=>item.isMythical).length,
    ultraBeast:mainSpecies.filter(item=>item.isUltraBeast).length,
    paradox:mainSpecies.filter(item=>item.isParadox).length,
  }),[mainSpecies]);
  const update=(patch:Partial<WizardConfig>)=>setConfig(current=>({...current,...patch}));
  const toggleGeneration=(generation:number)=>update({generations:config.generations.includes(generation)?config.generations.filter(x=>x!==generation):[...config.generations,generation].sort((a,b)=>a-b)});
  const toggleType=(type:string)=>update({types:config.types.includes(type)?config.types.filter(x=>x!==type):[...config.types,type]});
  const toggleSpecial=(key:keyof SpecialSections)=>update({specialSections:{...config.specialSections,[key]:!config.specialSections[key]}});
  const canContinue=step!==0||config.generations.length>0;
  const canStart=catalogReady && mainSpecies.length>0 &&
    (config.durationMinutes===0 || [30,60,90].includes(config.durationMinutes) ||
      (config.durationMinutes===-1 && Number(config.customMinutes)>=1 && Number(config.customMinutes)<=1440));
  const start=()=>{setError("");startTransition(async()=>{try{await onStart({...config,durationMinutes:config.durationMinutes===-1?Number(config.customMinutes):config.durationMinutes,unlimited:config.durationMinutes===0});}catch(e){setError(e instanceof Error?e.message:"Non è stato possibile avviare la partita.");}});};

  return (
    <section className="pokemon-nae-wizard">
      <header className="pokemon-nae-wizard-hero pokemon-hub-hero">
        <div className="pokemon-hub-hero-copy">
          <p className="pokemon-hub-kicker">RENQD × POKÉMON · NAME ’EM ALL</p>
          <h1>La tua prossima <em>sfida.</em></h1>
          <p>Componi il Pokédex, scegli come giocare e prepara la tua sessione. Ogni dettaglio è nelle tue mani.</p>
          <span className="pokemon-nae-wizard-count">PASSAGGIO {step+1} DI 7 <i/> {mainSpecies.length.toLocaleString("it-IT")} SPECIE SELEZIONABILI</span>
        </div>
        <div className="pokemon-nae-wizard-characters" aria-hidden="true">
          <span className="pokemon-hub-orbit"/>
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/196.png" alt=""/>
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/470.png" alt=""/>
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/471.png" alt=""/>
        </div>
      </header>
      <nav className="pokemon-nae-stepper" aria-label="Passaggi configurazione">
        {wizardTitles.map((title,index)=><button type="button" key={title} onClick={()=>index<=step&&setStep(index)} className={index===step?"is-active":index<step?"is-done":""} disabled={index>step}>
          <span>{index<step?<Check size={13}/>:index+1}</span><small>{title}</small>
        </button>)}
      </nav>

      {step===0&&<section className="pokemon-nae-wizard-panel">
        <div className="pokemon-section-heading"><div><span className="pokemon-page-eyebrow">01 · CATALOGO</span><h2>Quale Pokédex?</h2></div><strong>{mainSpecies.length.toLocaleString("it-IT")} specie</strong></div>
        <p className="pokemon-nae-help">Seleziona una o più generazioni. Selezionando anche i tipi, il catalogo applica l&apos;intersezione tra generazioni e tipi.</p>
        <div className="pokemon-nae-generation-grid">{GENERATION_LABELS.map((label,index)=><button type="button" key={label} onClick={()=>toggleGeneration(index+1)} className={config.generations.includes(index+1)?"is-selected":""}><small>GENERAZIONE</small><strong>{label}</strong><span>{catalog.species.filter(item=>item.generation===index+1).length} specie</span></button>)}</div>
        <div className="pokemon-nae-subheading"><strong>Tipi Pokémon</strong><span>{config.types.length?config.types.length+" selezionati":"Nessun filtro"}</span></div>
        <div className="pokemon-nae-type-grid pokemon-nae-type-grid-visual">{POKEMON_TYPES.map(type=><button type="button" key={type} onClick={()=>toggleType(type)} className={config.types.includes(type)?"is-selected":""}><img src={getPokemonTypeIconUrl(type)} alt="" loading="lazy"/><span>{POKEMON_TYPE_LABELS[type]}</span></button>)}</div>
        <div className="pokemon-nae-inline-actions"><button type="button" onClick={()=>update({generations:[1,2,3,4,5,6,7,8,9]})}>Tutte le generazioni</button><button type="button" onClick={()=>update({types:[]})}>Rimuovi filtro tipi</button></div>
      </section>}

      {step===1&&<section className="pokemon-nae-wizard-panel">
        <span className="pokemon-page-eyebrow">02 · SEZIONI SPECIALI</span><h2>Vuoi esplorare anche le forme speciali?</h2>
        <div className="pokemon-nae-special-intro"><span><Sparkles size={18}/></span><div><strong>Una scoperta, tutte le sue forme</strong><p>Le sezioni speciali raccolgono soltanto specie già presenti nel catalogo principale. Quando riconosci una specie, sblocchi anche le sue rappresentazioni associate: non sono scoperte separate e non assegnano punti extra.</p></div></div>
        <div className="pokemon-nae-special-grid">{(Object.keys(specialLabels) as (keyof SpecialSections)[]).map(key=><label key={key} className={"pokemon-nae-option"+(config.specialSections[key]?" is-selected":"")+(counts[key]===0?" is-disabled":"")}>
          <input type="checkbox" checked={config.specialSections[key]} disabled={counts[key]===0} onChange={()=>toggleSpecial(key)}/>
          <span><strong>{specialLabels[key]}</strong><small>{counts[key]} specie disponibili</small></span><span className="pokemon-nae-option-check"><Check size={14}/></span>
        </label>)}</div>
      </section>}

      {step===2&&<section className="pokemon-nae-wizard-panel">
        <span className="pokemon-page-eyebrow">03 · DIFFICOLTÀ</span><h2>Imposta il livello di aiuto.</h2>
        <div className="pokemon-nae-guidance"><span className="pokemon-nae-guidance-icon"><HelpCircle size={18}/></span><div><strong>Impostazioni suggerite</strong><p>Numero Pokédex e tipo restano nascosti. L’aiuto ortografico rimane attivo per accompagnarti senza svelare direttamente la risposta.</p></div></div>
        <div className="pokemon-nae-toggle-list">
          <label><span><strong>Numero Pokédex</strong><small>Mostra il numero nazionale nella scheda dettaglio</small></span><input type="checkbox" checked={config.showDexNumber} onChange={e=>update({showDexNumber:e.target.checked})}/></label>
          <label><span><strong>Tipo Pokémon</strong><small>Mostra i tipi nella scheda dettaglio</small></span><input type="checkbox" checked={config.showType} onChange={e=>update({showType:e.target.checked})}/></label>
          <label><span><strong>Aiuto ortografico</strong><small>Rivela progressivamente le lettere corrette, senza mostrare il nome completo</small></span><input type="checkbox" checked={config.spellingHelp} onChange={e=>update({spellingHelp:e.target.checked})}/></label>
        </div>
        <div className="pokemon-nae-subheading"><strong>Shadows</strong><span>Seleziona una preferenza</span></div>
        <div className="pokemon-nae-choice-row">
          <button type="button" className={config.shadows===true?"is-selected":""} onClick={()=>update({shadows:true})}><EyeOff size={15}/> Silhouette</button>
          <button type="button" className={config.shadows===false?"is-selected":""} onClick={()=>update({shadows:false})}><Eye size={15}/> Poké Ball</button>
        </div>
      </section>}

      {step===3&&<section className="pokemon-nae-wizard-panel">
        <span className="pokemon-page-eyebrow">04 · VISUALIZZAZIONE</span><h2>Come vuoi ordinare la griglia?</h2>
        <div className="pokemon-nae-sort-grid">
          <button type="button" onClick={()=>update({sortOrder:"RANDOM"})} className={config.sortOrder==="RANDOM"?"is-selected":""}><Sparkles size={19}/><strong>Casuale</strong><small>Ordine diverso e imprevedibile</small></button>
          <button type="button" onClick={()=>update({sortOrder:"POKEDEX"})} className={config.sortOrder==="POKEDEX"?"is-selected":""}><Grid3X3 size={19}/><strong>Numero Pokédex</strong><small>Ordine crescente nazionale</small><span className="pokemon-nae-default-tag">Predefinito</span></button>
          <button type="button" onClick={()=>update({sortOrder:"TYPE"})} className={config.sortOrder==="TYPE"?"is-selected":""}><ChevronDown size={19}/><strong>Per tipo</strong><small>Specie raggruppate per tipo</small></button>
        </div>
      </section>}

      {step===4&&<section className="pokemon-nae-wizard-panel">
        <span className="pokemon-page-eyebrow">05 · DURATA</span><h2>Quanto tempo hai?</h2>
        <div className="pokemon-nae-duration-grid"><button type="button" onClick={()=>update({durationMinutes:0})} className={config.durationMinutes===0?"is-selected":""}><strong>Illimitato</strong><small>senza timer</small><span className="pokemon-nae-default-tag">Predefinito</span></button>{[30,60,90].map(value=><button type="button" key={value} onClick={()=>update({durationMinutes:value})} className={config.durationMinutes===value?"is-selected":""}><strong>{value}</strong><small>minuti</small></button>)}<button type="button" onClick={()=>update({durationMinutes:-1})} className={config.durationMinutes===-1?"is-selected":""}><strong>Custom</strong><small>personalizzata</small></button></div>
        {config.durationMinutes===-1&&<label className="pokemon-nae-custom-duration">Durata in minuti<input type="number" min="1" max="1440" value={config.customMinutes} onChange={e=>update({customMinutes:e.target.value})} placeholder="Es. 45"/></label>}
      </section>}

      {step===5&&<section className="pokemon-nae-wizard-panel">
        <span className="pokemon-page-eyebrow">06 · MODALITÀ</span><h2>Come vuoi giocare?</h2>
        <div className="pokemon-nae-mode-grid">
          <button type="button" onClick={()=>update({mode:"SOLO"})} className={"pokemon-nae-mode-card mode-solo"+(config.mode==="SOLO"?" is-selected":"")}><span className="pokemon-nae-mode-art">◉</span><span className="pokemon-nae-mode-overline">ESPERIENZA PERSONALE</span><strong>Solo</strong><small>Il tuo Pokédex, il tuo tempo. Gioca al tuo ritmo e costruisci il tuo risultato.</small><span className="pokemon-nae-mode-tag">Una sola persona</span></button>
          <button type="button" onClick={()=>update({mode:"COLLABORATIVE"})} className={"pokemon-nae-mode-card mode-shared"+(config.mode==="COLLABORATIVE"?" is-selected":"")}><span className="pokemon-nae-mode-art">♧</span><span className="pokemon-nae-mode-overline">SQUADRA · FINO A 8</span><strong>Multiplayer condiviso</strong><small>Un solo Pokédex per tutti: ogni scoperta fa avanzare l'intera squadra.</small><span className="pokemon-nae-mode-tag">Collaborate per completarlo</span></button>
          <button type="button" onClick={()=>update({mode:"INDIVIDUAL"})} className={"pokemon-nae-mode-card mode-individual"+(config.mode==="INDIVIDUAL"?" is-selected":"")}><span className="pokemon-nae-mode-art">♜</span><span className="pokemon-nae-mode-overline">SFIDA · FINO A 8</span><strong>Multiplayer individuale</strong><small>Stesso catalogo per tutti, progressi separati e classifica in tempo reale.</small><span className="pokemon-nae-mode-tag">Confronta i tuoi risultati</span></button>
        </div>
      </section>}

      {step===6&&<section className="pokemon-nae-wizard-panel">
        <span className="pokemon-page-eyebrow">07 · RIEPILOGO E AVVIO</span><h2>Pronto a iniziare?</h2>
        <div className="pokemon-nae-summary">
          <div><span>Catalogo principale</span><strong>{mainSpecies.length.toLocaleString("it-IT")} specie</strong></div>
          <div><span>Generazioni</span><strong>{config.generations.map(g=>GENERATION_LABELS[g-1]).join(", ")}</strong></div>
          <div><span>Tipi</span><strong>{config.types.length?config.types.map(t=>POKEMON_TYPE_LABELS[t]).join(", "):"Tutti"}</strong></div>
          <div><span>Sezioni speciali</span><strong>{(Object.keys(specialLabels) as (keyof SpecialSections)[]).filter(k=>config.specialSections[k]).map(k=>specialLabels[k]).join(", ")||"Nessuna"}</strong></div>
          <div><span>Difficoltà</span><strong>{config.showDexNumber?"Numero Pokédex nella scheda":"Numero nascosto"} · {config.showType?"Tipo nella scheda":"Tipo nascosto"}</strong></div>
          <div><span>Aiuto ortografico</span><strong>{config.spellingHelp?"Attivo":"Disattivo"}</strong></div>
          <div><span>Shadows</span><strong>{config.shadows?"Silhouette":"Poké Ball"}</strong></div>
          <div><span>Ordinamento</span><strong>{config.sortOrder==="RANDOM"?"Casuale":config.sortOrder==="POKEDEX"?"Numero Pokédex":"Per tipo"}</strong></div>
          <div><span>Durata</span><strong>{config.durationMinutes===0?"Illimitato":config.durationMinutes===-1?config.customMinutes+" minuti":config.durationMinutes+" minuti"}</strong></div>
          <div><span>Modalità</span><strong>{config.mode==="SOLO"?"Solo":config.mode==="COLLABORATIVE"?"Multiplayer condiviso":"Multiplayer individuale"}</strong></div>
        </div>
        {!catalogReady&&<p className="pokemon-nae-error">Il catalogo server è in sincronizzazione. L&apos;avvio si abiliterà al termine della verifica.</p>}
        {catalogReady&&!canStart&&<p className="pokemon-nae-error">Completa la configurazione e verifica la durata prima di iniziare.</p>}
        {error&&<p className="pokemon-nae-error" role="alert">{error}</p>}
      </section>}

      <footer className="pokemon-nae-wizard-footer">
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>setStep(value=>Math.max(0,value-1))} disabled={step===0||busy}><ArrowLeft size={15}/> Indietro</button>
        {step<6?<button type="button" className="pokemon-favourite-primary" onClick={()=>setStep(value=>Math.min(6,value+1))} disabled={!canContinue}><span>Continua</span><ArrowRight size={15}/></button>
          :<button type="button" className="pokemon-favourite-primary" onClick={start} disabled={!canStart||busy}>{busy?<LoaderCircle size={15}/>:<Play size={15}/>} Inizia partita</button>}
      </footer>
    </section>
  );
}

function formatTime(seconds:number) {
  const safe=Math.max(0,seconds);
  return Math.floor(safe/60).toString().padStart(2,"0")+":"+Math.floor(safe%60).toString().padStart(2,"0");
}
function Game({
  catalog,session,initialDiscoveries,
}:{
  catalog:PokemonCatalog;session:ActiveSession;initialDiscoveries:number[];
}) {
  const router=useRouter();
  const [found,setFound]=useState<Set<number>>(new Set(initialDiscoveries));
  const [query,setQuery]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [recentlyFoundId,setRecentlyFoundId]=useState<number|null>(null);
  const [generationCelebration,setGenerationCelebration]=useState<number|null>(null);
  const [message,setMessage]=useState("");
  const [deadline,setDeadline]=useState(session.deadline_at?new Date(session.deadline_at).getTime():0);
  const [remaining,setRemaining]=useState(()=>session.deadline_at?Math.max(0,Math.ceil((new Date(session.deadline_at).getTime()-Date.now())/1000)):(session.status==="PAUSED"?(session.remaining_seconds??0):(session.remaining_seconds??session.duration_seconds)));
  const [paused,setPaused]=useState(session.status==="PAUSED");
  const [pauseOverlay,setPauseOverlay]=useState(session.status==="PAUSED");
  const [confirmExit,setConfirmExit]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [deleting,setDeleting]=useState(false);
  const [activeSection,setActiveSection]=useState("gen-"+String((session.config.generations as number[]|undefined)?.[0]??1));
  const [selected,setSelected]=useState<PokemonSpecies|null>(null);
  const [collapsedGenerations,setCollapsedGenerations]=useState<Set<number>>(new Set());
  const [collapsedSpecialSections,setCollapsedSpecialSections]=useState<Set<string>>(new Set());
  const [isFinishing,setIsFinishing]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);
  const config=session.config as WizardConfig;
  const unlimited=session.duration_seconds===0;
  const [settingsOpen,setSettingsOpen]=useState(false);
  const {enabled:soundEnabled,setEnabled:setSoundEnabled}=usePokemonSoundPreference();
  const [visual,setVisual]=useState({shadows:config.shadows===true});
  const [sortOrder,setSortOrder]=useState(config.sortOrder);
  const [randomOrder,setRandomOrder]=useState<number[]|null>(null);
  const baseSpecies=session.catalog_species_ids.map(id=>catalog.species.find(item=>item.id===id)).filter((item):item is PokemonSpecies=>Boolean(item));
  const species=sortOrder==="POKEDEX"?[...baseSpecies].sort((a,b)=>a.id-b.id)
    :sortOrder==="TYPE"?[...baseSpecies].sort((a,b)=>(a.types[0]??"").localeCompare(b.types[0]??"")||a.id-b.id)
    :randomOrder?[...baseSpecies].sort((a,b)=>(randomOrder.indexOf(a.id))-(randomOrder.indexOf(b.id))):baseSpecies;
  const changeSort=(value:"RANDOM"|"POKEDEX"|"TYPE")=>{
    setSortOrder(value);
    if(value==="RANDOM")setRandomOrder([...species].sort(()=>Math.random()-.5).map(item=>item.id));
  };
  const sections=[
    ...config.generations.map(g=>({id:"gen-"+g,label:"Gen. "+GENERATION_LABELS[g-1],species:species.filter(item=>item.generation===g)})),
    ...Object.entries(session.special_species_ids??{}).filter(([,ids])=>Array.isArray(ids)&&ids.length>0).map(([key,ids])=>({
      id:"special-"+key,label:specialLabels[key as keyof SpecialSections]??key,
      species:species.filter(item=>(ids as number[]).includes(item.id)),
    })),
  ];
  const sectionIdsKey=sections.map(section=>section.id).join("|");
  useEffect(()=>{
    const targets=sectionIdsKey.split("|").filter(Boolean).map(id=>document.getElementById("nae-"+id)).filter((element):element is HTMLElement=>Boolean(element));
    if(!targets.length)return;
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
      if(visible)setActiveSection(visible.target.id.replace("nae-",""));
    },{rootMargin:"-120px 0px -62% 0px",threshold:0});
    targets.forEach(target=>observer.observe(target));
    return()=>observer.disconnect();
  },[sectionIdsKey]);

  const normalizedQuery=normalizePokemonName(query);
  const exactMatch=findExactPokemonMatch(species,normalizedQuery);
  const exactMatchIsAmbiguous=Boolean(exactMatch&&isAmbiguousPokemonName(species,exactMatch,normalizedQuery));
  const percent=species.length?Math.round(found.size/species.length*100):0;
  const completedGenerations=config.generations.filter(generation=>{
    const generationSpecies=baseSpecies.filter(item=>item.generation===generation);
    return generationSpecies.length>0&&generationSpecies.every(item=>found.has(item.id));
  });
  const completedGenerationKey=completedGenerations.join(",");
  const previousFoundRef=useRef<Set<number>>(new Set(initialDiscoveries));
  const previousCompletedGenerationsRef=useRef(completedGenerationKey);

  useEffect(()=>{
    const newlyFound=[...found].find(id=>!previousFoundRef.current.has(id));
    previousFoundRef.current=new Set(found);
    if(newlyFound===undefined)return;
    setRecentlyFoundId(newlyFound);
    playPokemonSound("unlock",soundEnabled);
    const timer=window.setTimeout(()=>setRecentlyFoundId(null),950);
    return()=>window.clearTimeout(timer);
  },[found,soundEnabled]);

  useEffect(()=>{
    const previous=new Set(previousCompletedGenerationsRef.current.split(",").map(Number).filter(value=>value>0));
    const newlyCompleted=completedGenerationKey.split(",").map(Number).find(generation=>generation>0&&!previous.has(generation));
    previousCompletedGenerationsRef.current=completedGenerationKey;
    if(newlyCompleted===undefined)return;
    setGenerationCelebration(newlyCompleted);
    setMessage("Generazione "+GENERATION_LABELS[newlyCompleted-1]+" completata!");
    const timer=window.setTimeout(()=>setGenerationCelebration(null),1600);
    return()=>window.clearTimeout(timer);
  },[completedGenerationKey]);

  useEffect(()=>{
    if(unlimited||paused||isFinishing||!deadline)return;
    const tick=()=>setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000)));
    tick();
    const id=window.setInterval(tick,250);
    return ()=>window.clearInterval(id);
  },[deadline,paused,isFinishing,unlimited]);

  const finish=useCallback(async(reason:string)=>{
    if(isFinishing)return;
    if(reason==="TIMER_EXPIRED"&&(!deadline||Date.now()<deadline+2000)){
      if(deadline)setRemaining(Math.max(1,Math.ceil((deadline-Date.now())/1000)));
      return;
    }
    setIsFinishing(true);
    const result=await finishNameEmAllAction(session.id,reason);
    if(!result.ok){setMessage(result.error??"Non è stato possibile salvare il risultato.");setIsFinishing(false);return;}
    router.refresh();
  },[deadline,isFinishing,router,session.id]);

  useEffect(()=>{
    if(unlimited||paused||isFinishing||!deadline||Date.now()<deadline+2000)return;
    const id=window.setTimeout(()=>{void finish("TIMER_EXPIRED");},0);
    return()=>window.clearTimeout(id);
  },[deadline,paused,isFinishing,finish,unlimited]);

  const processQueuedSubmission=useCallback(async(answer:string,optimisticSpecies:PokemonSpecies)=>{
    let result:Awaited<ReturnType<typeof submitNameEmAllAnswerAction>>;
    try{result=await submitNameEmAllAnswerAction(session.id,answer);}catch{
      setFound(current=>{const next=new Set(current);next.delete(optimisticSpecies.id);return next;});
      setConfirmed(false);setMessage("Connessione interrotta: risposta non registrata.");return;
    }
    if(!result.ok){
      setFound(current=>{const next=new Set(current);next.delete(optimisticSpecies.id);return next;});
      setConfirmed(false);setMessage(result.error??"Risposta non registrata.");return;
    }
    const data=result.data??{};
    if(data.status==="CORRECT"&&typeof data.speciesId==="number"){
      setFound(current=>new Set(current).add(data.speciesId as number));
      setConfirmed(true);setMessage("Pokémon scoperto!");
      if(data.completed===true){playPokemonSound("complete",soundEnabled);void finish("CATALOG_COMPLETE");}
    }else if(data.status==="ALREADY_FOUND"){
      setFound(current=>new Set(current).add(optimisticSpecies.id));
      setConfirmed(false);setMessage("Hai già scoperto questo Pokémon!");
    }else if(data.status==="INCORRECT"){
      setFound(current=>{const next=new Set(current);next.delete(optimisticSpecies.id);return next;});
      setConfirmed(false);playPokemonSound("incorrect",soundEnabled);setMessage("Pokémon non riconosciuto.");
    }else if(data.status==="TIME_EXPIRED"){
      setFound(current=>{const next=new Set(current);next.delete(optimisticSpecies.id);return next;});
      setConfirmed(false);setMessage("Tempo scaduto.");void finish("TIMER_EXPIRED");
    }else if(data.status==="PAUSED"){
      setFound(current=>{const next=new Set(current);next.delete(optimisticSpecies.id);return next;});
      setConfirmed(false);setMessage("La partita è in pausa.");
    }
  },[session.id,soundEnabled,finish]);
  const {enqueue:enqueueSubmission,pending,queuedKeysRef}=useNameEmAllSubmissionQueue(processQueuedSubmission);
  const enqueuePokemonSubmission=useCallback((answer:string,item:PokemonSpecies)=>{
    if(paused||isFinishing||found.has(item.id)||queuedKeysRef.current.has(item.id))return;
    if(!enqueueSubmission(answer,item,item.id))return;
    preparePokemonAudio(soundEnabled);
    setFound(current=>new Set(current).add(item.id));
    setQuery("");setConfirmed(true);setMessage("Pokémon scoperto!");
    playPokemonSound("correct",soundEnabled);
  },[paused,isFinishing,found,queuedKeysRef,enqueueSubmission,soundEnabled]);


  useEffect(()=>{
    if(!pauseOverlay&&!confirmExit&&!confirmDelete)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=previous;};
  },[pauseOverlay,confirmExit,confirmDelete]);

  const discardGame=async()=>{
    if(deleting)return;
    setDeleting(true);setMessage("");
    const result=await deleteNameEmAllSoloAction(session.id);
    if(!result.ok){setMessage(result.error??"Non è stato possibile eliminare la partita.");setDeleting(false);setConfirmDelete(false);return;}
    router.replace("/pokemon/name-em-all");
    router.refresh();
  };

  const togglePause=async()=>{
    if(paused)return;
    const result=await pauseNameEmAllAction(session.id);
    if(!result.ok){setMessage(result.error??"Pausa non disponibile.");return;}
    const seconds=Number(result.data?.remainingSeconds??remaining);
    setRemaining(seconds);setPaused(true);setPauseOverlay(true);
  };
  const resume=async()=>{
    const result=await resumeNameEmAllAction(session.id);
    if(!result.ok){setMessage(result.error??"Ripresa non disponibile.");return;}
    const date=String(result.data?.deadlineAt??"");
    setDeadline(date?new Date(date).getTime():0);setRemaining(Number(result.data?.remainingSeconds??0));setPaused(false);setPauseOverlay(false);
  };
  useEffect(()=>{
    if(!selected)return;
    window.scrollTo({top:0,behavior:"smooth"});
  },[selected]);

  const revealHint=async()=>{
    if(!selected)return null;
    const result=await hintNameEmAllAction(session.id,selected.id);
    if(!result.ok){setMessage(result.error??"Aiuto non disponibile.");return null;}
    const nextHint={nameLength:Number(result.data?.nameLength??0),revealedPrefix:String(result.data?.revealedPrefix??""),hintCount:Number(result.data?.hintCount??0)};
    return nextHint;
  };
  const openSection=(id:string)=>{
    setActiveSection(id);
    document.getElementById("nae-"+id)?.scrollIntoView({behavior:"smooth",block:"start"});
  };
  const discoveredName=(id:number)=>found.has(id);

  return (
    <section className="pokemon-nae-game">
      <header className="pokemon-nae-game-header">
        <div><span className="pokemon-page-eyebrow">RENQD × POKÉMON · IN PARTITA</span><h1>Name ’Em All</h1><p>Riconosci le specie del tuo catalogo. Le forme associate si sbloccano senza punti aggiuntivi.</p></div>
        <div className="pokemon-nae-game-header-actions"><button type="button" className="pokemon-favourite-secondary" onClick={()=>setSettingsOpen(value=>!value)}><Settings size={15}/> Impostazioni</button><button type="button" className="pokemon-favourite-secondary" onClick={()=>void togglePause()} disabled={paused}><Pause size={15}/> Pausa</button></div>
      </header>
      {settingsOpen&&<section className="pokemon-nae-live-settings" aria-label="Impostazioni di gioco">
        <div className="pokemon-nae-toggle-list">
          <label><span><strong>Shadows · Silhouette</strong></span><input type="checkbox" checked={visual.shadows} onChange={event=>setVisual(value=>({...value,shadows:event.target.checked}))}/></label>
          <label><span><strong>Effetti sonori</strong><small>Risposte, sblocchi e completamento</small></span><input type="checkbox" checked={soundEnabled} onChange={event=>setSoundEnabled(event.target.checked)}/></label>
        </div>
        <div className="pokemon-nae-choice-row">{([["RANDOM","Casuale"],["POKEDEX","Pokédex"],["TYPE","Per tipo"]] as const).map(([value,label])=><button type="button" key={value} className={sortOrder===value?"is-selected":""} onClick={()=>changeSort(value)}>{label}</button>)}</div>
      </section>}
      <div className="pokemon-nae-hud">
        <div className="pokemon-nae-hud-top">
          <div><small>TEMPO RIMANENTE</small><strong className={!unlimited&&remaining<60?"is-urgent":""}>{unlimited?"Illimitato":formatTime(remaining)}</strong></div>
          <div><small>POKÉMON TROVATI</small><strong>{found.size.toLocaleString("it-IT")} / {species.length.toLocaleString("it-IT")}</strong></div>
          <div><small>COMPLETAMENTO</small><strong>{percent}%</strong></div>
        </div>
        <div className="pokemon-nae-progress"><span style={{width:percent+"%"}}/></div>
      </div>
      <nav className="pokemon-nae-section-nav" aria-label="Navigazione catalogo">
        {sections.map(section=>{
          const generation=section.id.startsWith("gen-")?Number(section.id.slice(4)):null;
          const isComplete=generation!==null&&completedGenerations.includes(generation);
          const total=section.id==="special-mega"?section.species.reduce((sum,item)=>sum+item.megaForms.length,0):section.species.length;
          const count=section.id==="special-mega"?section.species.reduce((sum,item)=>sum+(found.has(item.id)?item.megaForms.length:0),0):section.species.filter(item=>found.has(item.id)).length;
          return <button type="button" key={section.id} onClick={()=>openSection(section.id)} className={[activeSection===section.id?"is-active":"",isComplete?"is-complete":"",generationCelebration===generation?"is-celebrating":""].filter(Boolean).join(" ")}>{section.label}{isComplete&&<CheckCircle2 size={11} aria-label="Completata"/>}<small>{count}/{total}</small></button>;
        })}
      </nav>
      <div className="pokemon-nae-search-wrap">
        <label className={"pokemon-nae-search"+(confirmed?" is-correct":message==="Pokémon non riconosciuto."?" is-wrong":"")}>
          <input ref={inputRef} value={query} onChange={event=>{const value=event.target.value;setQuery(value);setConfirmed(false);setMessage("");const normalized=normalizePokemonName(value);if(!normalized||paused||isFinishing)return;const match=findExactPokemonMatch(species,normalized);if(!match||isAmbiguousPokemonName(species,match,normalized))return;if(found.has(match.id)||queuedKeysRef.current.has(match.id)){setQuery("");setMessage("Hai già scoperto questo Pokémon!");return;}enqueuePokemonSubmission(match.name,match);}}
            onKeyDown={event=>{if(event.key==="Enter"&&exactMatch&&exactMatchIsAmbiguous&&!paused&&!isFinishing){event.preventDefault();if(found.has(exactMatch.id)||queuedKeysRef.current.has(exactMatch.id)){setQuery("");setMessage("Hai già scoperto questo Pokémon!");return;}enqueuePokemonSubmission(exactMatch.name,exactMatch);}}}
            placeholder="Scrivi il nome di un Pokémon…" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} disabled={paused||isFinishing}/>
          {confirmed&&<CheckCircle2 size={15} className="pokemon-nae-search-confirmed"/>}
          {pending&&<LoaderCircle size={15}/>}
        </label>
        {message&&<p className={"pokemon-nae-feedback"+(confirmed?" is-correct":"")} role="status">{message}</p>}
      </div>
      <div className="pokemon-nae-catalog">
        {sections.map(section=><section id={"nae-"+section.id} className="pokemon-nae-catalog-section" key={section.id}>
          <header><div><span className="pokemon-page-eyebrow">{section.id.startsWith("gen-")?"POKÉDEX NAZIONALE":"SEZIONE SPECIALE"}</span><h2>{section.label}</h2></div><div className="pokemon-nae-catalog-header-actions"><span>{section.species.filter(s=>found.has(s.id)).length} / {section.species.length}</span>{section.id.startsWith("gen-")?(()=>{const generation=Number(section.id.slice(4));const collapsed=collapsedGenerations.has(generation);return <button type="button" className="pokemon-nae-collapse-toggle" aria-expanded={!collapsed} onClick={()=>setCollapsedGenerations(current=>{const next=new Set(current);if(next.has(generation))next.delete(generation);else next.add(generation);return next;})}><ChevronDown size={14} className={collapsed?"":"is-open"}/><span>{collapsed?"Espandi":"Comprimi"}</span></button>;})():(()=>{const collapsed=collapsedSpecialSections.has(section.id);return <button type="button" className="pokemon-nae-collapse-toggle" aria-expanded={!collapsed} onClick={()=>setCollapsedSpecialSections(current=>{const next=new Set(current);if(next.has(section.id))next.delete(section.id);else next.add(section.id);return next;})}><ChevronDown size={14} className={collapsed?"":"is-open"}/><span>{collapsed?"Espandi":"Comprimi"}</span></button>;})()}</div></header>
          {(section.id.startsWith("gen-")?!collapsedGenerations.has(Number(section.id.slice(4))):!collapsedSpecialSections.has(section.id)) ? <div className="pokemon-nae-cell-grid">
            {(section.id==="special-mega"
              ? section.species.flatMap(item=>item.megaForms.map(form=>({species:item,form})))
              : section.species.map(item=>({species:item,form:null}))).map(({species:item,form})=>{
              const isFound=found.has(item.id);
              const artwork=form?.spriteUrl??item.spriteUrl;
              const displayName=form ? item.name+" "+form.label : item.name;
              return <button type="button" key={item.id+"-"+(form?.id??"base")} onClick={()=>{setSelected(item);}} className={"pokemon-nae-cell"+(isFound?" is-found":"")+(recentlyFoundId===item.id?" is-revealing":"")}>
                <span className="pokemon-nae-cell-art">{isFound||visual.shadows?<img src={artwork} alt="" loading="lazy" style={{filter:isFound?"none":"brightness(0) saturate(0) opacity(.55)"}}/>:<b className="pokemon-nae-pokeball">◉</b>}</span>
                {isFound?<strong>{displayName}</strong>:<strong className="is-hidden">???</strong>}
                {(item.forms.length>0||item.isLegendary||item.isMythical||item.isUltraBeast||item.isParadox)&&<span className="pokemon-nae-cell-indicators">{item.forms.length>0?"◇":""}{item.isLegendary?"★":""}{item.isMythical?"✦":""}{item.isUltraBeast?"◈":""}{item.isParadox?"⌁":""}</span>}
              </button>;
            })}
          </div> : null}
        </section>)}
      </div>

      <PokemonDiscoveryDialog selected={selected} discovered={Boolean(selected&&found.has(selected.id))} spellingHelp={config.spellingHelp!==false} onClose={()=>setSelected(null)} onRevealLetter={revealHint}/>

      <Dialog open={pauseOverlay} onClose={()=>void resume()} overlayClassName="pokemon-nae-pause-backdrop" className="pokemon-nae-pause-card" labelledBy="pokemon-nae-pause-title" closeOnBackdrop={false}>
        <span className="pokemon-page-eyebrow">PARTITA IN PAUSA</span><h2 id="pokemon-nae-pause-title">La partita è in pausa.</h2><p>Il timer è fermo e la griglia non è consultabile. Puoi riprendere, salvare il risultato parziale oppure eliminare questa partita.</p>
        <strong>{formatTime(remaining)}</strong>
        <button type="button" className="pokemon-favourite-primary" autoFocus onClick={()=>void resume()}><Play size={15}/> Riprendi partita</button>
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirmExit(true)}>Salva e termina</button>
        <button type="button" className="pokemon-nae-delete-game" onClick={()=>setConfirmDelete(true)}><X size={15}/> Elimina partita</button>
      </Dialog>
      <Dialog open={confirmExit} onClose={()=>setConfirmExit(false)} overlayClassName="pokemon-nae-pause-backdrop" className="pokemon-nae-pause-card" role="alertdialog" labelledBy="pokemon-nae-exit-title">
        <span className="pokemon-page-eyebrow">SALVATAGGIO RISULTATO</span><h2 id="pokemon-nae-exit-title">Salvare il risultato parziale?</h2>
        <p>La partita terminerà e il risultato verrà conservato nel tuo profilo Renqd.</p>
        <button type="button" className="pokemon-favourite-primary" autoFocus onClick={()=>{setConfirmExit(false);void finish("USER_EXIT");}}>Salva e termina</button>
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirmExit(false)}>Torna alla partita</button>
      </Dialog>
      <Dialog open={confirmDelete} onClose={()=>setConfirmDelete(false)} overlayClassName="pokemon-nae-pause-backdrop" className="pokemon-nae-pause-card" role="alertdialog" labelledBy="pokemon-nae-delete-title">
        <span className="pokemon-page-eyebrow">ELIMINAZIONE PARTITA</span><h2 id="pokemon-nae-delete-title">Vuoi eliminare questa partita?</h2>
        <p>La sessione e tutte le scoperte effettuate verranno eliminate. Non sarà creato alcun risultato nel profilo.</p>
        <button type="button" className="pokemon-nae-delete-game" autoFocus onClick={()=>void discardGame()} disabled={deleting}>{deleting?<LoaderCircle size={15}/>:<X size={15}/>} Elimina definitivamente</button>
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirmDelete(false)} disabled={deleting}>Annulla</button>
      </Dialog>

    </section>
  );
}

function ResultView({result,onNewGame,catalog,canManageVisibility=false}:{result:ResultSnapshot;onNewGame?:()=>void;catalog?:PokemonCatalog|null;canManageVisibility?:boolean}) {
  const [visibility,setVisibility]=useState<"PUBLIC"|"PRIVATE">(result.visibility==="PRIVATE"?"PRIVATE":"PUBLIC");
  const [visibilityBusy,setVisibilityBusy]=useState(false);
  const [visibilityMessage,setVisibilityMessage]=useState("");
  const [activeTab,setActiveTab]=useState("overview");
  const [exportSize,setExportSize]=useState<"VERTICAL"|"SQUARE">("VERTICAL");
  const [exportMode,setExportMode]=useState<"PERSONAL"|"FULL">("PERSONAL");
  const [exporting,setExporting]=useState(false);
  const [exportError,setExportError]=useState("");
  const exportRef=useRef<HTMLDivElement>(null);
  const level=String(result.level??"Principiante");
  const medal=String(result.medalKey??"eevee");
  const colors:Record<string,string>={eevee:"#9b6b42",sylveon:"#d77fa6",espeon:"#8d70c7",umbreon:"#393b4b",leafeon:"#719b5b",glaceon:"#84b7d0"};
  const medalIds:Record<string,number>={eevee:133,sylveon:700,espeon:196,umbreon:197,leafeon:470,glaceon:471};
  const medalArt="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/"+(medalIds[medal]??133)+".png";
  const discoveredIds=Array.isArray(result.discoveredSpeciesIds)?(result.discoveredSpeciesIds as unknown[]).map(Number).filter(Number.isFinite):[];
  const discovered=useMemo(()=>discoveredIds.map(id=>catalog?.species.find(item=>item.id===id)).filter((item):item is PokemonSpecies=>Boolean(item)),[catalog,result.discoveredSpeciesIds]);
  const leaderboard=Array.isArray(result.leaderboard)?result.leaderboard as Array<Record<string,unknown>>:[];
  const isShared=result.gameMode==="COLLABORATIVE";
  const ownRow=leaderboard.find(entry=>String(entry.userId??"")===String(result.userId??""));
  const personalScore=Number(result.personalFoundCount??ownRow?.foundCount??result.score??result.foundCount??0);
  const teamScore=Number(result.teamFoundCount??result.foundCount??result.score??0);
  const exportScore=exportMode==="FULL"&&isShared?teamScore:personalScore;
  const finishLabels:Record<string,string>={TIMER_EXPIRED:"Timer scaduto",CATALOG_COMPLETE:"Pokédex completato",USER_EXIT:"Terminata dal giocatore",HOST_TERMINATED:"Terminata dall’host",ALL_COMPLETED:"Tutti i partecipanti hanno completato",PLAYER_LEFT:"Risultato parziale · uscita volontaria"};
  const exportWidth=1080;
  const exportHeight=exportSize==="VERTICAL"?1350:1080;
  const updateVisibility=async(value:"PUBLIC"|"PRIVATE")=>{
    if(typeof result.sessionId!=="string")return;
    setVisibilityBusy(true);setVisibilityMessage("");
    const response=await setNameEmAllResultVisibilityAction(result.sessionId,value);
    if(response.ok){setVisibility(value);setVisibilityMessage("Visibilità del risultato aggiornata.");}
    else setVisibilityMessage(response.error??"Impossibile aggiornare la visibilità.");
    setVisibilityBusy(false);
  };
  const handleExport=async()=>{
    if(!exportRef.current)return;
    setExporting(true);setExportError("");
    try{
      const dataUrl=await toPng(exportRef.current,{cacheBust:true,pixelRatio:1,width:exportWidth,height:exportHeight,canvasWidth:exportWidth,canvasHeight:exportHeight});
      const link=document.createElement("a");
      link.href=dataUrl;
      link.download="renqd-name-em-all-"+exportSize.toLowerCase()+"-"+exportMode.toLowerCase()+".png";
      link.click();
    }catch{
      setExportError("Non è stato possibile generare il PNG. Riprova tra poco.");
    }finally{setExporting(false);}
  };
  return <section className="pokemon-nae-result">
    <header className="pokemon-nae-result-hero pokemon-hub-hero">
      <div className="pokemon-hub-hero-copy">
        <p className="pokemon-hub-kicker">RENQD × POKÉMON · NAME ’EM ALL</p>
        <h1>{typeof result.ownerName==="string"?<>La partita di {result.ownerName}</>:<>La tua <em>sfida.</em></>}</h1>
        <p>Ogni Pokémon scoperto racconta un pezzo della tua partita. Ecco il riepilogo della sessione.</p>
      </div>
      <div className="pokemon-nae-result-characters" aria-hidden="true">
        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/196.png" alt=""/>
        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/470.png" alt=""/>
        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/471.png" alt=""/>
      </div>
    </header>
    {result.partial===true&&<p className="pokemon-nae-partial-tag">Risultato parziale salvato · potrai rientrare nella sessione finché resta attiva.</p>}
    <div className={"pokemon-nae-result-card medal-"+medal} style={{background:"linear-gradient(145deg,"+(colors[medal]??colors.eevee)+"30,#fffdfa 72%)"}}>
      <div className="pokemon-nae-result-artwork"><img src={medalArt} alt="" crossOrigin="anonymous"/></div>
      <div className="pokemon-nae-result-medal" style={{borderColor:colors[medal]??colors.eevee,background:"linear-gradient(145deg,#fffdf8,"+(colors[medal]??colors.eevee)+"22)"}}>
        <span className="pokemon-nae-medal-silhouette" aria-hidden="true" style={{backgroundColor:colors[medal]??colors.eevee,WebkitMaskImage:"url("+medalArt+")",maskImage:"url("+medalArt+")"}}/>
      </div>
      <span className="pokemon-page-eyebrow">LIVELLO OTTENUTO</span><h2>{level}</h2>
      <strong className="pokemon-nae-result-score">{String(isShared?personalScore:result.score??result.foundCount??0)} <small>{isShared?"contributo personale":"Pokémon"}</small></strong>
      <div className="pokemon-nae-result-stats">
        <div><strong>{String(result.completion??0)}%</strong><small>{isShared?"Completamento personale":"Completamento"}</small></div>
        {isShared&&<div><strong>{String(result.teamCompletion??0)}%</strong><small>Squadra</small></div>}
        <div><strong>{String(result.accuracy??0)}%</strong><small>Precisione</small></div>
        <div><strong>{formatTime(Number(result.elapsedSeconds??0))}</strong><small>Tempo effettivo</small></div>
        <div><strong>{String(result.errorsUnique??result.errorCount??0)}</strong><small>Errori unici</small></div>
        <div><strong>{String(result.assistedCount??result.hintCount??0)}</strong><small>Assistiti</small></div>
        <div><strong>{String(result.performanceIndex??0)}</strong><small>Indice di prestazione</small></div>
      </div>
      {result.perfect===true&&<p className="pokemon-nae-perfect"><CheckCircle2 size={16}/> Partita perfetta · Maestro Pokémon</p>}
      <p className="pokemon-nae-result-finish-reason">{finishLabels[String(result.finishReason??"")]??"Risultato salvato"}</p>
    </div>
    <nav className="pokemon-nae-result-tabs" aria-label="Dettaglio risultato">
      {[{id:"overview",label:"Panoramica"},{id:"stats",label:"Statistiche"},{id:"pokedex",label:"Pokédex"},...(leaderboard.length?[{id:"leaderboard",label:"Classifica"}]:[])].map(tab=><button type="button" key={tab.id} onClick={()=>setActiveTab(tab.id)} className={activeTab===tab.id?"is-active":""}>{tab.label}</button>)}
    </nav>
    <div className="pokemon-nae-result-tab-content">
      {activeTab==="overview"&&<div className="pokemon-nae-result-overview">
        <p>La partita è stata registrata nel tuo profilo Renqd. Il livello mostrato è quello ottenuto in questa specifica sessione.</p>
        <div><span>Pokémon trovati</span><strong>{String(teamScore)} / {String(result.catalogCount??0)}</strong></div>
        {isShared&&<div><span>Contributo personale</span><strong>{String(personalScore)} Pokémon</strong></div>}
        <div><span>Generazioni completate</span><strong>{String(Array.isArray(result.generationsCompleted)?result.generationsCompleted.length:Number(result.generationsCompleted??0))}</strong></div>
        {isShared&&<div><span>Completamento squadra</span><strong>{String(result.teamCompletion??0)}%</strong></div>}
        <div><span>Conclusione</span><strong>{finishLabels[String(result.finishReason??"")]??"Risultato salvato"}</strong></div>
      </div>}
      {activeTab==="stats"&&<div className="pokemon-nae-result-detail-grid">
        {[[isShared?"Completamento personale":"Completamento",String(result.completion??0)+"%"],...(isShared?[["Completamento squadra",String(result.teamCompletion??0)+"%"]]:[]),["Precisione",String(result.accuracy??0)+"%"],["Tempo effettivo",formatTime(Number(result.elapsedSeconds??0))],["Errori unici",String(result.errorsUnique??result.errorCount??0)],["Pokémon assistiti",String(result.assistedCount??result.hintCount??0)],["Indice di prestazione",String(result.performanceIndex??0)],["Generazioni completate",String(Array.isArray(result.generationsCompleted)?result.generationsCompleted.length:Number(result.generationsCompleted??0))],["Modalità",result.gameMode==="COLLABORATIVE"?"Multiplayer condiviso":result.gameMode==="INDIVIDUAL"?"Multiplayer individuale":"Solo"]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}
      </div>}
      {activeTab==="pokedex"&&<div className="pokemon-nae-result-pokedex">
        {!catalog?<p>Caricamento del Pokédex…</p>:!discovered.length?<p>Il dettaglio delle specie scoperte non è disponibile in questo snapshot.</p>:discovered.map(item=><div key={item.id}><img src={item.spriteUrl} alt="" loading="lazy"/><span><strong>{item.name}</strong><small>#{String(item.id).padStart(4,"0")} · Gen. {GENERATION_LABELS[item.generation-1]}</small></span></div>)}
      </div>}
      {activeTab==="leaderboard"&&<div className="pokemon-nae-result-leaderboard">
        {leaderboard.map((entry,index)=>{const content=<><span>{String(entry.rankPosition??index+1).padStart(2,"0")}</span><div className="pokemon-nae-leader-avatar">{typeof entry.avatarUrl==="string"&&entry.avatarUrl?<img src={entry.avatarUrl} alt=""/>:String(entry.displayName??entry.username??"?").slice(0,1).toUpperCase()}</div><strong>{String(entry.displayName??entry.username??"Allenatore")}</strong><small>{String(entry.foundCount??0)} Pokémon · {String(entry.accuracy??0)}%</small></>;return typeof entry.publicSlug==="string"&&entry.publicSlug?<Link key={String(entry.userId??index)} href={"/r/"+entry.publicSlug}>{content}</Link>:<div key={String(entry.userId??index)}>{content}</div>;})}
      </div>}
    </div>
    <section className="pokemon-nae-export-tools">
      <div><span className="pokemon-page-eyebrow">ESPORTA IL RISULTATO</span><h3>Una card da conservare.</h3></div>
      <div className="pokemon-nae-export-options">
        <div><button type="button" className={exportSize==="VERTICAL"?"is-selected":""} onClick={()=>setExportSize("VERTICAL")}>Verticale 1080×1350</button><button type="button" className={exportSize==="SQUARE"?"is-selected":""} onClick={()=>setExportSize("SQUARE")}>Quadrato 1080×1080</button></div>
        <div><button type="button" className={exportMode==="PERSONAL"?"is-selected":""} onClick={()=>setExportMode("PERSONAL")}>Personale</button><button type="button" className={exportMode==="FULL"?"is-selected":""} onClick={()=>setExportMode("FULL")} disabled={!leaderboard.length}>Risultato completo</button></div>
      </div>
      {exportError&&<p role="alert" className="pokemon-nae-error">{exportError}</p>}
      <button type="button" className="pokemon-favourite-primary" onClick={()=>void handleExport()} disabled={exporting}>{exporting?<LoaderCircle size={15}/>:<ArrowDownToLine size={15}/>} {exporting?"Preparazione PNG…":"Esporta PNG"}</button>
    </section>
    <div className="pokemon-nae-export-canvas" aria-hidden="true">
      <div ref={exportRef} className={"pokemon-nae-export-card medal-"+medal+" "+(exportSize==="SQUARE"?"is-square":"is-vertical")} style={{width:exportWidth,height:exportHeight}}>
        <div className="pokemon-nae-export-top"><img src="/brand/renqd-logo.svg" alt="Renqd" crossOrigin="anonymous"/><span>NAME ’EM ALL</span></div>
        <div className="pokemon-nae-export-main">
          <div className="pokemon-nae-export-medal" style={{background:colors[medal]??colors.eevee}}><img className="pokemon-nae-export-medal-silhouette" src={medalArt} alt="" crossOrigin="anonymous"/></div>
          <span>{exportMode==="FULL"&&isShared?"RISULTATO DI SQUADRA":"IL TUO LIVELLO"}</span><h2>{level}</h2><strong>{String(exportScore)} Pokémon</strong>
          <div className="pokemon-nae-export-stats"><span><b>{String(result.completion??0)}%</b>{isShared?"Completamento personale":"Completamento"}</span>{isShared&&<span><b>{String(result.teamCompletion??0)}%</b>Squadra</span>}<span><b>{String(result.accuracy??0)}%</b>Precisione</span><span><b>{formatTime(Number(result.elapsedSeconds??0))}</b>Tempo effettivo</span></div>
          {result.perfect===true&&<em>MAESTRO POKÉMON · PARTITA PERFETTA</em>}
        </div>
        {exportMode==="FULL"&&leaderboard.length>0&&<div className="pokemon-nae-export-leaderboard"><span>CLASSIFICA COMPLETA</span>{leaderboard.slice(0,8).map((entry,index)=><div key={String(entry.userId??index)}><b>{String(entry.rankPosition??index+1)}</b><strong>{String(entry.displayName??entry.username??"Allenatore")}</strong><small>{String(entry.foundCount??0)} Pokémon</small></div>)}</div>}
        <div className="pokemon-nae-export-footer">RENQD · NAME ’EM ALL</div>
      </div>
    </div>
    {(typeof result.publicSlug==="string"&&result.publicSlug||typeof result.rankingId==="string"&&result.rankingId)&&<Link className="pokemon-favourite-secondary" href={"/r/"+String(result.publicSlug??result.rankingId)}>Apri il risultato e la community <ArrowRight size={15}/></Link>}
    {onNewGame&&<button type="button" className="pokemon-favourite-primary" onClick={onNewGame}><Play size={15}/> Nuova partita</button>}
  </section>;
}

export function NameEmAllExperience({activeSession,initialDiscoveries=[],latestResult=null,initialParticipants=[],initialDiscoverers={},currentUserId="",currentUserRole=""}:{
  activeSession:ActiveSession|null;initialDiscoveries?:number[];latestResult?:ResultSnapshot|null;
  initialParticipants?:NameEmAllParticipant[];initialDiscoverers?:Record<string,string>;currentUserId?:string;currentUserRole?:string;
}) {
  const router=useRouter();
  const [catalog,setCatalog]=useState<PokemonCatalog|null>(null);
  const [error,setError]=useState("");
  const [showWizard,setShowWizard]=useState(false);
  const [catalogReady,setCatalogReady]=useState(false);
  const [syncError,setSyncError]=useState("");
  useEffect(()=>{let alive=true;fetch("/data/pokemon/catalog.json").then(r=>r.json()).then((data:PokemonCatalog)=>{if(alive)setCatalog(data);}).catch(()=>{if(alive)setError("Catalogo non disponibile.");});return()=>{alive=false;};},[]);
  useEffect(()=>{
    let alive=true;
    let retry:number|undefined;
    const supabase=createClient();
    const sync=async(attempt:number)=>{
      try{
        const {data,error}=await supabase.functions.invoke("pokemon-catalog-sync",{body:{}});
        if(!alive)return;
        if(error)throw error;
        const count=Number((data as {speciesCount?:number}|null)?.speciesCount??0);
        if(count>=1000){setCatalogReady(true);setSyncError("");return;}
        if(attempt<12){retry=window.setTimeout(()=>void sync(attempt+1),2500);return;}
        setSyncError("Sincronizzazione catalogo non completata. Riprova tra poco.");
      }catch{
        if(alive)setSyncError("Catalogo server non raggiungibile. Riprova tra poco.");
      }
    };
    void sync(0);
    return()=>{alive=false;if(retry)window.clearTimeout(retry);};
  },[]);
  const start=async(config:WizardConfig)=>{
    const payload={
      generations:config.generations,types:config.types,specialSections:config.specialSections,
      showDexNumber:config.showDexNumber,showType:config.showType,spellingHelp:config.spellingHelp,
      shadows:config.shadows,sortOrder:config.sortOrder,durationMinutes:config.durationMinutes,unlimited:config.durationMinutes===0||config.unlimited===true,mode:config.mode,
    };
    const result=config.mode==="SOLO"
      ? await createNameEmAllSoloAction(payload)
      : await createNameEmAllMultiplayerAction(payload,config.mode);
    if(!result.ok)throw new Error(result.error??"Avvio non riuscito.");
    router.refresh();
  };
  if(!catalog)return <div className="pokemon-favourite-loading"><LoaderCircle size={18}/> Caricamento Pokédex… {error}</div>;
  if(activeSession?.status==="LOBBY")return <NameEmAllMultiplayerLobby session={activeSession} participants={initialParticipants} currentUserId={currentUserId}/>;
  if(activeSession&&activeSession.game_mode!=="SOLO")return <PokemonNameEmAllMultiplayerGame catalog={catalog} session={activeSession} initialDiscoveries={initialDiscoveries} initialParticipants={initialParticipants} initialDiscoverers={initialDiscoverers} currentUserId={currentUserId} currentUserRole={currentUserRole}/>;
  if(activeSession)return <Game catalog={catalog} session={activeSession} initialDiscoveries={initialDiscoveries}/>;
  if(latestResult&&!showWizard)return <ResultView result={latestResult} catalog={catalog} onNewGame={()=>setShowWizard(true)} canManageVisibility/>;
  return <><p className={catalogReady?"pokemon-catalog-sync is-ready":"pokemon-catalog-sync"}>{catalogReady?<CheckCircle2 size={14}/>:<LoaderCircle size={14}/>} {catalogReady?"Catalogo server verificato · "+catalog.speciesCount+" specie":syncError||"Verifica del catalogo server in corso…"}</p><Wizard catalog={catalog} onStart={start} catalogReady={catalogReady}/></>;
}


export function PokemonNameEmAllPublicResultView({result,ownerName,social,isOwner=false,profileHref="/profile"}:{result:ResultSnapshot;ownerName:string;isOwner?:boolean;profileHref?:string;social?:{rankingId:string;resultOwnerId:string;initialLiked:boolean;initialLikeCount:number;initialLikers:import("@/components/pokemon/result-social").PokemonResultLiker[];initialComments:import("@/components/pokemon/result-social").PokemonResultComment[];currentUserId:string;canLike:boolean;canComment:boolean;isOwner:boolean}}) {
  const [catalog,setCatalog]=useState<PokemonCatalog|null>(null);
  useEffect(()=>{let alive=true;fetch("/data/pokemon/catalog.json").then(response=>response.json()).then((data:PokemonCatalog)=>{if(alive)setCatalog(data);}).catch(()=>{});return()=>{alive=false;};},[]);
  return <main className="pokemon-page pokemon-nae-result-public">
    <Link href={profileHref} className="pokemon-nae-public-profile-back"><ArrowLeft size={16}/> Torna al profilo</Link>
    <ResultView result={{...result,ownerName}} catalog={catalog} canManageVisibility={isOwner}/>
    {social&&<PokemonResultSocial {...social}/>}
  </main>;
}
