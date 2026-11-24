"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldBan } from "lucide-react";

export function UserBlockButton({userId,displayName}:{userId:string;displayName:string}) {
  const router=useRouter();
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function block(){
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/social/blocks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"block",targetUserId:userId})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Impossibile bloccare l’utente.");
      router.push("/profile/pokemon");
    }catch(e){setError(e instanceof Error?e.message:"Impossibile bloccare l’utente.");setBusy(false);}
  }
  return <>
    <button type="button" className="profile-block-button" onClick={()=>setConfirm(true)}><ShieldBan size={15}/> Blocca utente</button>
    {error&&<p className="pokemon-social-feedback is-error" role="alert">{error}</p>}
    {confirm&&<div className="pokemon-nae-pause-backdrop" role="presentation"><section className="pokemon-nae-pause-card" role="alertdialog" aria-modal="true" aria-labelledby="profile-block-title">
      <h2 id="profile-block-title">Bloccare {displayName}?</h2>
      <p>Il blocco è reciproco: non potrete vedere i rispettivi profili e contenuti social né interagire. I risultati di una partita Pokémon condivisa restano consultabili dai partecipanti.</p>
      <div><button type="button" className="pokemon-favourite-secondary" onClick={()=>setConfirm(false)} disabled={busy}>Annulla</button><button type="button" className="pokemon-favourite-primary" onClick={()=>void block()} disabled={busy}>Conferma blocco</button></div>
    </section></div>}
  </>;
}
