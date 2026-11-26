"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Crown, HelpCircle, LoaderCircle, LogOut, PauseCircle, X, UserX, Settings, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { playPokemonSound, preparePokemonAudio } from "@/lib/pokemon/sounds";
import { usePokemonSoundPreference } from "@/components/pokemon/use-pokemon-sound-preference";
import { PokemonCatalog, PokemonSpecies, normalizePokemonName, findExactPokemonMatch, isAmbiguousPokemonName } from "@/lib/pokemon/catalog";
import { useNameEmAllSubmissionQueue } from "@/components/pokemon/use-name-em-all-submission-queue";
import { expelNameEmAllParticipantAction, finishNameEmAllMultiplayerAction, heartbeatNameEmAllAction, hintNameEmAllMultiplayerAction, leaveNameEmAllAction, submitNameEmAllMultiplayerAnswerAction } from "@/app/(platform)/pokemon/name-em-all/actions";
import type { NameEmAllParticipant } from "@/components/pokemon/multiplayer-lobby";

type MultiplayerSession={
  id:string;owner_id:string;host_id:string|null;game_mode:string;status:string;started_at:string|null;
  config:Record<string,unknown>;catalog_species_ids:number[];special_species_ids:Record<string,number[]>;
  duration_seconds:number;deadline_at:string|null;remaining_seconds:number|null;paused_total_seconds:number;
};

function formatClock(seconds:number){const value=Math.max(0,seconds);return Math.floor(value/60).toString().padStart(2,"0")+":"+Math.floor(value%60).toString().padStart(2,"0");}

const specialLabels:Record<string,string>={mega:"Mega",legendary:"Leggendari",mythical:"Mitici",ultraBeast:"Ultracreature",paradox:"Paradosso"};

