"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { createClient } from "@/lib/supabase/client";
import { PokemonResultSocial } from "@/components/pokemon/result-social";
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Eye, EyeOff,
  Grid3X3, HelpCircle, LoaderCircle, Pause, Play, Search, Sparkles, Trophy, X,
} from "lucide-react";
import {
  GENERATION_LABELS, POKEMON_TYPE_LABELS, POKEMON_TYPES,
  PokemonCatalog, PokemonSpecies, normalizePokemonName,
} from "@/lib/pokemon/catalog";
import {
  createNameEmAllSoloAction, finishNameEmAllAction, hintNameEmAllAction,
  pauseNameEmAllAction, resumeNameEmAllAction, submitNameEmAllAnswerAction,
} from "@/app/(platform)/pokemon/name-em-all/actions";

type SpecialSections = { mega:boolean; legendary:boolean; mythical:boolean; ultraBeast:boolean; paradox:boolean };
type WizardConfig = {
  generations:number[]; types:string[]; specialSections:SpecialSections;
  showDexNumber:boolean; showType:boolean; spellingHelp:boolean; shadows:boolean|null;
  sortOrder:"RANDOM"|"POKEDEX"|"TYPE"; durationMinutes:number; customMinutes:string;
  mode:"SOLO"|"SHARED"|"INDIVIDUAL";
};
type ActiveSession = {
  id:string; ranking_id:string; game_mode:string; status:string; config:Record<string,unknown>;
  catalog_species_ids:number[]; special_species_ids:Record<string,number[]>;
  duration_seconds:number; started_at:string|null; deadline_at:string|null;
  paused_at:string|null; remaining_seconds:number|null; paused_total_seconds:number;
};
type ResultSnapshot = Record<string,unknown>;

