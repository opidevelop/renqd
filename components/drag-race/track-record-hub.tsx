"use client";
import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import {ArrowLeft,ArrowUpRight,Copy,FilePlus,LoaderCircle,Trophy} from "lucide-react";
type Template={id:string;franchise_code:string;season_number:number;display_title:string;year:number|null;season_id:string|null;episodes:any[];queens:any[]};
type RecordItem={id:string;title:string;season_id:string|null;visibility:string;updated_at:string;record_data:any};
type Props={userId:string;templates:Template[];records:RecordItem[];franchiseNames:Record<string,string>};
export function TrackRecordHub({userId,templates,records,franchiseNames}:Props){
 const router=useRouter();const db=createClient();const [busy,setBusy]=useState<string|null>(null);const [notice,setNotice]=useState("");
 async function copyTemplate(template:Template){
  setBusy(template.id);setNotice("");
  const record_data={franchise_code:template.franchise_code,season_number:template.season_number,year:template.year,episodes:template.episodes,queens:template.queens,source_template_id:template.id,custom_placements:[]};
  const {data,error}=await db.from("drag_race_track_records").insert({owner_id:userId,season_id:template.season_id,title:template.display_title,visibility:"PUBLIC",record_data,is_official:false}).select("id").single();
  if(error){setNotice("Non è stato possibile creare la scheda: "+error.message);setBusy(null);return;}
  router.push("/drag-race/track-record/"+data.id);
 }
 return <main className="drag-race-page"><Link className="drag-back" href="/drag-race"><ArrowLeft size={16}/> Drag Race</Link>
  <header className="drag-game-heading"><span>RUPAUL’S DRAG RACE · ARCHIVIO</span><h1>Track <em>Record.</em></h1><p>Le schede delle stagioni, il PPE e la Hall of Fame. Parti da una scheda ufficiale o continua il tuo archivio personale.</p></header>
  {notice&&<p className="drag-notice">{notice}</p>}
  <section className="drag-track-section"><div className="drag-track-section-head"><div><span>ARCHIVIO UFFICIALE</span><h2>Stagioni disponibili</h2></div><Trophy size={22}/></div>
   {templates.length? <div className="drag-track-template-grid">{templates.map(t=><article key={t.id} className="drag-track-card"><small>{franchiseNames[t.franchise_code]??t.franchise_code} · Stagione {t.season_number}</small><h3>{t.display_title}</h3><p>{t.queens?.length??0} Queen · {t.episodes?.length??0} episodi{t.year?" · "+t.year:""}</p><button disabled={busy!==null} onClick={()=>copyTemplate(t)}>{busy===t.id?<LoaderCircle className="spin" size={15}/>:<Copy size={15}/>} Crea la tua scheda</button></article>)}</div>:<div className="drag-track-empty"><strong>Le schede ufficiali non sono ancora state importate.</strong><p>Il workbook è stato analizzato e le regole PPE sono già nel database. L’importazione dei 90 fogli stagione è il passaggio successivo.</p></div>}
  </section>
  <section className="drag-track-section"><div className="drag-track-section-head"><div><span>IL TUO ARCHIVIO</span><h2>Le tue schede</h2></div><FilePlus size={22}/></div>
   {records.length?<div className="drag-track-record-list">{records.map(r=><Link key={r.id} href={"/drag-race/track-record/"+r.id} className="drag-track-record-row"><div><strong>{r.title}</strong><small>{r.visibility==="PUBLIC"?"Pubblica":"Privata"} · Modificata {new Date(r.updated_at).toLocaleDateString("it-IT")}</small></div><ArrowUpRight size={17}/></Link>)}</div>:<div className="drag-track-empty"><strong>Non hai ancora creato una scheda.</strong><p>Le copie delle schede ufficiali compariranno qui e potranno essere modificate senza alterare il modello condiviso.</p></div>}
  </section>
 </main>;
}
