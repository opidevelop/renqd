"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, Crown, Link2, LoaderCircle, LogOut, Play, Send, Users, Settings, UserMinus } from "lucide-react";
import { GENERATION_LABELS, POKEMON_TYPES, POKEMON_TYPE_LABELS } from "@/lib/pokemon/catalog";
import {
  createNameEmAllInviteLinkAction, inviteNameEmAllUsersAction, leaveNameEmAllAction,
  setNameEmAllReadyAction, startNameEmAllMultiplayerAction,
  updateNameEmAllLobbyConfigAction, removeNameEmAllLobbyParticipantAction,
} from "@/app/(platform)/pokemon/name-em-all/actions";

export type NameEmAllParticipant = {
  userId:string; username:string; displayName:string; avatarUrl:string|null;
  isReady:boolean; isActive:boolean; isConnected:boolean; completed:boolean;
  foundCount:number; rankPosition:number|null; publicSlug:string|null;lastDiscoveryAt:string|null;
};

type LobbyConfig = {
  generations:number[]; types:string[];
  specialSections:{mega:boolean;legendary:boolean;mythical:boolean;ultraBeast:boolean;paradox:boolean};
  showDexNumber:boolean;showType:boolean;spellingHelp:boolean;shadows:boolean|null;
  sortOrder:"RANDOM"|"POKEDEX"|"TYPE";durationMinutes:number;mode:"COLLABORATIVE"|"INDIVIDUAL";
};
const defaultLobbyConfig=(config:Record<string,unknown>,gameMode:string,durationSeconds:number):LobbyConfig=>{
  const specials=(config.specialSections&&typeof config.specialSections==="object"?config.specialSections:{}) as Record<string,unknown>;
  const generations=Array.isArray(config.generations)?config.generations.map(Number).filter(value=>value>=1&&value<=9):[1,2,3,4,5,6,7,8,9];
  const types=Array.isArray(config.types)?config.types.filter((value):value is string=>typeof value==="string"):[];
  return {
    generations,types,
    specialSections:{mega:Boolean(specials.mega),legendary:Boolean(specials.legendary),mythical:Boolean(specials.mythical),ultraBeast:Boolean(specials.ultraBeast),paradox:Boolean(specials.paradox)},
    showDexNumber:Boolean(config.showDexNumber),showType:Boolean(config.showType),
    spellingHelp:config.spellingHelp!==false,shadows:typeof config.shadows==="boolean"?config.shadows:null,
    sortOrder:config.sortOrder==="POKEDEX"||config.sortOrder==="TYPE"?config.sortOrder:"RANDOM",
    durationMinutes:Math.max(1,Number(config.durationMinutes)||Math.round(durationSeconds/60)),
    mode:gameMode==="INDIVIDUAL"?"INDIVIDUAL":"COLLABORATIVE",
  };
};