export function PokemonNameEmAllMultiplayerGame({
  catalog,session:initialSession,initialDiscoveries,initialParticipants,initialDiscoverers,currentUserId,currentUserRole,
}:{
  catalog:PokemonCatalog;session:MultiplayerSession;initialDiscoveries:number[];
  initialParticipants:NameEmAllParticipant[];initialDiscoverers:Record<string,string>;currentUserId:string;currentUserRole:string;
}) {
  const router=useRouter();
  const [session,setSession]=useState(initialSession);
  const [participants,setParticipants]=useState(initialParticipants);
  const [leaderboardOpen,setLeaderboardOpen]=useState(false);
  const [found,setFound]=useState<Set<number>>(new Set(initialDiscoveries));
  const [discoveryById,setDiscoveryById]=useState<Record<string,string>>(initialDiscoverers);
  const previousFoundRef=useRef<Set<number>>(new Set(initialDiscoveries));
  const previousCompletedGenerationsRef=useRef<string|null>(null);
  const [recentlyFoundId,setRecentlyFoundId]=useState<number|null>(null);
  const [generationCelebration,setGenerationCelebration]=useState<number|null>(null);
  const [activeSection,setActiveSection]=useState("gen-"+String(Array.isArray(initialSession.config.generations)?initialSession.config.generations[0]??1:1));
  const [query,setQuery]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [collapsedGenerations,setCollapsedGenerations]=useState<Set<number>>(new Set());
  const inputRef=useRef<HTMLInputElement>(null);
  const [selected,setSelected]=useState<PokemonSpecies|null>(null);
  const [hint,setHint]=useState<{nameLength:number;revealedPrefix:string;hintCount:number}|null>(null);
  const [countdown,setCountdown]=useState(0);
  const [remaining,setRemaining]=useState(initialSession.status==="PAUSED"?(initialSession.remaining_seconds??0):(initialSession.remaining_seconds??initialSession.duration_seconds));
  const [deadline,setDeadline]=useState(initialSession.deadline_at?new Date(initialSession.deadline_at).getTime():0);
  const [isFinishing,setIsFinishing]=useState(false);
  const [playerCompleted,setPlayerCompleted]=useState(Boolean(initialParticipants.find(p=>p.userId===currentUserId)?.completed));
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [confirmExit,setConfirmExit]=useState(false);
  const [confirmTerminate,setConfirmTerminate]=useState(false);
  const shared=session.game_mode==="COLLABORATIVE";
  const isHost=session.host_id===currentUserId;
  const isPlatformOwner=currentUserRole==="OWNER";
  const config=session.config as Record<string,unknown>;
  const unlimited=session.duration_seconds===0;
  const [settingsOpen,setSettingsOpen]=useState(false);
  const {enabled:soundEnabled,setEnabled:setSoundEnabled}=usePokemonSoundPreference();
  const [visual,setVisual]=useState({shadows:config.shadows===true});
  const [sortOrder,setSortOrder]=useState(config.sortOrder==="POKEDEX"||config.sortOrder==="TYPE"?config.sortOrder:"RANDOM");
  const [randomOrder,setRandomOrder]=useState<number[]|null>(null);
  const spellingHelp=config.spellingHelp!==false;
  const baseSpecies=useMemo(()=>session.catalog_species_ids.map(id=>catalog.species.find(item=>item.id===id)).filter((item):item is PokemonSpecies=>Boolean(item)),[catalog,session.catalog_species_ids]);
  const species=useMemo(()=>{
    if(sortOrder==="POKEDEX")return [...baseSpecies].sort((a,b)=>a.id-b.id);
    if(sortOrder==="TYPE")return [...baseSpecies].sort((a,b)=>(a.types[0]??"").localeCompare(b.types[0]??"")||a.id-b.id);
    if(randomOrder){const rank=new Map(randomOrder.map((id,index)=>[id,index]));return [...baseSpecies].sort((a,b)=>(rank.get(a.id)??0)-(rank.get(b.id)??0));}
    return baseSpecies;
  },[baseSpecies,sortOrder,randomOrder]);
  const generations=Array.isArray(config.generations)?(config.generations as number[]):[...new Set(baseSpecies.map(item=>item.generation))];
  const sections=[
    ...generations.map(generation=>({id:"gen-"+generation,label:"Gen. "+(["I","II","III","IV","V","VI","VII","VIII","IX"][generation-1]??generation),species:species.filter(item=>item.generation===generation)})),
    ...Object.entries(session.special_species_ids??{}).filter(([,ids])=>Array.isArray(ids)&&ids.length>0).map(([key,ids])=>({id:"special-"+key,label:specialLabels[key]??key,species:species.filter(item=>ids.includes(item.id))})),
  ];
  const completedGenerations=generations.filter(generation=>{
    const items=baseSpecies.filter(item=>item.generation===generation);
    return items.length>0&&items.every(item=>found.has(item.id));
  });
  const completedGenerationKey=completedGenerations.join(",");
  const sectionIdsKey=sections.map(section=>section.id).join("|");
  const changeSort=(value:"RANDOM"|"POKEDEX"|"TYPE")=>{
    setSortOrder(value);
    if(value==="RANDOM")setRandomOrder([...species].sort(()=>Math.random()-.5).map(item=>item.id));
  };
  const normalizedQuery=normalizePokemonName(query);
  const exactMatch=useMemo(()=>findExactPokemonMatch(species,normalizedQuery),[species,normalizedQuery]);
  const exactMatchIsAmbiguous=Boolean(exactMatch&&isAmbiguousPokemonName(species,exactMatch,normalizedQuery));
  const percent=species.length?Math.round(found.size/species.length*100):0;

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
    if(previousCompletedGenerationsRef.current===null){previousCompletedGenerationsRef.current=completedGenerationKey;return;}
    const previous=new Set(previousCompletedGenerationsRef.current.split(",").map(Number).filter(value=>value>0));
    const newlyCompleted=completedGenerationKey.split(",").map(Number).find(generation=>generation>0&&!previous.has(generation));
    previousCompletedGenerationsRef.current=completedGenerationKey;
    if(newlyCompleted===undefined)return;
    setGenerationCelebration(newlyCompleted);
    setMessage("Generazione "+(["I","II","III","IV","V","VI","VII","VIII","IX"][newlyCompleted-1]??newlyCompleted)+" completata!");
    const timer=window.setTimeout(()=>setGenerationCelebration(null),1600);
    return()=>window.clearTimeout(timer);
  },[completedGenerationKey]);

  const openSection=(id:string)=>{
    setActiveSection(id);
    document.getElementById("nae-"+id)?.scrollIntoView({behavior:"smooth",block:"start"});
  };

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

  const finish=useCallback(async(reason:string)=>{
    if(isFinishing)return;
    setIsFinishing(true);setError("");
    const result=await finishNameEmAllMultiplayerAction(session.id,reason);
    if(!result.ok){setError(result.error??"Non è stato possibile salvare i risultati.");setIsFinishing(false);return;}
    router.refresh();
  },[isFinishing,router,session.id]);
  const processQueuedSubmission=useCallback(async(answer:string,optimisticSpecies:PokemonSpecies)=>{
    const result=await submitNameEmAllMultiplayerAnswerAction(session.id,answer);
    const data=result.data??{};
    const refocusInput=()=>window.requestAnimationFrame(()=>inputRef.current?.focus());
    if(!result.ok){
      setFound(current=>{const next=new Set(current);next.delete(optimisticSpecies.id);return next;});
      setConfirmed(false);setError(result.error??"Risposta non registrata.");refocusInput();return;
    }
    if(typeof data.speciesId==="number"&&["CORRECT","CATALOG_COMPLETE","PLAYER_COMPLETE","ALL_COMPLETED"].includes(String(data.status))){
      setFound(current=>new Set(current).add(Number(data.speciesId)));
      setConfirmed(true);setSelected(null);setHint(null);
      playPokemonSound("correct",soundEnabled);refocusInput();
    }
    if(data.status==="WRONG"){
      setFound(current=>{const next=new Set(current);next.delete(optimisticSpecies.id);return next;});
      setConfirmed(false);playPokemonSound("incorrect",soundEnabled);setMessage("Non è una risposta valida per questo catalogo.");refocusInput();return;
    }
    if(data.status==="ALREADY_FOUND"){
      if(typeof data.speciesId==="number")setFound(current=>new Set(current).add(Number(data.speciesId)));
      setQuery("");setConfirmed(false);refocusInput();
      const discovererId=shared&&typeof data.speciesId==="number"?discoveryById[String(data.speciesId)]:null;
      const discoverer=discovererId?participants.find(player=>player.userId===discovererId):null;
      const discovererName=typeof data.discoveredByName==="string"?data.discoveredByName:discoverer?.displayName;
      setMessage(shared?(discovererName?"Già indovinato da "+discovererName:"Questo Pokémon è già stato scoperto."):"Hai già scoperto questo Pokémon!");return;
    }
    if(data.status==="PAUSED"){
      setFound(current=>{const next=new Set(current);next.delete(optimisticSpecies.id);return next;});
      setSession(current=>({...current,status:"PAUSED"}));setMessage("La partita è in pausa.");return;
    }
    if(data.status==="TIME_EXPIRED"){
      setFound(current=>{const next=new Set(current);next.delete(optimisticSpecies.id);return next;});
      await finish("TIMER_EXPIRED");return;
    }
    if(data.status==="PLAYER_COMPLETE"){
      setConfirmed(true);playPokemonSound("complete",soundEnabled);setPlayerCompleted(true);setMessage("Hai completato il tuo catalogo. Attendi gli altri Allenatori.");return;
    }
    if(data.status==="CATALOG_COMPLETE"){
      setConfirmed(true);playPokemonSound("complete",soundEnabled);setMessage("Pokédex condiviso completato!");await finish("CATALOG_COMPLETE");return;
    }
    if(data.status==="ALL_COMPLETED"){
      setConfirmed(true);playPokemonSound("complete",soundEnabled);setPlayerCompleted(true);await finish("ALL_COMPLETED");return;
    }
    if(data.status==="CORRECT")setMessage("Corretto! "+String(data.name??""));
    if(data.status==="COUNTDOWN")setMessage("La partita sta per iniziare.");
    if(data.status==="FINISHED")router.refresh();
  },[session.id,soundEnabled,shared,discoveryById,participants,finish,router]);
  const {enqueue:enqueueSubmission,pending,queuedKeysRef}=useNameEmAllSubmissionQueue(processQueuedSubmission);
  const enqueuePokemonSubmission=useCallback((answer:string,item:PokemonSpecies)=>{
    if(playerCompleted||session.status!=="ACTIVE"||countdown>0||found.has(item.id)||queuedKeysRef.current.has(item.id))return;
    if(!enqueueSubmission(answer,item,item.id))return;
    preparePokemonAudio(soundEnabled);
    setFound(current=>new Set(current).add(item.id));
    setQuery("");setConfirmed(true);setMessage("Pokémon scoperto!");
    playPokemonSound("correct",soundEnabled);
  },[playerCompleted,session.status,countdown,found,queuedKeysRef,enqueueSubmission,soundEnabled]);

  const heartbeat=useCallback(async()=>{
    const result=await heartbeatNameEmAllAction(session.id);
    if(!result.ok){if(result.error?.includes("non attiva"))router.refresh();return;}
    const data=result.data??{};
    setSession(current=>({...current,status:String(data.status??current.status),host_id:typeof data.hostId==="string"?data.hostId:null,
      deadline_at:typeof data.deadlineAt==="string"?data.deadlineAt:null,
      remaining_seconds:Number(data.remainingSeconds??current.remaining_seconds??0)}));
    setRemaining(Number(data.remainingSeconds??0));
    setDeadline(data.deadlineAt?new Date(String(data.deadlineAt)).getTime():0);
  },[session.id,router]);

  const refreshLive=useCallback(async(client:ReturnType<typeof createClient>)=>{
    const [discoveriesResult,participantsResult,sessionResult]=await Promise.all([
      client.from("pokemon_name_em_all_discoveries").select("species_id,user_id,discovered_by,discovered_at").eq("session_id",session.id),
      client.from("pokemon_name_em_all_participants").select("user_id,is_ready,is_active,is_connected,completed_at,joined_at").eq("session_id",session.id).is("expelled_at",null).order("joined_at",{ascending:true}),
      client.from("pokemon_name_em_all_sessions").select("status,host_id,started_at,deadline_at,remaining_seconds").eq("id",session.id).maybeSingle(),
    ]);
    const rows=discoveriesResult.data??[];
    const myRows=rows.filter(row=>shared?row.user_id===null:row.user_id===currentUserId);
    const serverFound=new Set(myRows.map(row=>Number(row.species_id)));
    setFound(current=>{
      if(!pending)return serverFound;
      const merged=new Set(serverFound);
      current.forEach(id=>merged.add(id));
      return merged;
    });
    if(shared)setDiscoveryById(Object.fromEntries(rows.filter(row=>row.user_id===null&&row.discovered_by).map(row=>[String(row.species_id),String(row.discovered_by)])));
    const counts=new Map<string,number>();
    const lastDiscoveryAt=new Map<string,string>();
    for(const row of rows){
      const id=shared?String(row.discovered_by):String(row.user_id);
      counts.set(id,(counts.get(id)??0)+1);
      const timestamp=String(row.discovered_at??"");
      if(timestamp&&(!lastDiscoveryAt.has(id)||timestamp>lastDiscoveryAt.get(id)!))lastDiscoveryAt.set(id,timestamp);
    }
    const participantRows=participantsResult.data??[];
    const ids=participantRows.map(row=>row.user_id);
    const {data:profiles}=ids.length?await client.from("public_profiles").select("user_id,username,display_name,avatar_url").in("user_id",ids):{data:[]};
    const profileMap=new Map((profiles??[]).map(profile=>[profile.user_id,profile]));
    setParticipants(participantRows.map(row=>{
      const profile=profileMap.get(row.user_id);
      const old=initialParticipants.find(item=>item.userId===row.user_id);
      return {userId:row.user_id,username:profile?.username??old?.username??"",displayName:profile?.display_name??old?.displayName??"Allenatore",
        avatarUrl:old?.avatarUrl??null,isReady:Boolean(row.is_ready),isActive:Boolean(row.is_active),isConnected:Boolean(row.is_connected),
        completed:Boolean(row.completed_at),foundCount:counts.get(row.user_id)??0,rankPosition:old?.rankPosition??null,publicSlug:old?.publicSlug??null,
        lastDiscoveryAt:lastDiscoveryAt.get(row.user_id)??old?.lastDiscoveryAt??null};
    }));
    if(sessionResult.data){
      const live=sessionResult.data;
      setSession(current=>({...current,status:live.status,host_id:live.host_id,deadline_at:live.deadline_at,remaining_seconds:live.remaining_seconds}));
      setDeadline(live.deadline_at?new Date(live.deadline_at).getTime():0);
      setRemaining(Number(live.remaining_seconds??0));
      if(live.status==="COMPLETED")router.refresh();
    }
  },[session.id,shared,currentUserId,initialParticipants,router,pending]);

  useEffect(()=>{
    let alive=true;
    const client=createClient();
    const channel=client.channel("pokemon-name-em-all-"+session.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"pokemon_name_em_all_discoveries",filter:"session_id=eq."+session.id},()=>{if(alive)void refreshLive(client);})
      .on("postgres_changes",{event:"*",schema:"public",table:"pokemon_name_em_all_participants",filter:"session_id=eq."+session.id},()=>{if(alive)void refreshLive(client);})
      .on("postgres_changes",{event:"*",schema:"public",table:"pokemon_name_em_all_sessions",filter:"id=eq."+session.id},()=>{if(alive)void refreshLive(client);})
      .subscribe();
    const initialRefresh=window.setTimeout(()=>{if(alive)void refreshLive(client);},0);
    return()=>{alive=false;window.clearTimeout(initialRefresh);void client.removeChannel(channel);};
  },[session.id,refreshLive]);

  useEffect(()=>{
    let alive=true;
    const run=async()=>{if(alive)await heartbeat();};
    void run();
    const timer=window.setInterval(()=>void run(),20000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[heartbeat]);

  useEffect(()=>{
    if(session.status!=="ACTIVE"||isFinishing)return;
    const tick=()=>{
      const untilStart=session.started_at?Math.max(0,Math.ceil((new Date(session.started_at).getTime()-Date.now())/1000)):0;
      setCountdown(untilStart);
      if(unlimited){setRemaining(0);return;}
      if(untilStart>0){setRemaining(session.duration_seconds);return;}
      setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000)));
    };
    tick();
    const timer=window.setInterval(tick,250);
    return()=>window.clearInterval(timer);
  },[deadline,session.status,session.started_at,session.duration_seconds,isFinishing,unlimited]);

  useEffect(()=>{
    if(!unlimited&&remaining<=0&&countdown===0&&session.status==="ACTIVE"&&!isFinishing){
      const timer=window.setTimeout(()=>void finish("TIMER_EXPIRED"),0);
      return()=>window.clearTimeout(timer);
    }
  },[remaining,countdown,session.status,isFinishing,finish,unlimited]);

  useEffect(()=>{
    if(!pending&&!query&&session.status==="ACTIVE"&&!playerCompleted&&countdown===0){
      const frame=window.requestAnimationFrame(()=>inputRef.current?.focus());
      return()=>window.cancelAnimationFrame(frame);
    }
  },[pending,query,session.status,playerCompleted,countdown]);


  useEffect(()=>{
    if(!selected)return;
    const frame=window.requestAnimationFrame(()=>document.querySelector(".pokemon-nae-detail")?.scrollIntoView({behavior:"smooth",block:"center"}));
    return()=>window.cancelAnimationFrame(frame);
  },[selected]);
  useEffect(()=>{
    if(!confirmTerminate&&!confirmExit)return;
    window.scrollTo({top:0,behavior:"smooth"});
  },[confirmTerminate,confirmExit]);
  const requestHint=async()=>{
    if(!selected||!spellingHelp||pending||found.has(selected.id))return;
    const result=await hintNameEmAllMultiplayerAction(session.id,selected.id);
    if(!result.ok){setError(result.error??"Suggerimento non disponibile.");return;}
    setHint({nameLength:Number(result.data?.nameLength??0),revealedPrefix:String(result.data?.revealedPrefix??""),hintCount:Number(result.data?.hintCount??0)});
  };

  const exit=async()=>{
    setConfirmExit(false);
    const result=await leaveNameEmAllAction(session.id);
    if(!result.ok){setError(result.error??"Non è stato possibile uscire.");return;}
    if(result.data?.partialSaved)router.push("/profile/pokemon");
    else router.push("/pokemon");
  };
  const terminateForAll=async()=>{
    setConfirmTerminate(false);
    await finish("HOST_TERMINATED");
  };

  const expelParticipant=async(userId:string,displayName:string)=>{
    if(!window.confirm("Espellere "+displayName+" dalla partita? Il suo contributo già registrato sarà conservato."))return;
    const result=await expelNameEmAllParticipantAction(session.id,userId);
    if(!result.ok){setError(result.error??"Espulsione non riuscita.");return;}
    setMessage(displayName+" è stato espulso dalla partita.");
  };
  const sortedParticipants=[...participants].sort((a,b)=>b.foundCount-a.foundCount||
    (a.lastDiscoveryAt&&b.lastDiscoveryAt?new Date(a.lastDiscoveryAt).getTime()-new Date(b.lastDiscoveryAt).getTime():a.lastDiscoveryAt?-1:b.lastDiscoveryAt?1:0)||
    a.displayName.localeCompare(b.displayName,"it"));
  return <section className="pokemon-nae-game pokemon-nae-multiplayer" onPointerDown={()=>preparePokemonAudio(soundEnabled)}>
    <header className="pokemon-nae-game-header">
      <div><span className="pokemon-page-eyebrow">RENQD × POKÉMON · MULTIPLAYER</span><h1>Name ’Em All</h1><p>{shared?"Un unico catalogo per tutta la squadra.":"Stesso catalogo, progressi personali."} {isHost?"Sei l’host della partita.": "Segui la classifica in tempo reale."}</p></div>
      <div className="pokemon-nae-multiplayer-header-actions">
        {isHost&&<span className="pokemon-nae-host-tag"><Crown size={13}/> Host</span>}
        <div className="pokemon-nae-game-header-actions">
          <button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirmExit(true)}><LogOut size={15}/> Abbandona</button>
          {isHost&&<button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirmTerminate(true)}><X size={15}/> Termina per tutti</button>}
        </div>
      </div>
    </header>

    <div className="pokemon-nae-live-settings-toggle"><button type="button" className="pokemon-favourite-secondary" onClick={()=>setSettingsOpen(value=>!value)}><Settings size={15}/> Impostazioni</button></div>
    {settingsOpen&&<section className="pokemon-nae-live-settings" aria-label="Impostazioni di gioco">
      <div className="pokemon-nae-toggle-list">
        <label><span><strong>Shadows · Silhouette</strong></span><input type="checkbox" checked={visual.shadows} onChange={event=>setVisual(value=>({...value,shadows:event.target.checked}))}/></label>
        <label><span><strong>Effetti sonori</strong><small>Risposte, sblocchi e completamento</small></span><input type="checkbox" checked={soundEnabled} onChange={event=>setSoundEnabled(event.target.checked)}/></label>
      </div>
      <div className="pokemon-nae-choice-row">{([["RANDOM","Casuale"],["POKEDEX","Pokédex"],["TYPE","Per tipo"]] as const).map(([value,label])=><button type="button" key={value} className={sortOrder===value?"is-selected":""} onClick={()=>changeSort(value)}>{label}</button>)}</div>
    </section>}
    {countdown>0&&<div className="pokemon-nae-multiplayer-countdown" role="status"><span>La partita inizia tra</span><strong>{countdown}</strong></div>}
    <section className="pokemon-nae-multiplayer-scoreboard">
      <div className="pokemon-nae-hud-top">
        <div><small>TEMPO RIMANENTE</small><strong className={countdown>0?"":!unlimited&&remaining<60?"is-urgent":""}>{unlimited?"Illimitato":countdown>0?"00:00":formatClock(remaining)}</strong></div>
        <div><small>{shared?"POKÉMON DI SQUADRA":"I TUOI POKÉMON"}</small><strong>{found.size.toLocaleString("it-IT")} / {species.length.toLocaleString("it-IT")}</strong></div>
        <div><small>COMPLETAMENTO</small><strong>{percent}%</strong></div>
      </div>
      <div className="pokemon-nae-progress"><span style={{width:percent+"%"}}/></div>
      <button type="button" className={"pokemon-nae-leaderboard-toggle"+(shared?" is-shared":" is-individual")} onClick={()=>setLeaderboardOpen(value=>!value)} aria-expanded={leaderboardOpen}>
        <span>{shared?"Contributi della squadra":"Classifica live"}</span><small>{sortedParticipants.length} Allenatori</small><ChevronDown size={15} className={leaderboardOpen?"is-open":""}/>
      </button>
      <div className={"pokemon-nae-multiplayer-players"+(leaderboardOpen?" is-open":"")+(shared?" is-shared":" is-individual")}>
        {sortedParticipants.map((item,index)=><article key={item.userId} className={item.userId===currentUserId?"is-me":""}>
          <span className="pokemon-nae-player-rank">{index+1}</span>
          <span className="pokemon-nae-player-avatar">{item.avatarUrl?<img src={item.avatarUrl} alt=""/>:item.displayName.slice(0,1).toUpperCase()}</span>
          <span className="pokemon-nae-player-name"><strong>{item.displayName}{item.userId===currentUserId?" · Tu":""}</strong><small>{item.isConnected?"Connesso":"Disconnesso"}{item.completed?" · Completato":""}</small></span>
          <strong className="pokemon-nae-player-score">{item.foundCount}</strong>
          {item.userId===session.host_id&&<Crown size={13} className="pokemon-nae-player-crown"/>}
          {isPlatformOwner&&item.userId!==currentUserId&&<button type="button" className="pokemon-nae-remove-participant" onClick={()=>void expelParticipant(item.userId,item.displayName)} aria-label={"Espelli "+item.displayName}><UserX size={14}/></button>}
        </article>)}
      </div>
    </section>

    {session.status==="PAUSED"&&<div className="pokemon-nae-multiplayer-paused" role="status"><PauseCircle size={22}/><div><strong>Timer in pausa</strong><span>La partita riprenderà quando un Allenatore sarà nuovamente connesso.</span></div><button type="button" onClick={()=>void heartbeat()}>Riconnetti</button></div>}
    {playerCompleted&&session.status!=="COMPLETED"&&<div className="pokemon-nae-multiplayer-completed"><CheckCircle2 size={18}/> Hai completato il catalogo. La partita continua per gli altri partecipanti.</div>}

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
      <label className={"pokemon-nae-search"+(confirmed?" is-correct":message==="Non è una risposta valida per questo catalogo."?" is-wrong":"")}>
        <input ref={inputRef} value={query} onChange={event=>{const value=event.target.value;setQuery(value);setConfirmed(false);setMessage("");const normalized=normalizePokemonName(value);if(normalized&&!playerCompleted&&session.status==="ACTIVE"&&countdown===0){const match=findExactPokemonMatch(species,normalized);if(match&&!isAmbiguousPokemonName(species,match,normalized)){enqueuePokemonSubmission(match.name,match);}}}}
          onKeyDown={event=>{if(event.key==="Enter"&&exactMatch&&exactMatchIsAmbiguous&&!playerCompleted&&session.status==="ACTIVE"&&countdown===0){event.preventDefault();enqueuePokemonSubmission(exactMatch.name,exactMatch);}}}
          placeholder="Scrivi il nome di un Pokémon…" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
          disabled={playerCompleted||session.status!=="ACTIVE"||countdown>0}/>
        {confirmed&&<CheckCircle2 size={15} className="pokemon-nae-search-confirmed"/>}
        {pending&&<LoaderCircle size={15}/>}
      </label>
      {message&&<p className={"pokemon-nae-feedback"+(confirmed?" is-correct":"")} role="status">{message}</p>}
      {error&&<p role="alert" className="pokemon-nae-error">{error}</p>}
    </div>

    <div className="pokemon-nae-catalog pokemon-nae-multiplayer-catalog">
      {sections.map(section=>{
        const isMega=section.id==="special-mega";
        const cells=isMega?section.species.flatMap(item=>item.megaForms.map(form=>({item,form}))):section.species.map(item=>({item,form:null}));
        const total=isMega?cells.length:section.species.length;
        const count=isMega?section.species.reduce((sum,item)=>sum+(found.has(item.id)?item.megaForms.length:0),0):section.species.filter(item=>found.has(item.id)).length;
        return <section id={"nae-"+section.id} key={section.id} className="pokemon-nae-catalog-section">
          <header><div><span className="pokemon-page-eyebrow">{section.id.startsWith("gen-")?"CATALOGO PRINCIPALE":"SEZIONE SPECIALE"}</span><h2>{section.label}</h2></div><div className="pokemon-nae-catalog-header-actions"><small>{count}/{total} scoperti</small>{section.id.startsWith("gen-")&&(()=>{const generation=Number(section.id.slice(4));const collapsed=collapsedGenerations.has(generation);return <button type="button" className="pokemon-nae-collapse-toggle" aria-expanded={!collapsed} onClick={()=>setCollapsedGenerations(current=>{const next=new Set(current);if(next.has(generation))next.delete(generation);else next.add(generation);return next;})}><ChevronDown size={14} className={collapsed?"":"is-open"}/><span>{collapsed?"Espandi":"Comprimi"}</span></button>;})()}</div></header>
          {!section.id.startsWith("gen-")||!collapsedGenerations.has(Number(section.id.slice(4))) ? <div className="pokemon-nae-cell-grid">{cells.map(({item,form})=>{
            const isFound=found.has(item.id);
            const discovererId=shared?discoveryById[String(item.id)]:null;
            const discoverer=discovererId?participants.find(player=>player.userId===discovererId):null;
            const artwork=form?.spriteUrl??item.spriteUrl;
            const displayName=form?item.name+" "+form.label:item.name;
            return <button key={item.id+"-"+(form?.id??"base")} type="button" disabled={session.status!=="ACTIVE"||countdown>0} onClick={()=>{setSelected(item);setHint(null);}} className={"pokemon-nae-cell"+(isFound?" is-found":"")+(recentlyFoundId===item.id?" is-revealing":"")} aria-label={isFound?displayName:"Pokémon da scoprire"}>
              <span className="pokemon-nae-cell-art">{isFound||visual.shadows?<img src={artwork} alt="" loading="lazy" style={{filter:isFound?"none":"brightness(0) saturate(0) opacity(.55)"}}/>:<b className="pokemon-nae-pokeball">◉</b>}</span>
              {isFound?<strong>{displayName}</strong>:<strong className="is-hidden">{visual.shadows?"???":"Pokémon"}</strong>}
              {(item.forms.length>0||item.isLegendary||item.isMythical||item.isUltraBeast||item.isParadox)&&<span className="pokemon-nae-cell-indicators">{item.forms.length>0?"◇":""}{item.isLegendary?"★":""}{item.isMythical?"✦":""}{item.isUltraBeast?"◈":""}{item.isParadox?"⌁":""}</span>}
              {shared&&isFound&&discoverer&&<span className="pokemon-nae-cell-discoverer" title={"Scoperto da "+discoverer.displayName}>{discoverer.avatarUrl?<img src={discoverer.avatarUrl} alt=""/>:discoverer.displayName.slice(0,1).toUpperCase()}</span>}
            </button>;
          })}</div> : null}
        </section>;
      })}
    </div>

    {selected&&<div className="pokemon-nae-detail-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null);}}>
      <aside className="pokemon-nae-detail" role="dialog" aria-modal="true" aria-label={"Dettaglio "+selected.name}>
        <header><span className="pokemon-page-eyebrow">{found.has(selected.id)?"SCHEDA POKÉMON":"AIUTO ORTOGRAFICO"}</span><button type="button" onClick={()=>setSelected(null)} aria-label="Chiudi"><X size={18}/></button></header>
        <div className="pokemon-nae-detail-hero">{found.has(selected.id)?<img src={selected.artworkUrl} alt={selected.name}/>:<span className="pokemon-nae-detail-question">?</span>}<div><h2>{found.has(selected.id)?selected.name:"Pokémon da scoprire"}</h2>{config.showDexNumber===true&&<small>#{String(selected.id).padStart(4,"0")}</small>}<small>Generazione {selected.generation}</small>{config.showType===true&&<p>{selected.types.join(" · ")}</p>}</div></div>
        {found.has(selected.id)?<div className="pokemon-nae-detail-forms"><h3>Forme e rappresentazioni</h3>{selected.forms.length===0&&selected.megaForms.length===0&&<p>Nessuna forma alternativa registrata.</p>}{[...selected.forms,...selected.megaForms].map(form=><div key={form.id} className="pokemon-nae-detail-form"><img src={form.spriteUrl} alt="" loading="lazy"/><span>{form.label}</span>{form.isMega&&<small>Mega</small>}</div>)}</div>:<>{hint&&<p className="pokemon-nae-hint-reveal">{hint.revealedPrefix}{hint.revealedPrefix.length<hint.nameLength?" _".repeat(Math.min(12,hint.nameLength-hint.revealedPrefix.length)):""} <small>{hint.nameLength} lettere</small></p>}<button type="button" className="pokemon-favourite-primary" onClick={()=>void requestHint()} disabled={!spellingHelp||pending}> <HelpCircle size={15}/> Rivela lettere</button></>}
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>setSelected(null)}>Chiudi</button>
      </aside>
    </div>}

    {confirmExit&&<div className="pokemon-nae-pause-backdrop" role="presentation"><section className="pokemon-nae-pause-card" role="alertdialog" aria-modal="true" aria-labelledby="pokemon-nae-multi-exit">
      <span className="pokemon-page-eyebrow">CONFERMA USCITA</span>
      <h2 id="pokemon-nae-multi-exit">Abbandonare la partita?</h2>
      <p>Il tuo risultato attuale verrà salvato nel profilo, uscirai dalla classifica attiva e il tuo contributo resterà nei risultati finali. Potrai rientrare nella stessa sessione finché sarà in corso.</p>
      <button type="button" className="pokemon-favourite-primary" onClick={()=>void exit()} disabled={isFinishing}>Abbandona e salva</button>
      <button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirmExit(false)}>Continua a giocare</button>
    </section></div>}
    {confirmTerminate&&<div className="pokemon-nae-pause-backdrop" role="presentation"><section className="pokemon-nae-pause-card" role="alertdialog" aria-modal="true" aria-labelledby="pokemon-nae-multi-terminate">
      <span className="pokemon-page-eyebrow">AZIONE HOST</span>
      <h2 id="pokemon-nae-multi-terminate">Terminare la partita per tutti?</h2>
      <p>La sessione verrà chiusa per tutti i partecipanti e ciascuno riceverà il proprio risultato, compresi i progressi parziali.</p>
      <button type="button" className="pokemon-favourite-primary" onClick={()=>void terminateForAll()} disabled={isFinishing}>Termina per tutti</button>
      <button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirmTerminate(false)}>Annulla</button>
    </section></div>}
  </section>;
}