const defaults:WizardConfig = {
  generations:[1,2,3,4,5,6,7,8,9],types:[],
  specialSections:{mega:false,legendary:false,mythical:false,ultraBeast:false,paradox:false},
  showDexNumber:false,showType:false,spellingHelp:true,shadows:null,
  sortOrder:"RANDOM",durationMinutes:30,customMinutes:"",mode:"SOLO",
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
  const canStart=catalogReady && config.mode==="SOLO" && config.shadows!==null && mainSpecies.length>0 &&
    (config.durationMinutes!==0 || (Number(config.customMinutes)>=1 && Number(config.customMinutes)<=1440));
  const start=()=>{setError("");startTransition(async()=>{try{await onStart({...config,durationMinutes:config.durationMinutes===0?Number(config.customMinutes):config.durationMinutes});}catch(e){setError(e instanceof Error?e.message:"Non è stato possibile avviare la partita.");}});};

  return (
    <section className="pokemon-nae-wizard">
      <header className="pokemon-favourite-heading">
        <div><span className="pokemon-page-eyebrow">RENQD × POKÉMON</span><h1>Name ’Em All</h1><p>Configura il tuo Pokédex e prova a riconoscere tutte le specie selezionate.</p></div>
        <span className="pokemon-favourite-counter">PASSAGGIO {step+1} / 7</span>
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
        <div className="pokemon-nae-type-grid">{POKEMON_TYPES.map(type=><button type="button" key={type} onClick={()=>toggleType(type)} className={config.types.includes(type)?"is-selected":""}>{POKEMON_TYPE_LABELS[type]}</button>)}</div>
        <div className="pokemon-nae-inline-actions"><button type="button" onClick={()=>update({generations:[1,2,3,4,5,6,7,8,9]})}>Tutte le generazioni</button><button type="button" onClick={()=>update({types:[]})}>Rimuovi filtro tipi</button></div>
      </section>}

      {step===1&&<section className="pokemon-nae-wizard-panel">
        <span className="pokemon-page-eyebrow">02 · SEZIONI SPECIALI</span><h2>Vuoi esplorare anche le forme speciali?</h2>
        <p className="pokemon-nae-help">Le sezioni mostrano soltanto specie già incluse nel catalogo principale. Scoprire la specie sblocca le rappresentazioni associate senza assegnare punti aggiuntivi.</p>
        <div className="pokemon-nae-special-grid">{(Object.keys(specialLabels) as (keyof SpecialSections)[]).map(key=><label key={key} className={"pokemon-nae-option"+(config.specialSections[key]?" is-selected":"")+(counts[key]===0?" is-disabled":"")}>
          <input type="checkbox" checked={config.specialSections[key]} disabled={counts[key]===0} onChange={()=>toggleSpecial(key)}/>
          <span><strong>{specialLabels[key]}</strong><small>{counts[key]} specie disponibili</small></span><span className="pokemon-nae-option-check"><Check size={14}/></span>
        </label>)}</div>
      </section>}

      {step===2&&<section className="pokemon-nae-wizard-panel">
        <span className="pokemon-page-eyebrow">03 · DIFFICOLTÀ</span><h2>Imposta il livello di aiuto.</h2>
        <p className="pokemon-nae-help">Le impostazioni suggerite nascondono numero Pokédex e tipo, mantenendo attivo l&apos;aiuto ortografico.</p>
        <div className="pokemon-nae-toggle-list">
          <label><span><strong>Numero Pokédex</strong><small>Mostra il numero nazionale nella griglia</small></span><input type="checkbox" checked={config.showDexNumber} onChange={e=>update({showDexNumber:e.target.checked})}/></label>
          <label><span><strong>Tipo Pokémon</strong><small>Mostra i tipi durante la partita</small></span><input type="checkbox" checked={config.showType} onChange={e=>update({showType:e.target.checked})}/></label>
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
          <button type="button" onClick={()=>update({sortOrder:"RANDOM"})} className={config.sortOrder==="RANDOM"?"is-selected":""}><Sparkles size={19}/><strong>Casuale</strong><small>Ordine diverso e imprevedibile</small><em>Predefinito</em></button>
          <button type="button" onClick={()=>update({sortOrder:"POKEDEX"})} className={config.sortOrder==="POKEDEX"?"is-selected":""}><Grid3X3 size={19}/><strong>Numero Pokédex</strong><small>Ordine crescente nazionale</small></button>
          <button type="button" onClick={()=>update({sortOrder:"TYPE"})} className={config.sortOrder==="TYPE"?"is-selected":""}><ChevronDown size={19}/><strong>Per tipo</strong><small>Specie raggruppate per tipo</small></button>
        </div>
      </section>}

      {step===4&&<section className="pokemon-nae-wizard-panel">
        <span className="pokemon-page-eyebrow">05 · DURATA</span><h2>Quanto tempo hai?</h2>
        <div className="pokemon-nae-duration-grid">{[30,60,90].map(value=><button type="button" key={value} onClick={()=>update({durationMinutes:value})} className={config.durationMinutes===value?"is-selected":""}><strong>{value}</strong><small>minuti</small></button>)}<button type="button" onClick={()=>update({durationMinutes:0})} className={config.durationMinutes===0?"is-selected":""}><strong>Custom</strong><small>personalizzata</small></button></div>
        {config.durationMinutes===0&&<label className="pokemon-nae-custom-duration">Durata in minuti<input type="number" min="1" max="1440" value={config.customMinutes} onChange={e=>update({customMinutes:e.target.value})} placeholder="Es. 45"/></label>}
      </section>}

      {step===5&&<section className="pokemon-nae-wizard-panel">
        <span className="pokemon-page-eyebrow">06 · MODALITÀ</span><h2>Come vuoi giocare?</h2>
        <div className="pokemon-nae-mode-grid">
          <button type="button" onClick={()=>update({mode:"SOLO"})} className={config.mode==="SOLO"?"is-selected":""}><strong>Solo</strong><small>Il tuo Pokédex, il tuo tempo</small><span className="pokemon-nae-mode-tag">Disponibile</span></button>
          <button type="button" disabled className="is-disabled"><strong>Multiplayer condiviso</strong><small>Un unico catalogo per tutta la squadra</small><span className="pokemon-nae-mode-tag">Motore multiplayer in completamento</span></button>
          <button type="button" disabled className="is-disabled"><strong>Multiplayer individuale</strong><small>Stesso catalogo, progressi personali</small><span className="pokemon-nae-mode-tag">Motore multiplayer in completamento</span></button>
        </div>
      </section>}

      {step===6&&<section className="pokemon-nae-wizard-panel">
        <span className="pokemon-page-eyebrow">07 · RIEPILOGO E AVVIO</span><h2>Pronto a iniziare?</h2>
        <div className="pokemon-nae-summary">
          <div><span>Catalogo principale</span><strong>{mainSpecies.length.toLocaleString("it-IT")} specie</strong></div>
          <div><span>Generazioni</span><strong>{config.generations.map(g=>GENERATION_LABELS[g-1]).join(", ")}</strong></div>
          <div><span>Tipi</span><strong>{config.types.length?config.types.map(t=>POKEMON_TYPE_LABELS[t]).join(", "):"Tutti"}</strong></div>
          <div><span>Sezioni speciali</span><strong>{(Object.keys(specialLabels) as (keyof SpecialSections)[]).filter(k=>config.specialSections[k]).map(k=>specialLabels[k]).join(", ")||"Nessuna"}</strong></div>
          <div><span>Difficoltà</span><strong>{config.showDexNumber?"Numero Pokédex visibile":"Numero nascosto"} · {config.showType?"Tipo visibile":"Tipo nascosto"}</strong></div>
          <div><span>Aiuto ortografico</span><strong>{config.spellingHelp?"Attivo":"Disattivo"}</strong></div>
          <div><span>Shadows</span><strong>{config.shadows?"Silhouette":"Poké Ball"}</strong></div>
          <div><span>Ordinamento</span><strong>{config.sortOrder==="RANDOM"?"Casuale":config.sortOrder==="POKEDEX"?"Numero Pokédex":"Per tipo"}</strong></div>
          <div><span>Durata</span><strong>{config.durationMinutes===0?config.customMinutes:config.durationMinutes} minuti</strong></div>
          <div><span>Modalità</span><strong>Solo</strong></div>
        </div>
        {!catalogReady&&<p className="pokemon-nae-error">Il catalogo server è in sincronizzazione. L&apos;avvio si abiliterà al termine della verifica.</p>}
        {catalogReady&&!canStart&&<p className="pokemon-nae-error">Completa la selezione di Shadows e verifica la durata prima di iniziare.</p>}
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
function scoreMatch(species:PokemonSpecies,query:string) {
  const q=normalizePokemonName(query);
  const names=[species.name,species.nameEn,species.slug,...species.aliases].map(normalizePokemonName);
  return names.some(n=>n===q)?0:names.some(n=>n.startsWith(q))?1:names.some(n=>n.includes(q))?2:3;
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
  const [message,setMessage]=useState("");
  const [pending,setPending]=useState(false);
  const [deadline,setDeadline]=useState(session.deadline_at?new Date(session.deadline_at).getTime():0);
  const [remaining,setRemaining]=useState(session.status==="PAUSED"?(session.remaining_seconds??0):(session.remaining_seconds??session.duration_seconds));
  const [paused,setPaused]=useState(session.status==="PAUSED");
  const [pauseOverlay,setPauseOverlay]=useState(session.status==="PAUSED");
  const [confirmExit,setConfirmExit]=useState(false);
  const [activeSection,setActiveSection]=useState("gen-1");
  const [selected,setSelected]=useState<PokemonSpecies|null>(null);
  const [hint,setHint]=useState<{nameLength:number;revealedPrefix:string;hintCount:number}|null>(null);
  const [showSuggestions,setShowSuggestions]=useState(false);
  const [isFinishing,setIsFinishing]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);
  const config=session.config as WizardConfig;
  const species=session.catalog_species_ids.map(id=>catalog.species.find(item=>item.id===id)).filter((item):item is PokemonSpecies=>Boolean(item));
  const sections=useMemo(()=>[
    ...config.generations.map(g=>({id:"gen-"+g,label:"Gen. "+GENERATION_LABELS[g-1],species:species.filter(s=>s.generation===g)})),
    ...Object.entries(session.special_species_ids??{}).filter(([,ids])=>Array.isArray(ids)&&ids.length>0).map(([key,ids])=>({
      id:"special-"+key,label:specialLabels[key as keyof SpecialSections]??key,
      species:species.filter(s=>(ids as number[]).includes(s.id)),
    })),
  ],[config.generations,session.special_species_ids,species]);
  const suggestions=useMemo(()=>query.trim().length>0?species
    .map(item=>({item,score:scoreMatch(item,query)})).filter(x=>x.score<3)
    .sort((a,b)=>a.score-b.score||a.item.id-b.item.id).slice(0,5).map(x=>x.item):[],[species,query]);
  const percent=species.length?Math.round(found.size/species.length*100):0;

  useEffect(()=>{
    if(paused||isFinishing)return;
    const id=window.setInterval(()=>setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000))),250);
    return ()=>window.clearInterval(id);
  },[deadline,paused,isFinishing]);

  const finish=useCallback(async(reason:string)=>{
    if(isFinishing)return;
    setIsFinishing(true);
    const result=await finishNameEmAllAction(session.id,reason);
    if(!result.ok){setMessage(result.error??"Non è stato possibile salvare il risultato.");setIsFinishing(false);return;}
    router.refresh();
  },[isFinishing,router,session.id]);

  useEffect(()=>{if(remaining<=0&&!paused&&!isFinishing){const id=window.setTimeout(()=>{void finish("TIMER_EXPIRED");},0);return()=>window.clearTimeout(id);}},[remaining,paused,isFinishing,finish]);

  const submit=async(answer:string)=>{
    if(!answer.trim()||pending||paused)return;
    setPending(true);setConfirmed(false);setMessage("");
    const result=await submitNameEmAllAnswerAction(session.id,answer);
    setPending(false);
    if(!result.ok){setMessage(result.error??"Risposta non registrata.");return;}
    const data=result.data??{};
    if(data.status==="CORRECT"&&typeof data.speciesId==="number"){
      setFound(current=>new Set(current).add(data.speciesId as number));
      setConfirmed(true);setMessage("Pokémon scoperto!");
      if(data.completed===true)void finish("CATALOG_COMPLETE");
    }else if(data.status==="ALREADY_FOUND"){
      setMessage("Hai già scoperto questo Pokémon!");
    }else if(data.status==="INCORRECT"){
      setMessage("Pokémon non riconosciuto.");
    }else if(data.status==="TIME_EXPIRED"){
      setMessage("Tempo scaduto.");void finish("TIMER_EXPIRED");
    }else if(data.status==="PAUSED"){
      setMessage("La partita è in pausa.");
    }
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
    setDeadline(new Date(date).getTime());setPaused(false);setPauseOverlay(false);
  };
  const revealHint=async()=>{
    if(!selected)return;
    const result=await hintNameEmAllAction(session.id,selected.id);
    if(!result.ok){setMessage(result.error??"Aiuto non disponibile.");return;}
    setHint({
      nameLength:Number(result.data?.nameLength??0),
      revealedPrefix:String(result.data?.revealedPrefix??""),
      hintCount:Number(result.data?.hintCount??0),
    });
  };
  const openSection=(id:string)=>{
    setActiveSection(id);
    document.getElementById("nae-"+id)?.scrollIntoView({behavior:"smooth",block:"start"});
  };
  const chooseSuggestion=(item:PokemonSpecies)=>{setShowSuggestions(false);void submit(item.name);};
  const discoveredName=(id:number)=>found.has(id);
  const selectedForms=selected?.forms??[];

  return (
    <section className="pokemon-nae-game">
      <header className="pokemon-nae-game-header">
        <div><span className="pokemon-page-eyebrow">RENQD × POKÉMON · IN PARTITA</span><h1>Name ’Em All</h1><p>Riconosci le specie del tuo catalogo. Le forme associate si sbloccano senza punti aggiuntivi.</p></div>
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>void togglePause()} disabled={paused}><Pause size={15}/> Pausa</button>
      </header>
      <div className="pokemon-nae-hud">
        <div className="pokemon-nae-hud-top">
          <div><small>TEMPO RIMANENTE</small><strong className={remaining<60?"is-urgent":""}>{formatTime(remaining)}</strong></div>
          <div><small>POKÉMON TROVATI</small><strong>{found.size.toLocaleString("it-IT")} / {species.length.toLocaleString("it-IT")}</strong></div>
          <div><small>COMPLETAMENTO</small><strong>{percent}%</strong></div>
        </div>
        <div className="pokemon-nae-progress"><span style={{width:percent+"%"}}/></div>
      </div>
      <nav className="pokemon-nae-section-nav" aria-label="Navigazione catalogo">
        {sections.map(section=><button type="button" key={section.id} onClick={()=>openSection(section.id)} className={activeSection===section.id?"is-active":""}>{section.label}<small>{section.species.filter(s=>found.has(s.id)).length}/{section.species.length}</small></button>)}
      </nav>
      <div className="pokemon-nae-search-wrap">
        <label className="pokemon-nae-search"><Search size={17}/><input ref={inputRef} value={query} onChange={e=>{setQuery(e.target.value);setConfirmed(false);setMessage("");setShowSuggestions(true);}} onFocus={()=>setShowSuggestions(true)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();setShowSuggestions(false);void submit(query);}}} placeholder="Scrivi il nome di un Pokémon…" disabled={paused||isFinishing}/>{pending&&<LoaderCircle size={15}/>}</label>
        {showSuggestions&&query.trim().length>0&&<div className="pokemon-nae-suggestions">
          {suggestions.map(item=><button type="button" key={item.id} onClick={()=>chooseSuggestion(item)}>
            <img src={item.spriteUrl} alt="" width={34} height={34}/><span><strong>{item.name}</strong><small>#{item.id.toString().padStart(4,"0")} · Gen. {GENERATION_LABELS[item.generation-1]}</small></span><em className={found.has(item.id)?"is-found":""}>{found.has(item.id)?"Scoperto":"Da scoprire"}</em>
          </button>)}
          {suggestions.length===0&&<p>Nessun Pokémon trovato. Controlla il nome o prova un altro termine</p>}
        </div>}
        {message&&<p className={"pokemon-nae-feedback"+(confirmed?" is-correct":"")} role="status">{message}</p>}
      </div>
      <div className="pokemon-nae-catalog">
        {sections.map(section=><section id={"nae-"+section.id} className="pokemon-nae-catalog-section" key={section.id}>
          <header><div><span className="pokemon-page-eyebrow">{section.id.startsWith("gen-")?"POKÉDEX NAZIONALE":"SEZIONE SPECIALE"}</span><h2>{section.label}</h2></div><span>{section.species.filter(s=>found.has(s.id)).length} / {section.species.length}</span></header>
          <div className="pokemon-nae-cell-grid">
            {(section.id==="special-mega"
              ? section.species.flatMap(item=>item.megaForms.map(form=>({species:item,form})))
              : section.species.map(item=>({species:item,form:null}))).map(({species:item,form})=>{
              const isFound=found.has(item.id);
              const artwork=form?.spriteUrl??item.spriteUrl;
              const displayName=form ? item.name+" "+form.label : item.name;
              return <button type="button" key={item.id+"-"+(form?.id??"base")} onClick={()=>{setSelected(item);setHint(null);}} className={"pokemon-nae-cell"+(isFound?" is-found":"")}>
                <span className="pokemon-nae-cell-art">{isFound||config.shadows?<img src={artwork} alt="" loading="lazy" style={{filter:isFound?"none":"brightness(0) saturate(0) opacity(.55)"}}/>:<b className="pokemon-nae-pokeball">◉</b>}</span>
                {isFound?<strong>{displayName}</strong>:<strong className="is-hidden">{config.shadows?"???":"Pokémon"}</strong>}
                {config.showDexNumber&&<small>#{item.id.toString().padStart(4,"0")}</small>}
                {config.showType&&<small>{item.types.map(t=>POKEMON_TYPE_LABELS[t]??t).join(" · ")}</small>}
                {(item.forms.length>0||item.isLegendary||item.isMythical||item.isUltraBeast||item.isParadox)&&<span className="pokemon-nae-cell-indicators">{item.forms.length>0?"◇":""}{item.isLegendary?"★":""}{item.isMythical?"✦":""}{item.isUltraBeast?"◈":""}{item.isParadox?"⌁":""}</span>}
              </button>;
            })}
          </div>
        </section>)}
      </div>

      {selected&&<div className="pokemon-nae-detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
        <aside className="pokemon-nae-detail" role="dialog" aria-modal="true" aria-label={"Dettaglio "+selected.name}>
          <header><span className="pokemon-page-eyebrow">SCHEDA POKÉMON</span><button type="button" onClick={()=>setSelected(null)} aria-label="Chiudi"><X size={18}/></button></header>
          <div className="pokemon-nae-detail-hero"><img src={selected.artworkUrl} alt={selected.name}/><div><h2>{selected.name}</h2><small>#{selected.id.toString().padStart(4,"0")} · Generazione {GENERATION_LABELS[selected.generation-1]}</small><p>{selected.types.map(t=>POKEMON_TYPE_LABELS[t]??t).join(" · ")}</p></div></div>
          <div className="pokemon-nae-detail-stats"><span>{discoveredName(selected.id)?"Scoperto":"Da scoprire"}</span><span>{selectedForms.length} forme associate</span></div>
          {selectedForms.length>0&&<div className="pokemon-nae-forms"><strong>Forme associate</strong><div>{selectedForms.map(form=><div key={form.id}><img src={form.spriteUrl} alt=""/><span>{form.label||form.slug}</span></div>)}</div></div>}
          {config.spellingHelp&&!discoveredName(selected.id)&&<div className="pokemon-nae-hint-box"><strong>Aiuto ortografico</strong><p>Nome di {selected.name.length} caratteri. Rivela progressivamente le lettere senza mostrare il nome completo.</p>{hint&&<div className="pokemon-nae-hint-reveal"><span>{hint.revealedPrefix}</span><span>{Array.from({length:Math.max(0,hint.nameLength-hint.revealedPrefix.length)},()=> "•").join(" ")}</span></div>}<button type="button" onClick={()=>void revealHint()}><HelpCircle size={14}/> Rivela una lettera</button></div>}
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>setSelected(null)}>Chiudi scheda</button>
      </aside>
      </div>}

      {pauseOverlay&&<div className="pokemon-nae-pause-backdrop"><section className="pokemon-nae-pause-card">
        <span className="pokemon-page-eyebrow">PARTITA IN PAUSA</span><h2>Riprendi quando vuoi.</h2><p>Il timer è fermo e la griglia non è consultabile durante la pausa.</p>
        <strong>{formatTime(remaining)}</strong>
        <button type="button" className="pokemon-favourite-primary" onClick={()=>void resume()}><Play size={15}/> Riprendi</button>
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirmExit(true)}>Salva e termina</button>
      </section></div>}
      {confirmExit&&<div className="pokemon-nae-pause-backdrop" role="presentation">
        <section className="pokemon-nae-pause-card" role="alertdialog" aria-modal="true" aria-labelledby="pokemon-nae-exit-title">
          <span className="pokemon-page-eyebrow">CONFERMA USCITA</span>
          <h2 id="pokemon-nae-exit-title">Salvare il risultato parziale?</h2>
          <p>La partita terminerà e il risultato verrà conservato nel tuo profilo Renqd.</p>
          <button type="button" className="pokemon-favourite-primary" onClick={()=>{setConfirmExit(false);void finish("USER_EXIT");}}>Salva e termina</button>
          <button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirmExit(false)}>Continua a giocare</button>
        </section>
      </div>}
    </section>
  );
}

