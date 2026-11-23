"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Trash2} from "lucide-react";
export function HomeResumeActions(){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function clearAll(){
  if(busy||!window.confirm("Vuoi svuotare Riprendi Renq? Tutte le bozze in corso verranno rimosse dalla Home."))return;
  setBusy(true);setError("");
  try{const response=await fetch("/api/rankings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete-all-drafts"})});const result=await response.json();if(!response.ok)throw new Error(result.error??"Non è stato possibile svuotare le bozze.");router.refresh();}
  catch(e){setError(e instanceof Error?e.message:"Errore durante la cancellazione.");}
  finally{setBusy(false);}
 }
 return <div className="home-resume-actions"><button type="button" onClick={()=>void clearAll()} disabled={busy}><Trash2 size={14}/>{busy?"Svuotamento…":"Svuota tutto"}</button>{error&&<small role="alert">{error}</small>}</div>;
}
