"use client";

import { useState } from "react";
import { Bell, Shield, ShieldOff } from "lucide-react";
import { setNameEmAllDefaultVisibilityAction, setNameEmAllSocialNotificationsAction } from "@/app/(platform)/pokemon/name-em-all/actions";

type BlockedUser={userId:string;username:string;displayName:string;avatarUrl:string|null};

export function PokemonNameEmAllPreferences({
  defaultVisibility,notifyLikes,notifyComments,blockedUsers,
}:{
  defaultVisibility:"PUBLIC"|"PRIVATE";notifyLikes:boolean;notifyComments:boolean;blockedUsers:BlockedUser[];
}) {
  const [visibility,setVisibility]=useState(defaultVisibility);
  const [likes,setLikes]=useState(notifyLikes);
  const [comments,setComments]=useState(notifyComments);
  const [blocked,setBlocked]=useState(blockedUsers);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function saveVisibility(value:"PUBLIC"|"PRIVATE") {
    setBusy(true);setError("");setMessage("");
    const result=await setNameEmAllDefaultVisibilityAction(value);
    if(result.ok){setVisibility(value);setMessage("Preferenza privacy aggiornata. Si applica alle nuove partite.");}
    else setError(result.error??"Non è stato possibile aggiornare la privacy.");
    setBusy(false);
  }
  async function saveNotifications(nextLikes:boolean,nextComments:boolean) {
    setBusy(true);setError("");setMessage("");
    const result=await setNameEmAllSocialNotificationsAction(nextLikes,nextComments);
    if(result.ok){setLikes(nextLikes);setComments(nextComments);setMessage("Preferenze notifiche aggiornate.");}
    else setError(result.error??"Non è stato possibile aggiornare le notifiche.");
    setBusy(false);
  }
  async function unblock(userId:string) {
    setBusy(true);setError("");setMessage("");
    try {
      const response=await fetch("/api/social/blocks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"unblock",targetUserId:userId})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Impossibile sbloccare l’utente.");
      setBlocked(items=>items.filter(item=>item.userId!==userId));setMessage("Utente sbloccato.");
    } catch(e) {setError(e instanceof Error?e.message:"Impossibile sbloccare l’utente.");}
    finally {setBusy(false);}
  }

  return <details className="pokemon-profile-preferences">
    <summary className="pokemon-profile-preferences-summary"><div><span className="pokemon-page-eyebrow">IMPOSTAZIONI NAME ’EM ALL</span><h2>Privacy e notifiche</h2><p>Le preferenze valgono per le nuove partite; puoi sempre cambiare la visibilità di un singolo risultato.</p></div><Shield size={22}/></summary><div className="pokemon-profile-preferences-content">
    <div className="pokemon-preference-row"><div><strong>Visibilità predefinita</strong><small>Decide chi può consultare i risultati delle prossime partite.</small></div>
      <select value={visibility} disabled={busy} onChange={event=>void saveVisibility(event.target.value as "PUBLIC"|"PRIVATE")}><option value="PUBLIC">Pubblica su Renqd</option><option value="PRIVATE">Privata · solo io e i partecipanti</option></select>
    </div>
    <div className="pokemon-preference-row"><div><strong>Notifiche Mi piace</strong><small>Ricevi una notifica quando qualcuno apprezza un tuo risultato.</small></div><input type="checkbox" checked={likes} disabled={busy} onChange={event=>void saveNotifications(event.target.checked,comments)}/></div>
    <div className="pokemon-preference-row"><div><strong>Notifiche commenti e risposte</strong><small>Ricevi aggiornamenti sulle conversazioni dei tuoi risultati.</small></div><input type="checkbox" checked={comments} disabled={busy} onChange={event=>void saveNotifications(likes,event.target.checked)}/></div>
    <div className="pokemon-preference-blocks"><div><strong>Utenti bloccati</strong><small>Il blocco è reciproco e impedisce la visualizzazione dei profili/contenuti social e le interazioni. I risultati di una partita condivisa restano consultabili dai partecipanti.</small></div>
      {blocked.length?blocked.map(item=><article key={item.userId}><span>{item.avatarUrl?<img src={item.avatarUrl} alt=""/>:item.displayName.slice(0,1).toUpperCase()}</span><div><strong>{item.displayName}</strong><small>@{item.username}</small></div><button type="button" onClick={()=>void unblock(item.userId)} disabled={busy}><ShieldOff size={14}/> Sblocca</button></article>):<p>Non hai utenti bloccati.</p>}
    </div>
    {error&&<p className="pokemon-social-feedback is-error" role="alert">{error}</p>}
    {message&&<p className="pokemon-social-feedback" role="status"><Bell size={14}/>{message}</p>}
    </div>
  </details>;
}
