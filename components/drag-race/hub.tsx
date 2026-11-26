"use client";
import {useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import Link from "next/link";
import {ArrowUpRight,Crown,RefreshCw,Music2,Trophy,Users,Gamepad2,LoaderCircle} from "lucide-react";
type Props={canSync:boolean;lastSyncedAt:string|null;sourceVersion:string};
const modules=[
 {title:"Season Simulator",desc:"Crea il cast, assegna le challenge e vivi una stagione tutta tua.",tags:["CREA","SIMULA"],icon:Users,status:"IN ARRIVO"},
 {title:"Track Record",desc:"Costruisci la tua storia episodio dopo episodio e celebra le vincitrici.",tags:["PPE","HALL OF FAME"],icon:Trophy,href:"/drag-race/track-record",status:"DISPONIBILE"},
 {title:"Guess Them All",desc:"Riconosci le Queen dei franchise selezionati e completa la sfida.",tags:["QUIZ","QUEEN"],icon:Gamepad2,href:"/drag-race/guess-them-all",status:"DISPONIBILE"},
 {title:"Lalaparuza",desc:"Entra nella battaglia: Guess the Lipsync, Slayoff e Lipsync for Your Life.",tags:["MUSICA","BATTAGLIE"],icon:Music2,href:"/drag-race/lalaparuza",status:"DISPONIBILE"}
];
export function DragRaceHub({canSync,lastSyncedAt,sourceVersion}:Props){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const supabase=useMemo(()=>createClient(),[]);
 async function sync(){setBusy(true);setMessage("");try{const {data,error}=await supabase.functions.invoke("drag-race-catalog-sync",{body:{force:true}});if(error)throw new Error(error.message||"Sincronizzazione non riuscita");setMessage(data.synced?("Catalogo aggiornato: "+data.queens+" Queen, "+data.seasons+" stagioni, "+data.episodes+" episodi e "+data.trackRecordTemplates+" strutture Track Record."): "Catalogo già aggiornato o sincronizzazione in corso.");if(data.synced)window.location.reload();}catch(e){setMessage(e instanceof Error?e.message:"Errore di sincronizzazione");}finally{setBusy(false);}}
 return <main className="drag-race-page">
  <section className="world-hub-hero world-hub-drag">
   <div className="world-hub-copy"><span>RENQD × DRAG RACE</span><h1>Drag Race,<br/><em>the art of drag.</em></h1><p>La tua scena, le tue Queen, le tue regole. Crea, gioca e riscrivi ogni stagione.</p><div className="world-hub-tags"><i>QUEEN</i><i>LIPSYNC</i><i>CREATIVITÀ</i></div></div>
   <div className="world-hub-art world-hub-drag-art" aria-hidden="true"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Trixie_Mattel_Portrait.jpg/589px-Trixie_Mattel_Portrait.jpg" alt=""/><img src="https://commons.wikimedia.org/wiki/Special:FilePath/Naomi_Smalls_at_Rupaul%27s_Dragcon_2017_by_dvsross.jpg?width=512" alt=""/><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Mon%C3%A9t_X_Change_at_Dragcon_by_dvsross.jpg/512px-Mon%C3%A9t_X_Change_at_Dragcon_by_dvsross.jpg" alt=""/></div>
  </section>
  <section className="drag-race-modules"><div className="drag-race-section-heading"><span className="drag-race-kicker">SCEGLI LA TUA ESPERIENZA</span><h2>Entra in <em>scena.</em></h2></div><div className="drag-race-module-grid">{modules.map(({title,desc,tags,icon:Icon,href,status},index)=>{const card=<><span className="drag-race-module-index">0{index+1}</span><span className="drag-race-module-icon"><Icon size={22}/></span><span className="drag-race-module-copy"><strong>{title}</strong><small>{desc}</small><span className="drag-race-module-tags">{tags.map(tag=><i key={tag}>{tag}</i>)}</span></span><span className={"drag-race-module-status"+(href?" is-ready":"")}>{status}<ArrowUpRight size={14}/></span></>;return href?<Link className="drag-race-module-card" key={title} href={href}>{card}</Link>:<article className="drag-race-module-card is-coming" key={title} aria-label={title+" in arrivo"}>{card}</article>;})}</div></section>
  {canSync&&<details className="drag-race-staff-tools"><summary>Strumenti catalogo <span>Staff · v{sourceVersion} · {lastSyncedAt?"Ultima sincronizzazione "+new Date(lastSyncedAt).toLocaleString("it-IT"):"Non ancora sincronizzato"}</span></summary><div><p>La sincronizzazione aggiorna i dati condivisi necessari alle modalità Drag Race. Non mostra il catalogo nella navigazione principale.</p><button type="button" onClick={sync} disabled={busy}>{busy?<LoaderCircle className="spin" size={15}/>:<RefreshCw size={15}/>} {busy?"Sincronizzazione…":"Sincronizza catalogo"}</button>{message&&<small role="status">{message}</small>}</div></details>}
  <div className="drag-race-back"><Link href="/home">← Torna alla Home</Link></div>
 </main>;
}
