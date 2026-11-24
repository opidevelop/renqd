"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Crown, HelpCircle, LoaderCircle, LogOut, PauseCircle, Send, X, Link2, Copy, UserX, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PokemonCatalog, PokemonSpecies, normalizePokemonName } from "@/lib/pokemon/catalog";
import { createNameEmAllInviteLinkAction, inviteNameEmAllUsersAction, expelNameEmAllParticipantAction, finishNameEmAllMultiplayerAction, heartbeatNameEmAllAction, hintNameEmAllMultiplayerAction, leaveNameEmAllAction, submitNameEmAllMultiplayerAnswerAction } from "@/app/(platform)/pokemon/name-em-all/actions";
import type { NameEmAllParticipant } from "@/components/pokemon/multiplayer-lobby";

type MultiplayerSession={
  id:string;owner_id:string;host_id:string|null;game_mode:string;status:string;started_at:string|null;
  config:Record<string,unknown>;catalog_species_ids:number[];special_species_ids:Record<string,number[]>;
  duration_seconds:number;deadline_at:string|null;remaining_seconds:number|null;paused_total_seconds:number;
};

function formatClock(seconds:number){const value=Math.max(0,seconds);return Math.floor(value/60).toString().padStart(2,"0")+":"+Math.floor(value%60).toString().padStart(2,"0");}