function ResultView({result,onNewGame,catalog}:{result:ResultSnapshot;onNewGame?:()=>void;catalog?:PokemonCatalog|null}) {
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
  const finishLabels:Record<string,string>={TIMER_EXPIRED:"Timer scaduto",CATALOG_COMPLETE:"Pokédex completato",USER_EXIT:"Terminata dal giocatore",HOST_TERMINATED:"Terminata dall’host"};
  const exportWidth=1080;
  const exportHeight=exportSize==="VERTICAL"?1350:1080;
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
    <span className="pokemon-page-eyebrow">RENQD × POKÉMON · RISULTATO</span><h1>La tua partita.</h1>
    <div className={"pokemon-nae-result-card medal-"+medal} style={{background:"linear-gradient(145deg,"+(colors[medal]??colors.eevee)+"30,#fffdfa 72%)"}}>
      <div className="pokemon-nae-result-artwork"><img src={medalArt} alt="" crossOrigin="anonymous"/></div>
      <div className="pokemon-nae-result-medal" style={{borderColor:colors[medal]??colors.eevee,background:"linear-gradient(145deg,#fffdf8,"+(colors[medal]??colors.eevee)+"22)"}}>
        <img src={medalArt} alt="" crossOrigin="anonymous"/>
      </div>
      <span className="pokemon-page-eyebrow">LIVELLO OTTENUTO</span><h2>{level}</h2>
      <strong className="pokemon-nae-result-score">{String(result.score??result.foundCount??0)} <small>Pokémon</small></strong>
      <div className="pokemon-nae-result-stats">
        <div><strong>{String(result.completion??0)}%</strong><small>Completamento</small></div>
        <div><strong>{String(result.accuracy??0)}%</strong><small>Precisione</small></div>
        <div><strong>{formatTime(Number(result.elapsedSeconds??0))}</strong><small>Tempo effettivo</small></div>
        <div><strong>{String(result.errorsUnique??0)}</strong><small>Errori unici</small></div>
        <div><strong>{String(result.assistedCount??0)}</strong><small>Assistiti</small></div>
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
        <div><span>Pokémon trovati</span><strong>{String(result.foundCount??result.score??0)} / {String(result.catalogCount??0)}</strong></div>
        <div><span>Generazioni completate</span><strong>{String(result.generationsCompleted??0)}</strong></div>
        <div><span>Conclusione</span><strong>{finishLabels[String(result.finishReason??"")]??"Risultato salvato"}</strong></div>
      </div>}
      {activeTab==="stats"&&<div className="pokemon-nae-result-detail-grid">
        {[["Completamento",String(result.completion??0)+"%"],["Precisione",String(result.accuracy??0)+"%"],["Tempo effettivo",formatTime(Number(result.elapsedSeconds??0))],["Errori unici",String(result.errorsUnique??0)],["Pokémon assistiti",String(result.assistedCount??0)],["Indice di prestazione",String(result.performanceIndex??0)],["Generazioni completate",String(result.generationsCompleted??0)],["Modalità",String(result.mode??"Solo")]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}
      </div>}
      {activeTab==="pokedex"&&<div className="pokemon-nae-result-pokedex">
        {!catalog?<p>Caricamento del Pokédex…</p>:!discovered.length?<p>Il dettaglio delle specie scoperte non è disponibile in questo snapshot.</p>:discovered.map(item=><div key={item.id}><img src={item.spriteUrl} alt="" loading="lazy"/><span><strong>{item.name}</strong><small>#{String(item.id).padStart(4,"0")} · Gen. {GENERATION_LABELS[item.generation-1]}</small></span></div>)}
      </div>}
      {activeTab==="leaderboard"&&<div className="pokemon-nae-result-leaderboard">
        {leaderboard.map((entry,index)=><div key={String(entry.userId??index)}><span>{String(entry.rankPosition??index+1).padStart(2,"0")}</span><div className="pokemon-nae-leader-avatar">{typeof entry.avatarUrl==="string"&&entry.avatarUrl?<img src={entry.avatarUrl} alt=""/>:String(entry.displayName??entry.username??"?").slice(0,1).toUpperCase()}</div><strong>{String(entry.displayName??entry.username??"Allenatore")}</strong><small>{String(entry.foundCount??0)} Pokémon · {String(entry.accuracy??0)}%</small></div>)}
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
      <div ref={exportRef} className={"pokemon-nae-export-card "+(exportSize==="SQUARE"?"is-square":"is-vertical")} style={{width:exportWidth,height:exportHeight}}>
        <div className="pokemon-nae-export-top"><img src="/brand/renqd-logo.svg" alt="Renqd" crossOrigin="anonymous"/><span>NAME ’EM ALL</span></div>
        <div className="pokemon-nae-export-main">
          <div className="pokemon-nae-export-medal" style={{background:colors[medal]??colors.eevee}}><img src={medalArt} alt="" crossOrigin="anonymous"/></div>
          <span>IL TUO LIVELLO</span><h2>{level}</h2><strong>{String(result.score??result.foundCount??0)} Pokémon</strong>
          <div className="pokemon-nae-export-stats"><span><b>{String(result.completion??0)}%</b>Completamento</span><span><b>{String(result.accuracy??0)}%</b>Precisione</span><span><b>{formatTime(Number(result.elapsedSeconds??0))}</b>Tempo effettivo</span></div>
          {result.perfect===true&&<em>MAESTRO POKÉMON · PARTITA PERFETTA</em>}
        </div>
        {exportMode==="FULL"&&leaderboard.length>0&&<div className="pokemon-nae-export-leaderboard"><span>CLASSIFICA COMPLETA</span>{leaderboard.slice(0,8).map((entry,index)=><div key={String(entry.userId??index)}><b>{String(entry.rankPosition??index+1)}</b><strong>{String(entry.displayName??entry.username??"Allenatore")}</strong><small>{String(entry.foundCount??0)} Pokémon</small></div>)}</div>}
        <div className="pokemon-nae-export-footer">RENQD · NAME ’EM ALL</div>
      </div>
    </div>
    {onNewGame&&<button type="button" className="pokemon-favourite-primary" onClick={onNewGame}><Play size={15}/> Nuova partita</button>}
  </section>;
}

export function NameEmAllExperience({activeSession,initialDiscoveries=[],latestResult=null}:{
  activeSession:ActiveSession|null;initialDiscoveries?:number[];latestResult?:ResultSnapshot|null;
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
    const result=await createNameEmAllSoloAction({
      generations:config.generations,types:config.types,specialSections:config.specialSections,
      showDexNumber:config.showDexNumber,showType:config.showType,spellingHelp:config.spellingHelp,
      shadows:config.shadows,sortOrder:config.sortOrder,durationMinutes:config.durationMinutes,mode:"SOLO",
    });
    if(!result.ok)throw new Error(result.error??"Avvio non riuscito.");
    router.refresh();
  };
  if(!catalog)return <div className="pokemon-favourite-loading"><LoaderCircle size={18}/> Caricamento Pokédex… {error}</div>;
  if(activeSession)return <Game catalog={catalog} session={activeSession} initialDiscoveries={initialDiscoveries}/>;
  if(latestResult&&!showWizard)return <ResultView result={latestResult} catalog={catalog} onNewGame={()=>setShowWizard(true)}/>;
  return <><p className={catalogReady?"pokemon-catalog-sync is-ready":"pokemon-catalog-sync"}>{catalogReady?<CheckCircle2 size={14}/>:<LoaderCircle size={14}/>} {catalogReady?"Catalogo server verificato · "+catalog.speciesCount+" specie":syncError||"Verifica del catalogo server in corso…"}</p><Wizard catalog={catalog} onStart={start} catalogReady={catalogReady}/></>;
}


export function PokemonNameEmAllPublicResultView({result,ownerName,social}:{result:ResultSnapshot;ownerName:string;social?:{rankingId:string;initialLiked:boolean;initialLikeCount:number;initialComments:import("@/components/pokemon/result-social").PokemonResultComment[];currentUserId:string;canLike:boolean}}) {
  const [catalog,setCatalog]=useState<PokemonCatalog|null>(null);
  useEffect(()=>{let alive=true;fetch("/data/pokemon/catalog.json").then(response=>response.json()).then((data:PokemonCatalog)=>{if(alive)setCatalog(data);}).catch(()=>{});return()=>{alive=false;};},[]);
  return <main className="pokemon-page pokemon-nae-result-public">
    <header className="pokemon-favourite-heading">
      <div><span className="pokemon-page-eyebrow">RENQD × POKÉMON · NAME ’EM ALL</span><h1>Risultato di {ownerName}</h1><p>Una partita Name ’Em All registrata nel profilo Renqd.</p></div>
    </header>
    <ResultView result={result} catalog={catalog}/>
    {social&&<PokemonResultSocial {...social}/>}
  </main>;
}