export function NameEmAllMultiplayerLobby({
  session,participants,currentUserId,
}:{
  session:{id:string;game_mode:string;status:string;host_id:string|null;duration_seconds:number;catalog_species_ids:number[];config:Record<string,unknown>};
  participants:NameEmAllParticipant[];
  currentUserId:string;
}) {
  const router=useRouter();
  const [usernames,setUsernames]=useState("");
  const [inviteLink,setInviteLink]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [isPending,startTransition]=useTransition();
  const [editing,setEditing]=useState(false);
  const [editConfig,setEditConfig]=useState<LobbyConfig>(()=>defaultLobbyConfig(session.config,session.game_mode,session.duration_seconds));
  const isHost=session.host_id===currentUserId;
  const current=participants.find(item=>item.userId===currentUserId);
  const active=participants.filter(item=>item.isActive);
  const allReady=active.length>=2&&active.every(item=>item.isReady);
  const gameMode=session.game_mode==="COLLABORATIVE"?"Multiplayer condiviso":"Multiplayer individuale";

  const invite=()=>{
    const names=usernames.split(/[,\n; ]+/).map(value=>value.trim()).filter(Boolean);
    if(!names.length){setError("Inserisci uno o più username.");return;}
    setBusy(true);setError("");setMessage("");
    startTransition(async()=>{
      const result=await inviteNameEmAllUsersAction(session.id,names);
      setBusy(false);
      if(!result.ok){setError(result.error??"Inviti non inviati.");return;}
      const count=Number(result.data?.count??0);
      setMessage(count?("Inviti inviati: "+count+"."):"Nessun nuovo invito: verifica gli username o eventuali inviti già attivi.");
      setUsernames("");
      router.refresh();
    });
  };

  const createLink=()=>{
    setBusy(true);setError("");setMessage("");
    startTransition(async()=>{
      const result=await createNameEmAllInviteLinkAction(session.id);
      setBusy(false);
      if(!result.ok){setError(result.error??"Non è stato possibile creare il link.");return;}
      setInviteLink(result.url??"");
      setMessage("Link di invito creato. Puoi condividerlo con gli altri Allenatori.");
    });
  };

  const copyLink=async()=>{
    if(!inviteLink)return;
    try{await navigator.clipboard.writeText(inviteLink);setMessage("Link copiato negli appunti.");}
    catch{setError("Copia automatica non disponibile: seleziona e copia il link.");}
  };

  const toggleReady=()=>{
    if(!current)return;
    setBusy(true);setError("");setMessage("");
    startTransition(async()=>{
      const result=await setNameEmAllReadyAction(session.id,!current.isReady);
      setBusy(false);
      if(!result.ok){setError(result.error??"Non è stato possibile aggiornare lo stato.");return;}
      router.refresh();
    });
  };

  const start=()=>{
    setBusy(true);setError("");setMessage("");
    startTransition(async()=>{
      const result=await startNameEmAllMultiplayerAction(session.id);
      setBusy(false);
      if(!result.ok){setError(result.error??"Non è stato possibile avviare la partita.");return;}
      router.refresh();
    });
  };

  const saveConfig=()=>{
    setBusy(true);setError("");setMessage("");
    startTransition(async()=>{
      const result=await updateNameEmAllLobbyConfigAction(session.id,editConfig as unknown as Record<string,unknown>);
      setBusy(false);
      if(!result.ok){setError(result.error??"Non è stato possibile aggiornare la configurazione.");return;}
      setEditing(false);setMessage("Configurazione aggiornata. Tutti i partecipanti dovranno confermare nuovamente la disponibilità.");
      router.refresh();
    });
  };

  const removeParticipant=(userId:string,displayName:string)=>{
    if(!window.confirm("Rimuovere "+displayName+" dalla lobby? La persona non sarà più conteggiata per l’avvio."))return;
    setBusy(true);setError("");setMessage("");
    startTransition(async()=>{
      const result=await removeNameEmAllLobbyParticipantAction(session.id,userId);
      setBusy(false);
      if(!result.ok){setError(result.error??"Non è stato possibile rimuovere il partecipante.");return;}
      setMessage("Partecipante rimosso dalla lobby.");router.refresh();
    });
  };

  const leave=()=>{
    setBusy(true);setError("");
    startTransition(async()=>{
      const result=await leaveNameEmAllAction(session.id);
      setBusy(false);
      if(!result.ok){setError(result.error??"Non è stato possibile uscire dalla lobby.");return;}
      router.push("/pokemon");
    });
  };

  return <section className="pokemon-nae-lobby">
    <header className="pokemon-nae-lobby-header">
      <div><span className="pokemon-page-eyebrow">NAME ’EM ALL · LOBBY</span><h1>La squadra si prepara.</h1><p>{gameMode} · {Math.round(session.duration_seconds/60)} minuti · {session.catalog_species_ids.length.toLocaleString("it-IT")} Pokémon</p></div>
      <span className="pokemon-nae-lobby-count"><Users size={17}/>{active.length}/8</span>
    </header>
    <section className="pokemon-nae-lobby-panel">
      <div className="pokemon-nae-lobby-section-title"><div><span className="pokemon-page-eyebrow">PARTECIPANTI</span><h2>Chi è in partita.</h2></div><span>{active.filter(item=>item.isReady).length} pronti</span></div>
      <div className="pokemon-nae-lobby-participants">
        {participants.filter(item=>item.isActive).map(item=><article key={item.userId}>
          <span className="pokemon-nae-lobby-avatar">{item.avatarUrl?<img src={item.avatarUrl} alt=""/>:item.displayName.slice(0,1).toUpperCase()}</span>
          <div><strong>{item.displayName}{item.userId===currentUserId?" · Tu":""}</strong><small>@{item.username||"allenatore"} · {item.isConnected?"Connesso":"In attesa"}</small></div>
          <span className={item.isReady?"pokemon-nae-ready is-ready":"pokemon-nae-ready"}>{item.isReady?<><Check size={13}/> Pronto</>:"Non pronto"}</span>
          {item.userId===session.host_id&&<span className="pokemon-nae-host-tag"><Crown size={12}/> Host</span>}
          {isHost&&item.userId!==currentUserId&&<button type="button" className="pokemon-nae-remove-participant" disabled={busy||isPending} onClick={()=>removeParticipant(item.userId,item.displayName)} aria-label={"Rimuovi "+item.displayName}><UserMinus size={15}/></button>}
        </article>)}
      </div>
      {isHost&&<div className="pokemon-nae-lobby-config">
        <button type="button" className="pokemon-favourite-secondary" onClick={()=>setEditing(value=>!value)}><Settings size={15}/>{editing?"Chiudi impostazioni":"Modifica impostazioni"}</button>
        {editing&&<div className="pokemon-nae-lobby-config-editor">
          <div className="pokemon-nae-subheading"><strong>Modalità multiplayer</strong></div>
          <div className="pokemon-nae-choice-row">
            <button type="button" className={editConfig.mode==="COLLABORATIVE"?"is-selected":""} onClick={()=>setEditConfig(value=>({...value,mode:"COLLABORATIVE"}))}>Pokédex condiviso</button>
            <button type="button" className={editConfig.mode==="INDIVIDUAL"?"is-selected":""} onClick={()=>setEditConfig(value=>({...value,mode:"INDIVIDUAL"}))}>Pokédex individuali</button>
          </div>
          <div className="pokemon-nae-subheading"><strong>Generazioni</strong><span>Seleziona quelle incluse</span></div>
          <div className="pokemon-nae-generation-grid">{GENERATION_LABELS.map((label,index)=>{const generation=index+1;const selected=editConfig.generations.includes(generation);return <button type="button" key={generation} className={selected?"is-selected":""} onClick={()=>setEditConfig(value=>({...value,generations:selected?value.generations.filter(item=>item!==generation):[...value.generations,generation].sort((a,b)=>a-b)}))}>{label}</button>;})}</div>
          <div className="pokemon-nae-inline-actions"><button type="button" onClick={()=>setEditConfig(value=>({...value,generations:[1,2,3,4,5,6,7,8,9]}))}>Tutte</button><button type="button" onClick={()=>setEditConfig(value=>({...value,generations:[]}))}>Nessuna</button></div>
          <div className="pokemon-nae-subheading"><strong>Tipi</strong><span>Vuoto = tutti i tipi</span></div>
          <div className="pokemon-nae-type-grid">{POKEMON_TYPES.map(type=><button type="button" key={type} className={editConfig.types.includes(type)?"is-selected":""} onClick={()=>setEditConfig(value=>({...value,types:value.types.includes(type)?value.types.filter(item=>item!==type):[...value.types,type]}))}>{POKEMON_TYPE_LABELS[type]}</button>)}</div>
          <div className="pokemon-nae-subheading"><strong>Sezioni speciali</strong></div>
          <div className="pokemon-nae-toggle-list">
            {([["mega","Mega"],["legendary","Leggendari"],["mythical","Mitici"],["ultraBeast","Ultracreature"],["paradox","Paradosso"]] as const).map(([key,label])=><label key={key}><span><strong>{label}</strong></span><input type="checkbox" checked={editConfig.specialSections[key]} onChange={event=>setEditConfig(value=>({...value,specialSections:{...value.specialSections,[key]:event.target.checked}}))}/></label>)}
          </div>
          <div className="pokemon-nae-subheading"><strong>Aiuti e visualizzazione</strong></div>
          <div className="pokemon-nae-toggle-list">
            <label><span><strong>Numero Pokédex nella scheda</strong></span><input type="checkbox" checked={editConfig.showDexNumber} onChange={event=>setEditConfig(value=>({...value,showDexNumber:event.target.checked}))}/></label>
            <label><span><strong>Tipo nella scheda</strong></span><input type="checkbox" checked={editConfig.showType} onChange={event=>setEditConfig(value=>({...value,showType:event.target.checked}))}/></label>
            <label><span><strong>Aiuto ortografico</strong></span><input type="checkbox" checked={editConfig.spellingHelp} onChange={event=>setEditConfig(value=>({...value,spellingHelp:event.target.checked}))}/></label>
          </div>
          <div className="pokemon-nae-subheading"><strong>Shadows</strong></div>
          <div className="pokemon-nae-choice-row">
            <button type="button" className={editConfig.shadows===true?"is-selected":""} onClick={()=>setEditConfig(value=>({...value,shadows:true}))}>Silhouette</button>
            <button type="button" className={editConfig.shadows===false?"is-selected":""} onClick={()=>setEditConfig(value=>({...value,shadows:false}))}>Poké Ball</button>
          </div>
          <div className="pokemon-nae-subheading"><strong>Ordine della griglia</strong></div>
          <div className="pokemon-nae-choice-row">{([["RANDOM","Casuale"],["POKEDEX","Pokédex"],["TYPE","Per tipo"]] as const).map(([value,label])=><button type="button" key={value} className={editConfig.sortOrder===value?"is-selected":""} onClick={()=>setEditConfig(current=>({...current,sortOrder:value}))}>{label}</button>)}</div>
          <label className="pokemon-nae-custom-duration">Durata in minuti<input type="number" min="1" max="1440" value={editConfig.durationMinutes} onChange={event=>setEditConfig(value=>({...value,durationMinutes:Math.min(1440,Math.max(1,Number(event.target.value)||1))}))}/></label>
          <button type="button" className="pokemon-favourite-primary" disabled={busy||isPending||editConfig.generations.length===0} onClick={saveConfig}>{busy||isPending?<LoaderCircle size={15}/>:<Check size={15}/>} Salva configurazione</button>
        </div>}
      </div>}
      <div className="pokemon-nae-lobby-ready-row">
        <button type="button" className={current?.isReady?"pokemon-favourite-secondary":"pokemon-favourite-primary"} onClick={toggleReady} disabled={busy||isPending||!current}>
          {busy||isPending?<LoaderCircle size={15}/>:<Check size={15}/>} {current?.isReady?"Non sono pronto":"Sono pronto"}
        </button>
        {isHost&&<button type="button" className="pokemon-favourite-primary" onClick={start} disabled={busy||isPending||!allReady}>
          {busy||isPending?<LoaderCircle size={15}/>:<Play size={15}/>} Avvia partita
        </button>}
      </div>
      {isHost&&!allReady&&<p className="pokemon-nae-lobby-note">L’avvio si abiliterà quando ci saranno almeno due partecipanti e tutti saranno pronti.</p>}
    </section>

    {isHost&&<section className="pokemon-nae-lobby-panel">
      <div className="pokemon-nae-lobby-section-title"><div><span className="pokemon-page-eyebrow">INVITI</span><h2>Chi vuoi chiamare?</h2></div><Send size={18}/></div>
      <label className="pokemon-nae-lobby-invite-label">Username Renqd <input value={usernames} onChange={event=>setUsernames(event.target.value)} placeholder="@username, un altro username…" /></label>
      <button type="button" className="pokemon-favourite-secondary" onClick={invite} disabled={busy||isPending||!usernames.trim()}><Send size={15}/> Invia inviti</button>
      <div className="pokemon-nae-lobby-link-row"><button type="button" className="pokemon-favourite-secondary" onClick={createLink} disabled={busy||isPending}><Link2 size={15}/> Crea link condivisibile</button>
        {inviteLink&&<button type="button" className="pokemon-favourite-secondary" onClick={copyLink}><Clipboard size={15}/> Copia link</button>}</div>
      {inviteLink&&<input className="pokemon-nae-lobby-link-input" readOnly value={inviteLink} onFocus={event=>event.currentTarget.select()} aria-label="Link di invito"/>}
    </section>}
    {message&&<p className="pokemon-catalog-sync is-ready" role="status">{message}</p>}
    {error&&<p className="pokemon-nae-error" role="alert">{error}</p>}
    <button type="button" className="pokemon-favourite-secondary pokemon-nae-lobby-leave" onClick={leave} disabled={busy||isPending}><LogOut size={15}/> Esci dalla lobby</button>
  </section>;
}