export function PokemonNameEmAllMultiplayerGame({
  catalog,session:initialSession,initialDiscoveries,initialParticipants,currentUserId,currentUserRole,
}:{
  catalog:PokemonCatalog;session:MultiplayerSession;initialDiscoveries:number[];
  initialParticipants:NameEmAllParticipant[];currentUserId:string;currentUserRole:string;
}) {
  const router=useRouter();
  const [session,setSession]=useState(initialSession);
  const [participants,setParticipants]=useState(initialParticipants);
  const [found,setFound]=useState<Set<number>>(new Set(initialDiscoveries));
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState<PokemonSpecies|null>(null);
  const [hint,setHint]=useState<{nameLength:number;revealedPrefix:string;hintCount:number}|null>(null);
  const [countdown,setCountdown]=useState(0);
  const [remaining,setRemaining]=useState(initialSession.status==="PAUSED"?(initialSession.remaining_seconds??0):(initialSession.remaining_seconds??initialSession.duration_seconds));
  const [deadline,setDeadline]=useState(initialSession.deadline_at?new Date(initialSession.deadline_at).getTime():0);
  const [pending,setPending]=useState(false);
  const [isFinishing,setIsFinishing]=useState(false);
  const [playerCompleted,setPlayerCompleted]=useState(Boolean(initialParticipants.find(p=>p.userId===currentUserId)?.completed));
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [confirmExit,setConfirmExit]=useState(false);
  const [inviteNames,setInviteNames]=useState("");
  const [inviteLink,setInviteLink]=useState("");
  const [inviteFeedback,setInviteFeedback]=useState("");
  const [inviteError,setInviteError]=useState("");
  const [inviteBusy,setInviteBusy]=useState(false);
  const shared=session.game_mode==="COLLABORATIVE";
  const isHost=session.host_id===currentUserId;
  const isOwner=session.owner_id===currentUserId;
  const canInvite=isHost||isOwner;
  const isPlatformOwner=currentUserRole==="OWNER";
  const config=session.config as Record<string,unknown>;
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [visual,setVisual]=useState({showDexNumber:config.showDexNumber===true,showType:config.showType===true,shadows:config.shadows===true});
  const [sortOrder,setSortOrder]=useState(config.sortOrder==="POKEDEX"||config.sortOrder==="TYPE"?config.sortOrder:"RANDOM");
  const [randomOrder,setRandomOrder]=useState<number[]|null>(null);
  const spellingHelp=config.spellingHelp!==false;
  const species=useMemo(()=>{
    const base=session.catalog_species_ids.map(id=>catalog.species.find(item=>item.id===id)).filter((item):item is PokemonSpecies=>Boolean(item));
    if(sortOrder==="POKEDEX")return [...base].sort((a,b)=>a.id-b.id);
    if(sortOrder==="TYPE")return [...base].sort((a,b)=>(a.types[0]??"").localeCompare(b.types[0]??"")||a.id-b.id);
    if(randomOrder){const rank=new Map(randomOrder.map((id,index)=>[id,index]));return [...base].sort((a,b)=>(rank.get(a.id)??0)-(rank.get(b.id)??0));}
    return base;
  },[catalog,session.catalog_species_ids,sortOrder,randomOrder]);
  const changeSort=(value:"RANDOM"|"POKEDEX"|"TYPE")=>{
    setSortOrder(value);
    if(value==="RANDOM")setRandomOrder([...species].sort(()=>Math.random()-.5).map(item=>item.id));
  };
  const suggestions=useMemo(()=>{
    const value=normalizePokemonName(query);
    if(value.length<2)return [];
    return species.map(item=>({item,score:[item.name,item.nameEn,item.slug,...item.aliases].map(normalizePokemonName).reduce((best,name)=>name===value?0:name.startsWith(value)?Math.min(best,1):name.includes(value)?Math.min(best,2):best,3)}))
      .filter(item=>item.score<3&&!found.has(item.item.id)).sort((a,b)=>a.score-b.score||a.item.id-b.item.id).slice(0,5).map(item=>item.item);
  },[species,query,found]);
  const percent=species.length?Math.round(found.size/species.length*100):0;

  const finish=useCallback(async(reason:string)=>{
    if(isFinishing)return;
    setIsFinishing(true);setError("");
    const result=await finishNameEmAllMultiplayerAction(session.id,reason);
    if(!result.ok){setError(result.error??"Non è stato possibile salvare i risultati.");setIsFinishing(false);return;}
    router.refresh();
  },[isFinishing,router,session.id]);

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
      client.from("pokemon_name_em_all_discoveries").select("species_id,user_id,discovered_by").eq("session_id",session.id),
      client.from("pokemon_name_em_all_participants").select("user_id,is_ready,is_active,is_connected,completed_at,joined_at").eq("session_id",session.id).is("expelled_at",null).order("joined_at",{ascending:true}),
      client.from("pokemon_name_em_all_sessions").select("status,host_id,started_at,deadline_at,remaining_seconds").eq("id",session.id).maybeSingle(),
    ]);
    const rows=discoveriesResult.data??[];
    const myRows=rows.filter(row=>shared?row.user_id===null:row.user_id===currentUserId);
    setFound(new Set(myRows.map(row=>Number(row.species_id))));
    const counts=new Map<string,number>();
    for(const row of rows){const id=shared?String(row.discovered_by):String(row.user_id);counts.set(id,(counts.get(id)??0)+1);}
    const participantRows=participantsResult.data??[];
    const ids=participantRows.map(row=>row.user_id);
    const {data:profiles}=ids.length?await client.from("public_profiles").select("user_id,username,display_name,avatar_url").in("user_id",ids):{data:[]};
    const profileMap=new Map((profiles??[]).map(profile=>[profile.user_id,profile]));
    setParticipants(participantRows.map(row=>{
      const profile=profileMap.get(row.user_id);
      const old=initialParticipants.find(item=>item.userId===row.user_id);
      return {userId:row.user_id,username:profile?.username??old?.username??"",displayName:profile?.display_name??old?.displayName??"Allenatore",
        avatarUrl:old?.avatarUrl??null,isReady:Boolean(row.is_ready),isActive:Boolean(row.is_active),isConnected:Boolean(row.is_connected),
        completed:Boolean(row.completed_at),foundCount:counts.get(row.user_id)??0,rankPosition:old?.rankPosition??null,publicSlug:old?.publicSlug??null};
    }));
    if(sessionResult.data){
      const live=sessionResult.data;
      setSession(current=>({...current,status:live.status,host_id:live.host_id,deadline_at:live.deadline_at,remaining_seconds:live.remaining_seconds}));
      if(live.deadline_at)setDeadline(new Date(live.deadline_at).getTime());
      if(live.remaining_seconds!==null)setRemaining(live.remaining_seconds);
      if(live.status==="COMPLETED")router.refresh();
    }
  },[session.id,shared,currentUserId,initialParticipants,router]);

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
    if(session.status!=="ACTIVE"||!deadline||isFinishing)return;
    const tick=()=>{
      const untilStart=session.started_at?Math.max(0,Math.ceil((new Date(session.started_at).getTime()-Date.now())/1000)):0;
      setCountdown(untilStart);
      if(untilStart>0){setRemaining(session.duration_seconds);return;}
      setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000)));
    };
    tick();
    const timer=window.setInterval(tick,250);
    return()=>window.clearInterval(timer);
  },[deadline,session.status,session.started_at,session.duration_seconds,isFinishing]);

  useEffect(()=>{
    if(remaining<=0&&countdown===0&&session.status==="ACTIVE"&&!isFinishing){
      const timer=window.setTimeout(()=>void finish("TIMER_EXPIRED"),0);
      return()=>window.clearTimeout(timer);
    }
  },[remaining,countdown,session.status,isFinishing,finish]);

  const submit=async(answer:string)=>{
    if(!answer.trim()||pending||playerCompleted||session.status!=="ACTIVE"||countdown>0)return;
    setPending(true);setError("");setMessage("");
    const result=await submitNameEmAllMultiplayerAnswerAction(session.id,answer);
    setPending(false);
    if(!result.ok){setError(result.error??"Risposta non registrata.");return;}
    const data=result.data??{};
    if(typeof data.speciesId==="number"&&["CORRECT","CATALOG_COMPLETE","PLAYER_COMPLETE","ALL_COMPLETED"].includes(String(data.status))){
      setFound(current=>new Set(current).add(Number(data.speciesId)));
      setQuery("");setSelected(null);setHint(null);
    }
    if(data.status==="WRONG"){setMessage("Non è una risposta valida per questo catalogo.");return;}
    if(data.status==="ALREADY_FOUND"){setMessage("Questo Pokémon è già stato scoperto.");return;}
    if(data.status==="PAUSED"){setSession(current=>({...current,status:"PAUSED"}));setMessage("La partita è in pausa.");return;}
    if(data.status==="TIME_EXPIRED"){await finish("TIMER_EXPIRED");return;}
    if(data.status==="PLAYER_COMPLETE"){setPlayerCompleted(true);setMessage("Hai completato il tuo catalogo. Attendi gli altri Allenatori.");return;}
    if(data.status==="CATALOG_COMPLETE"){setMessage("Pokédex condiviso completato!");await finish("CATALOG_COMPLETE");return;}
    if(data.status==="ALL_COMPLETED"){setPlayerCompleted(true);await finish("ALL_COMPLETED");return;}
    if(data.status==="CORRECT"){setMessage("Corretto! "+String(data.name??""));return;}
    if(data.status==="COUNTDOWN"){setMessage("La partita sta per iniziare.");return;}
    if(data.status==="FINISHED"){router.refresh();}
  };

  const requestHint=async()=>{
    if(!selected||!spellingHelp||pending||found.has(selected.id))return;
    const result=await hintNameEmAllMultiplayerAction(session.id,selected.id);
    if(!result.ok){setError(result.error??"Suggerimento non disponibile.");return;}
    setHint({nameLength:Number(result.data?.nameLength??0),revealedPrefix:String(result.data?.revealedPrefix??""),hintCount:Number(result.data?.hintCount??0)});
  };

  const exit=async()=>{
    setConfirmExit(false);
    if(isHost){await finish("HOST_TERMINATED");return;}
    const result=await leaveNameEmAllAction(session.id);
    if(!result.ok){setError(result.error??"Non è stato possibile uscire.");return;}
    router.refresh();
  };

  const inviteUsers=async()=>{
    const names=inviteNames.split(/[,\\n; ]+/).map(value=>value.trim()).filter(Boolean);
    if(!names.length)return;
    setInviteBusy(true);setInviteError("");setInviteFeedback("");
    const result=await inviteNameEmAllUsersAction(session.id,names);
    setInviteBusy(false);
    if(!result.ok){setInviteError(result.error??"Inviti non inviati.");return;}
    setInviteFeedback("Inviti inviati: "+String(result.data?.count??0)+".");setInviteNames("");
  };
  const createInviteLink=async()=>{
    setInviteBusy(true);setInviteError("");setInviteFeedback("");
    const result=await createNameEmAllInviteLinkAction(session.id);
    setInviteBusy(false);
    if(!result.ok){setInviteError(result.error??"Link non disponibile.");return;}
    setInviteLink(result.url??"");setInviteFeedback("Link pronto da condividere.");
  };
  const expelParticipant=async(userId:string,displayName:string)=>{
    if(!window.confirm("Espellere "+displayName+" dalla partita? Il suo contributo già registrato sarà conservato."))return;
    setInviteBusy(true);setInviteError("");setInviteFeedback("");
    const result=await expelNameEmAllParticipantAction(session.id,userId);
    setInviteBusy(false);
    if(!result.ok){setInviteError(result.error??"Espulsione non riuscita.");return;}
    setInviteFeedback(displayName+" è stato espulso dalla partita.");
  };
  const sortedParticipants=[...participants].sort((a,b)=>b.foundCount-a.foundCount||a.displayName.localeCompare(b.displayName,"it"));
  return <section className="pokemon-nae-game pokemon-nae-multiplayer">
    <header className="pokemon-nae-game-header">
      <div><span className="pokemon-page-eyebrow">RENQD × POKÉMON · MULTIPLAYER</span><h1>Name ’Em All</h1><p>{shared?"Un unico catalogo per tutta la squadra.":"Stesso catalogo, progressi personali."} {isHost?"Sei l’host della partita.": "Segui la classifica in tempo reale."}</p></div>
      <div className="pokemon-nae-multiplayer-header-actions">
        {isHost&&<span className="pokemon-nae-host-tag"><Crown size={13}/> Host</span>}
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirmExit(true)}><LogOut size={15}/>{isHost?"Termina partita":"Abbandona"}</button>
      </div>
    </header>

    <div className="pokemon-nae-live-settings-toggle"><button type="button" className="pokemon-favourite-secondary" onClick={()=>setSettingsOpen(value=>!value)}><Settings size={15}/> Visualizzazione</button></div>
    {settingsOpen&&<section className="pokemon-nae-live-settings" aria-label="Impostazioni visive">
      <div className="pokemon-nae-toggle-list">
        <label><span><strong>Numero Pokédex</strong></span><input type="checkbox" checked={visual.showDexNumber} onChange={event=>setVisual(value=>({...value,showDexNumber:event.target.checked}))}/></label>
        <label><span><strong>Tipo Pokémon</strong></span><input type="checkbox" checked={visual.showType} onChange={event=>setVisual(value=>({...value,showType:event.target.checked}))}/></label>
        <label><span><strong>Shadows · Silhouette</strong></span><input type="checkbox" checked={visual.shadows} onChange={event=>setVisual(value=>({...value,shadows:event.target.checked}))}/></label>
      </div>
      <div className="pokemon-nae-choice-row">{([["RANDOM","Casuale"],["POKEDEX","Pokédex"],["TYPE","Per tipo"]] as const).map(([value,label])=><button type="button" key={value} className={sortOrder===value?"is-selected":""} onClick={()=>changeSort(value)}>{label}</button>)}</div>
    </section>}
    {canInvite&&<section className="pokemon-nae-lobby-panel pokemon-nae-live-invites">
      <div className="pokemon-nae-lobby-section-title"><div><span className="pokemon-page-eyebrow">PARTITA IN CORSO</span><h2>Invita altri Allenatori</h2></div><Link2 size={17}/></div>
      <div className="pokemon-nae-lobby-link-row"><input value={inviteNames} onChange={event=>setInviteNames(event.target.value)} placeholder="@username, un altro username…" aria-label="Username da invitare"/><button type="button" onClick={()=>void inviteUsers()} disabled={inviteBusy||!inviteNames.trim()}><Send size={14}/> Invita</button></div>
      <div className="pokemon-nae-lobby-link-row"><button type="button" onClick={()=>void createInviteLink()} disabled={inviteBusy}><Link2 size={14}/> Crea link</button>{inviteLink&&<><input readOnly value={inviteLink} aria-label="Link invito"/><button type="button" onClick={()=>void navigator.clipboard.writeText(inviteLink)}><Copy size={14}/> Copia</button></>}</div>
      {inviteFeedback&&<p role="status">{inviteFeedback}</p>}{inviteError&&<p role="alert" className="pokemon-nae-error">{inviteError}</p>}
    </section>}
    {countdown>0&&<div className="pokemon-nae-multiplayer-countdown" role="status"><span>La partita inizia tra</span><strong>{countdown}</strong></div>}
    <section className="pokemon-nae-multiplayer-scoreboard">
      <div className="pokemon-nae-hud-top">
        <div><small>TEMPO RIMANENTE</small><strong className={countdown>0?"":remaining<60?"is-urgent":""}>{countdown>0?"00:00":formatClock(remaining)}</strong></div>
        <div><small>{shared?"POKÉMON DI SQUADRA":"I TUOI POKÉMON"}</small><strong>{found.size.toLocaleString("it-IT")} / {species.length.toLocaleString("it-IT")}</strong></div>
        <div><small>COMPLETAMENTO</small><strong>{percent}%</strong></div>
      </div>
      <div className="pokemon-nae-progress"><span style={{width:percent+"%"}}/></div>
      <div className="pokemon-nae-multiplayer-players">
        {sortedParticipants.map((item,index)=><article key={item.userId} className={item.userId===currentUserId?"is-me":""}>
          <span className="pokemon-nae-player-rank">{index+1}</span>
          <span className="pokemon-nae-player-avatar">{item.avatarUrl?<img src={item.avatarUrl} alt=""/>:item.displayName.slice(0,1).toUpperCase()}</span>
          <span className="pokemon-nae-player-name"><strong>{item.displayName}{item.userId===currentUserId?" · Tu":""}</strong><small>{item.isConnected?"Connesso":"Disconnesso"}{item.completed?" · Completato":""}</small></span>
          <strong className="pokemon-nae-player-score">{item.foundCount}</strong>
          {item.userId===session.host_id&&<Crown size={13} className="pokemon-nae-player-crown"/>}
          {isPlatformOwner&&item.userId!==currentUserId&&<button type="button" className="pokemon-nae-remove-participant" disabled={inviteBusy} onClick={()=>void expelParticipant(item.userId,item.displayName)} aria-label={"Espelli "+item.displayName}><UserX size={14}/></button>}
        </article>)}
      </div>
    </section>

    {session.status==="PAUSED"&&<div className="pokemon-nae-multiplayer-paused" role="status"><PauseCircle size={22}/><div><strong>Timer in pausa</strong><span>La partita riprenderà quando un Allenatore sarà nuovamente connesso.</span></div><button type="button" onClick={()=>void heartbeat()}>Riconnetti</button></div>}
    {playerCompleted&&session.status!=="COMPLETED"&&<div className="pokemon-nae-multiplayer-completed"><CheckCircle2 size={18}/> Hai completato il catalogo. La partita continua per gli altri partecipanti.</div>}

    <div className="pokemon-nae-multiplayer-answer">
      <label htmlFor="pokemon-nae-multiplayer-answer">Scrivi il nome di un Pokémon</label>
      <div><input id="pokemon-nae-multiplayer-answer" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")void submit(query);}} placeholder="Es. Pikachu" autoComplete="off" disabled={pending||playerCompleted||session.status!=="ACTIVE"||countdown>0}/><button type="button" onClick={()=>void submit(query)} disabled={pending||playerCompleted||session.status!=="ACTIVE"||countdown>0||!query.trim()}>{pending?<LoaderCircle size={16}/>:<Send size={16}/>} Invio</button></div>
      {suggestions.length>0&&<div className="pokemon-nae-multiplayer-suggestions">{suggestions.map(item=><button key={item.id} type="button" onClick={()=>{setQuery(item.name);void submit(item.name);}}>{item.name}</button>)}</div>}
      {message&&<p role="status">{message}</p>}{error&&<p role="alert" className="pokemon-nae-error">{error}</p>}
    </div>

    <div className="pokemon-nae-multiplayer-catalog">
      {species.map(item=>{
        const isFound=found.has(item.id);
        return <button key={item.id} type="button" disabled={isFound||playerCompleted||session.status!=="ACTIVE"} onClick={()=>{setSelected(item);setHint(null);}} className={"pokemon-nae-cell"+(isFound?" is-found":"")}>
          <span className="pokemon-nae-cell-art">{isFound?<img src={item.spriteUrl} alt="" loading="lazy"/>:visual.shadows?<img src={item.spriteUrl} alt="" loading="lazy" style={{filter:"brightness(0) saturate(0) opacity(.55)"}}/>:<span className="pokemon-nae-pokeball-placeholder">◉</span>}</span>
          <strong className={isFound?"":"is-hidden"}>{isFound?item.name:visual.shadows?"???":"Pokémon"}</strong>
          {visual.showDexNumber&&<small>#{String(item.id).padStart(4,"0")}</small>}
          {visual.showType&&<small>{item.types.join(" · ")}</small>}
        </button>;
      })}
    </div>

    {selected&&!found.has(selected.id)&&<div className="pokemon-nae-detail-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null);}}>
      <aside className="pokemon-nae-detail" role="dialog" aria-modal="true" aria-label={"Suggerimento per "+selected.name}>
        <header><span className="pokemon-page-eyebrow">AIUTO ORTOGRAFICO</span><button type="button" onClick={()=>setSelected(null)} aria-label="Chiudi"><X size={18}/></button></header>
        <div className="pokemon-nae-detail-hero"><span className="pokemon-nae-detail-question">?</span><div><h2>#{String(selected.id).padStart(4,"0")}</h2><small>Generazione {selected.generation}</small><p>{selected.types.join(" · ")}</p></div></div>
        {hint&&<p className="pokemon-nae-hint-reveal">{hint.revealedPrefix}{hint.revealedPrefix.length<hint.nameLength?" _".repeat(Math.min(12,hint.nameLength-hint.revealedPrefix.length)):""} <small>{hint.nameLength} lettere</small></p>}
        <button type="button" className="pokemon-favourite-primary" onClick={()=>void requestHint()} disabled={!spellingHelp||pending}> <HelpCircle size={15}/> Rivela lettere</button>
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>setSelected(null)}>Chiudi</button>
      </aside>
    </div>}

    {confirmExit&&<div className="pokemon-nae-pause-backdrop" role="presentation"><section className="pokemon-nae-pause-card" role="alertdialog" aria-modal="true" aria-labelledby="pokemon-nae-multi-exit">
      <span className="pokemon-page-eyebrow">{isHost?"HOST":"PARTECIPANTE"}</span>
      <h2 id="pokemon-nae-multi-exit">{isHost?"Terminare la partita per tutti?":"Abbandonare la partita?"}</h2>
      <p>{isHost?"Tutti i partecipanti riceveranno il risultato della partita.":"Il tuo contributo sarà conservato e riceverai il risultato quando la partita terminerà."}</p>
      <button type="button" className="pokemon-favourite-primary" onClick={()=>void exit()} disabled={isFinishing}>{isHost?"Termina per tutti":"Abbandona partita"}</button>
      <button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirmExit(false)}>Continua a giocare</button>
    </section></div>}
  </section>;
}
