"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowRight,Users} from "lucide-react";
export function MultiplayerJoin({token}:{token:string}){
 const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState("");
 async function join(){setBusy(true);setError("");try{const response=await fetch("/api/multiplayer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"join-link",token})});const result=await response.json();if(!response.ok)throw new Error(result.error??"Non è stato possibile entrare nella sessione.");router.replace("/multiplayer/"+result.rankingId);}catch(e){setError(e instanceof Error?e.message:"Errore durante l'accesso.");setBusy(false);}}
 return <main className="multiplayer-join-page"><div><Users size={30}/><span>INVITO RENQD</span><h1>Sei stato invitato a una sessione.</h1><p>Accedi alla sessione multiplayer con il tuo account approvato.</p>{error&&<p className="multiplayer-error" role="alert">{error}</p>}<button type="button" className="multiplayer-primary" onClick={()=>void join()} disabled={busy}>{busy?"Accesso…":"Entra nella sessione"} <ArrowRight size={16}/></button></div></main>;
}
