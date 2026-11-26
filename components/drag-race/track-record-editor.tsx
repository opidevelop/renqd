"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {ArrowLeft,Check,LoaderCircle,Save} from "lucide-react";
import {sortTrackRecordQueens,type TrackRecordData,type TrackRecordPlacementScore} from "@/lib/drag-race/track-record";
type Props={recordId:string;title:string;initialData:TrackRecordData;rules:TrackRecordPlacementScore[];canEdit:boolean};
export function TrackRecordEditor({recordId,title,initialData,rules,canEdit}:Props){
 const db=createClient();const [data,setData]=useState(initialData);const [saving,setSaving]=useState(false);const [savedAt,setSavedAt]=useState<string|null>(null);const [error,setError]=useState("");
 const sorted=useMemo(()=>sortTrackRecordQueens(data,rules),[data,rules]);
 async function updatePlacement(queenName:string,episode:number,placement:string){
  if(!canEdit)return;
  const next:TrackRecordData={...data,queens:data.queens.map(q=>q.name===queenName?{...q,results:q.results.some(x=>x.episode===episode)?q.results.map(x=>x.episode===episode?{...x,placement:placement||null}:x):[...q.results,{episode,placement:placement||null}]}:q)};
  setData(next);setSaving(true);setError("");
  const {error:e}=await db.from("drag_race_track_records").update({record_data:next,updated_at:new Date().toISOString()}).eq("id",recordId);
  setSaving(false);if(e)setError("Salvataggio non riuscito: "+e.message);else setSavedAt(new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));
 }
 const ppe=(v:number|null)=>v===null?"—":v.toFixed(2);
 return <main className="drag-race-page"><Link className="drag-back" href="/drag-race/track-record"><ArrowLeft size={16}/> Track Record</Link>
  <header className="drag-game-heading"><span>{data.franchise_code??"CUSTOM"} · STAGIONE {data.season_number??"—"}</span><h1>{title.split(" ").slice(0,-1).join(" ")} <em>{title.split(" ").slice(-1).join(" ")}</em></h1><p>{data.queens.length} Queen · {data.episodes.length} episodi · PPE calcolato automaticamente</p></header>
  <div className="drag-track-save-status">{saving?<><LoaderCircle className="spin" size={14}/> Salvataggio…</>:savedAt?<><Check size={14}/> Salvato alle {savedAt}</>:<><Save size={14}/> {canEdit?"Le modifiche vengono salvate automaticamente":"Sola lettura"}</>}{error&&<span>{error}</span>}</div>
  <section className="drag-track-table-wrap"><table className="drag-track-table"><thead><tr><th>#</th><th>Queen</th><th>PPE</th>{data.episodes.map(ep=><th key={ep.number}>{ep.number}<small>{ep.title}</small></th>)}</tr></thead><tbody>{sorted.map((queen,index)=><tr key={queen.id??queen.name} className={queen.eliminated?"is-eliminated":""}><td>{index+1}</td><td><strong>{queen.name}</strong>{queen.rank&&<small>Originale: {queen.rank}</small>}</td><td className="drag-track-ppe">{ppe(queen.ppe)}</td>{data.episodes.map(ep=>{const value=queen.results.find(x=>x.episode===ep.number)?.placement??"";const rule=rules.find(x=>x.placement_key===value);return <td key={ep.number}>{canEdit?<select aria-label={queen.name+" episodio "+ep.number} value={value} onChange={e=>void updatePlacement(queen.name,ep.number,e.target.value)} style={rule?{backgroundColor:rule.color}:undefined}><option value="">—</option>{value&&!rule&&<option value={value}>{value.trim()}</option>}{rules.map(x=><option key={x.placement_key} value={x.placement_key}>{x.label} · {Number(x.score).toFixed(1)}</option>)}</select>:<span>{value.trim()||"—"}</span>}</td>;})}</tr>)}</tbody></table></section>
  <p className="drag-track-footnote">I valori senza corrispondenza nelle regole PPE non contribuiscono alla media. Il risultato finale (Grand Finale) resta visibile ma non entra nel PPE.</p>
 </main>;
}
