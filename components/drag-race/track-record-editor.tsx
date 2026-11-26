"use client";
import {useMemo,useRef,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {ArrowLeft,Check,LoaderCircle,Save,Trophy} from "lucide-react";
import {sortTrackRecordQueens,type TrackRecordData,type TrackRecordPlacementScore} from "@/lib/drag-race/track-record";
type Props={recordId:string;title:string;visibility:"PUBLIC"|"PRIVATE";initialData:TrackRecordData;rules:TrackRecordPlacementScore[];canEdit:boolean};
export function TrackRecordEditor({recordId,title,visibility:initialVisibility,initialData,rules,canEdit}:Props){
 const db=createClient();const [data,setData]=useState(initialData);const dataRef=useRef(initialData);const saveQueue=useRef<Promise<void>>(Promise.resolve());const pendingSaves=useRef(0);const [saving,setSaving]=useState(false);const [savedAt,setSavedAt]=useState<string|null>(null);const [error,setError]=useState("");const [visibility,setVisibility]=useState(initialVisibility);const [visibilitySaving,setVisibilitySaving]=useState(false);
 const sorted=useMemo(()=>sortTrackRecordQueens(data,rules),[data,rules]);
 async function updateVisibility(nextVisibility:"PUBLIC"|"PRIVATE"){
  if(!canEdit||nextVisibility===visibility)return;
  const previous=visibility;setVisibility(nextVisibility);setVisibilitySaving(true);setError("");
  const {error:e}=await db.from("drag_race_track_records").update({visibility:nextVisibility,updated_at:new Date().toISOString()}).eq("id",recordId);
  if(e){setVisibility(previous);setError("Visibilità non aggiornata: "+e.message);}
  setVisibilitySaving(false);
 }
 async function persist(next:TrackRecordData){
  dataRef.current=next;setData(next);setError("");pendingSaves.current+=1;setSaving(true);
  const queued=saveQueue.current.catch(()=>undefined).then(async()=>{
   const {error:e}=await db.from("drag_race_track_records").update({record_data:next,updated_at:new Date().toISOString()}).eq("id",recordId);
   if(e)throw new Error(e.message);
  });
  saveQueue.current=queued;
  try{await queued;setSavedAt(new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));}
  catch(e){setError("Salvataggio non riuscito: "+(e instanceof Error?e.message:"errore sconosciuto"));}
  finally{pendingSaves.current=Math.max(0,pendingSaves.current-1);if(pendingSaves.current===0)setSaving(false);}
 }
 async function updatePlacement(queenKey:string,episode:number,placement:string){
  if(!canEdit)return;
  const base=dataRef.current;
  const next:TrackRecordData={...base,queens:base.queens.map(q=>(q.id??q.name)===queenKey?{...q,results:q.results.some(x=>x.episode===episode)?q.results.map(x=>x.episode===episode?{...x,placement:placement||null}:x):[...q.results,{episode,placement:placement||null}]}:q)};
  await persist(next);
 }
 async function toggleWinner(queenKey:string){
  if(!canEdit)return;
  const base=dataRef.current;
  const next:TrackRecordData={...base,queens:base.queens.map(q=>(q.id??q.name)===queenKey?{...q,winner:!q.winner}:q)};
  await persist(next);
 }
 const ppe=(v:number|null)=>v===null?"—":v.toFixed(2);
 return <main className="drag-race-page"><Link className="drag-back" href="/drag-race/track-record"><ArrowLeft size={16}/> Track Record</Link>
  <header className="drag-game-heading"><span>{data.franchise_code??"CUSTOM"} · STAGIONE {data.season_number??"—"}</span><h1>{title.split(" ").slice(0,-1).join(" ")} <em>{title.split(" ").slice(-1).join(" ")}</em></h1><p>{data.queens.length} Queen · {data.episodes.length} episodi · PPE calcolato automaticamente</p></header>
  <div className="drag-track-save-status"><span className="drag-track-visibility">{canEdit?<><label htmlFor="drag-track-visibility">Visibilità</label><select id="drag-track-visibility" value={visibility} disabled={visibilitySaving} onChange={e=>void updateVisibility(e.target.value as "PUBLIC"|"PRIVATE")}><option value="PUBLIC">Pubblica</option><option value="PRIVATE">Privata</option></select></>:<span>{visibility==="PUBLIC"?"Pubblica":"Privata"}</span>}</span>{saving?<><LoaderCircle className="spin" size={14}/> Salvataggio…</>:savedAt?<><Check size={14}/> Salvato alle {savedAt}</>:<><Save size={14}/> {canEdit?"Le modifiche vengono salvate automaticamente":"Sola lettura"}</>}{error&&<span>{error}</span>}</div>
  {data.source_metadata?.source_url&&<p className="drag-track-footnote">Fonte: <a href={data.source_metadata.source_url} target="_blank" rel="noreferrer">{data.source_metadata.source_id??"Catalogo Drag Race"}</a>{data.source_metadata.source_version?" · "+data.source_metadata.source_version:""}</p>}
  {data.source_metadata?.wikimedia_source_url&&<p className="drag-track-footnote">Placement verificati su <a href={data.source_metadata.wikimedia_source_url} target="_blank" rel="noreferrer">{data.source_metadata.wikimedia_page_title??"Wikipedia"}</a>{data.source_metadata.wikimedia_license?" · ":""}{data.source_metadata.wikimedia_license&&data.source_metadata.wikimedia_license_url?<a href={data.source_metadata.wikimedia_license_url} target="_blank" rel="noreferrer">{data.source_metadata.wikimedia_license}</a>:data.source_metadata.wikimedia_license}{data.source_metadata.wikimedia_revision_id?" · Revisione "+data.source_metadata.wikimedia_revision_id:""}{data.source_metadata.wikimedia_author?" · "+data.source_metadata.wikimedia_author:""}</p>}
  <section className="drag-track-table-wrap"><table className="drag-track-table"><thead><tr><th>#</th><th>Queen</th><th>PPE</th>{data.episodes.map(ep=><th key={ep.number}>{ep.number}<small>{ep.title}</small></th>)}</tr></thead><tbody>{sorted.map((queen,index)=><tr key={queen.id??queen.name} className={queen.eliminated?"is-eliminated":""}><td>{index+1}</td><td><strong>{queen.name}</strong>{queen.rank&&<small>Originale: {queen.rank}</small>}{canEdit?<button type="button" className={"drag-track-winner-toggle"+(queen.winner?" is-winner":"")} aria-pressed={Boolean(queen.winner)} onClick={()=>void toggleWinner(queen.id??queen.name)}><Trophy size={12}/>{queen.winner?"Vincitrice":"Segna vincitrice"}</button>:queen.winner&&<small className="drag-track-winner-label">Vincitrice</small>}</td><td className="drag-track-ppe">{ppe(queen.ppe)}</td>{data.episodes.map(ep=>{const result=queen.results.find(x=>x.episode===ep.number);const value=result?.placement??"";const rule=rules.find(x=>x.placement_key===value);const facts=result?.facts;const factLabels=[facts?.mini_challenge_winner?"Mini win":null,facts?.maxi_challenge_winner?"Maxi win":null,facts?.listed_top?"Top":null,facts?.listed_bottom?"Bottom":null,facts?.lipsync_participant?"Lipsync":null,facts?.lipsync_winner?"LS win":null,facts?.lipsync_eliminated?"LS elim":null].filter(Boolean);return <td key={ep.number} title={factLabels.join(" · ")||undefined}>{canEdit?<><select aria-label={queen.name+" episodio "+ep.number} value={value} onChange={e=>void updatePlacement(queen.id??queen.name,ep.number,e.target.value)} style={rule?{backgroundColor:rule.color}:undefined}><option value="">—</option>{value&&!rule&&<option value={value}>{value.trim()}</option>}{rules.map(x=><option key={x.placement_key} value={x.placement_key}>{x.label} · {Number(x.score).toFixed(1)}</option>)}</select>{factLabels.length>0&&<small className="drag-track-source-facts">{factLabels.join(" · ")}</small>}</>:<><span>{value.trim()||"—"}</span>{factLabels.length>0&&<small className="drag-track-source-facts">{factLabels.join(" · ")}</small>}</>}</td>;})}</tr>)}</tbody></table></section>
  <p className="drag-track-footnote">I valori senza corrispondenza nelle regole PPE non contribuiscono alla media. I dati automatici riportano challenge, posizioni top/bottom e lipsync quando disponibili nella fonte. Questi fatti non vengono trasformati automaticamente in placement PPE: soltanto le eliminazioni esplicite sono precompilate. Le celle vuote indicano dati non disponibili o da completare, non un SAFE.</p>
 </main>;
}
