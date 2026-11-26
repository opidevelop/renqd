"use client";
import {useEffect,useState} from "react";
import {Settings2,Check,LoaderCircle} from "lucide-react";
import {useDragRacePreferences} from "@/lib/drag-race/use-preferences";
export function LalaparuzaPreferences(){
 const {preferences,update,loaded,saving}=useDragRacePreferences();const [message,setMessage]=useState("");const [volumeDraft,setVolumeDraft]=useState(preferences.player_volume);
 useEffect(()=>setVolumeDraft(preferences.player_volume),[preferences.player_volume]);
 async function change(patch:Parameters<typeof update>[0]){setMessage("");try{await update(patch);setMessage("Preferenze salvate.");}catch(e){setMessage(e instanceof Error?e.message:"Salvataggio non riuscito.");}}
 return <details className="drag-shared-preferences"><summary><Settings2 size={17}/> Impostazioni condivise <span>Valgono per tutte le modalità Lalaparuza</span></summary><div className="drag-shared-preferences-grid">
  <label><span><strong>Animazioni</strong><small>Transizioni e movimenti nelle schermate di gioco</small></span><input type="checkbox" checked={preferences.animations_enabled} disabled={!loaded||saving} onChange={e=>void change({animations_enabled:e.target.checked})}/></label>
  <label><span><strong>Audio player</strong><small>Attiva o silenzia le anteprime musicali</small></span><input type="checkbox" checked={preferences.sounds_enabled} disabled={!loaded||saving} onChange={e=>void change({sounds_enabled:e.target.checked})}/></label>
  <label><span><strong>Riproduzione automatica</strong><small>Avvia la preview quando cambia la canzone</small></span><input type="checkbox" checked={preferences.player_autoplay} disabled={!loaded||saving} onChange={e=>void change({player_autoplay:e.target.checked})}/></label>
  <label className="drag-preference-volume"><span><strong>Volume player</strong><small>{Math.round(volumeDraft*100)}%</small></span><input type="range" min="0" max="1" step="0.05" value={volumeDraft} disabled={!loaded||saving} onChange={e=>setVolumeDraft(Number(e.target.value))} onPointerUp={()=>void change({player_volume:volumeDraft})} onBlur={()=>{if(volumeDraft!==preferences.player_volume)void change({player_volume:volumeDraft});}}/></label>
 </div>{message&&<small className="drag-preferences-message" role="status">{saving?<LoaderCircle size={13}/>:<Check size={13}/>} {message}</small>}{!loaded&&<small>Caricamento preferenze…</small>}</details>;
}