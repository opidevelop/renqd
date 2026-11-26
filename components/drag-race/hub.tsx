"use client";
import {useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import Link from "next/link";
import {ArrowUpRight,Crown,RefreshCw,Music2,Trophy,Users,Gamepad2,LoaderCircle} from "lucide-react";
type Props={counts:{franchises:number;queens:number;seasons:number;episodes:number;lipsyncs:number;eligible:number};canSync:boolean;lastSyncedAt:string|null;sourceVersion:string};
const modules=[
 {title:"Season Simulator",desc:"Crea una stagione, costruisci il cast e simula ogni episodio.",icon:Users},
 {title:"Track Record",desc:"Consulta e modifica le schede delle stagioni e la Hall of Fame.",icon:Trophy,href:"/drag-race/track-record"},
 {title:"Guess Them All",desc:"Riconosci tutte le Queen dei franchise selezionati.",icon:Gamepad2,href:"/drag-race/guess-them-all"},
 {title:"Lalaparuza",desc:"Tre sfide musicali: Guess the Lipsync, Slayoff e Lipsync for Your Life.",icon:Music2,href:"/drag-race/lalaparuza"}
];
export function DragRaceHub({counts,canSync,lastSyncedAt,sourceVersion}:Props){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const supabase=useMemo(()=>createClient(),[]);
 async function sync(){setBusy(true);setMessage("");try{const {data,error}=await supabase.functions.invoke("drag-race-catalog-sync",{body:{force:true}});if(error)throw new Error(error.message||"Sincronizzazione non riuscita");setMessage(data.synced?("Catalogo aggiornato: "+data.queens+" Queen, "+data.seasons+" stagioni, "+data.lipsyncs+" lipsync."): "Catalogo già aggiornato o sincronizzazione in corso.");if(data.synced)window.location.reload();}catch(e){setMessage(e instanceof Error?e.message:"Errore di sincronizzazione");}finally{setBusy(false);}}
 return <main className="drag-race-page">
  <section className="drag-race-hero"><div className="drag-race-hero-copy"><span>RENQD ORIGINAL · MACRO-CATEGORIA</span><h1>RuPaul’s <em>Drag Race.</em></h1><p>Il mondo delle Queen, delle stagioni iconiche e delle lipsync battle. Crea, ricorda e mettiti alla prova.</p><div className="drag-race-hero-meta"><span><Crown size={15}/> 24 franchise previsti</span><span><Music2 size={15}/> Lipsync &amp; musica</span></div></div><div className="drag-race-hero-mark" aria-hidden="true"><b>DR</b><span>THE<br/>ART OF<br/>DRAG</span></div></section>
  <section className="drag-race-catalog"><div><span className="drag-race-kicker">CATALOGO CONDIVISO</span><h2>Un universo di <em>Queen.</em></h2><p>Dati strutturati con provenienza verificabile. Le lipsync senza metadati musicali completi restano fuori dalle estrazioni che richiedono una preview.</p></div>
   <div className="drag-race-stats">{[["Franchise",counts.franchises],["Queen",counts.queens],["Stagioni",counts.seasons],["Episodi",counts.episodes],["Lipsync",counts.lipsyncs],["Lipsync pronte",counts.eligible]].map(([label,value])=><div key={label}><strong>{Number(value).toLocaleString("it-IT")}</strong><small>{label}</small></div>)}</div>
   <div className="drag-race-sync-row"><span>Fonte dati v{sourceVersion} · {lastSyncedAt?"Ultima sincronizzazione "+new Date(lastSyncedAt).toLocaleString("it-IT"):"Catalogo non ancora sincronizzato"}</span>{canSync&&<button type="button" onClick={sync} disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:<RefreshCw size={16}/>} {busy?"Sincronizzazione…":"Sincronizza catalogo"}</button>}</div>{message&&<p className="drag-race-message" role="status">{message}</p>}
  </section>
  <section className="drag-race-modules"><div className="drag-race-section-heading"><span className="drag-race-kicker">LE ESPERIENZE</span><h2>La tua scena, <em>le tue regole.</em></h2></div><div className="drag-race-module-grid">{modules.map(({title,desc,icon:Icon,...module})=><article className="drag-race-module-card" key={title}><span className="drag-race-module-icon"><Icon size={22}/></span><div><h3>{title}</h3><p>{desc}</p></div>{"href" in module&&typeof module.href==="string"?<Link className="drag-race-module-status is-ready" href={module.href}>Apri <ArrowUpRight size={12}/></Link>:<span className="drag-race-module-status">In implementazione</span>}</article>)}</div></section>
  <div className="drag-race-back"><Link href="/home">← Torna alla Home</Link><span>RENQD · DRAG RACE</span></div>
 </main>;
}
