"use client";
import {useMemo,useRef,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {ArrowLeft,Check,LoaderCircle,Save,Trophy,Plus,Trash2,X} from "lucide-react";
import {sortTrackRecordQueens,type TrackRecordData,type TrackRecordPlacementScore,type TrackRecordQueen} from "@/lib/drag-race/track-record";

type CatalogQueen={id:string;name:string;aliases:string[];image_url:string|null};
type Props={recordId:string;title:string;visibility:"PUBLIC"|"PRIVATE";initialData:TrackRecordData;rules:TrackRecordPlacementScore[];canEdit:boolean;catalogQueens:CatalogQueen[]};
type PendingRemoval={type:"queen";key:string}|{type:"episode";key:number};

export function TrackRecordEditor({recordId,title,visibility:initialVisibility,initialData,rules,canEdit,catalogQueens}:Props){
 const db=createClient();
 const [data,setData]=useState(initialData);
 const dataRef=useRef(initialData);
 const saveQueue=useRef<Promise<void>>(Promise.resolve());
 const pendingSaves=useRef(0);
 const [saving,setSaving]=useState(false);
 const [savedAt,setSavedAt]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [visibility,setVisibility]=useState(initialVisibility);
 const [visibilitySaving,setVisibilitySaving]=useState(false);
 const [recordTitle,setRecordTitle]=useState(title);const savedTitle=useRef(title);
 const [titleSaving,setTitleSaving]=useState(false);
 const [pendingRemoval,setPendingRemoval]=useState<PendingRemoval|null>(null);
 const [queenSearch,setQueenSearch]=useState("");
 const [customQueenName,setCustomQueenName]=useState("");
 const [customQueenImage,setCustomQueenImage]=useState("");
 const [customPlacementLabel,setCustomPlacementLabel]=useState("");
 const [customPlacementScore,setCustomPlacementScore]=useState("1");
 const [customPlacementColor,setCustomPlacementColor]=useState("#8b8580");

 const availableRules=useMemo(()=>[...rules,...(data.custom_placements??[]).map((x,index)=>({...x,sort_order:1000+index}))],[rules,data.custom_placements]);
 const sorted=useMemo(()=>sortTrackRecordQueens(data,rules),[data,rules]);
 const filteredQueenOptions=useMemo(()=>{
  const term=queenSearch.trim().toLowerCase();
  if(!term)return [];
  return catalogQueens.filter(q=>q.name.toLowerCase().includes(term)||(q.aliases??[]).some(alias=>alias.toLowerCase().includes(term))).slice(0,12);
 },[catalogQueens,queenSearch]);
 const ppe=(value:number|null)=>value===null?"—":value.toFixed(2);

 async function persistData(next:TrackRecordData){
  dataRef.current=next;setData(next);setError("");pendingSaves.current+=1;setSaving(true);
  const queued=saveQueue.current.catch(()=>undefined).then(async()=>{
   const {error:saveError}=await db.from("drag_race_track_records").update({record_data:next,updated_at:new Date().toISOString()}).eq("id",recordId);
   if(saveError)throw new Error(saveError.message);
  });
  saveQueue.current=queued;
  try{await queued;setSavedAt(new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));}
  catch(saveError){setError("Salvataggio non riuscito: "+(saveError instanceof Error?saveError.message:"errore sconosciuto"));}
  finally{pendingSaves.current=Math.max(0,pendingSaves.current-1);if(pendingSaves.current===0)setSaving(false);}
 }
 async function updateVisibility(nextVisibility:"PUBLIC"|"PRIVATE"){
  if(!canEdit||nextVisibility===visibility)return;
  const previous=visibility;setVisibility(nextVisibility);setVisibilitySaving(true);setError("");
  const {error:updateError}=await db.from("drag_race_track_records").update({visibility:nextVisibility,updated_at:new Date().toISOString()}).eq("id",recordId);
  if(updateError){setVisibility(previous);setError("Visibilità non aggiornata: "+updateError.message);}
  setVisibilitySaving(false);
 }
 async function updateTitle(){
  const nextTitle=recordTitle.trim();
  if(!canEdit||!nextTitle||nextTitle===savedTitle.current)return;
  if(nextTitle.length>120){setError("Il titolo può contenere al massimo 120 caratteri.");setRecordTitle(title);return;}
  setTitleSaving(true);setError("");
  const {error:updateError}=await db.from("drag_race_track_records").update({title:nextTitle,updated_at:new Date().toISOString()}).eq("id",recordId);
  if(updateError){setError("Titolo non aggiornato: "+updateError.message);setRecordTitle(title);}
  setTitleSaving(false);
 }
 async function updatePlacement(queenKey:string,episode:number,placement:string){
  if(!canEdit)return;
  const base=dataRef.current;
  const next:TrackRecordData={...base,queens:base.queens.map(q=>(q.id??q.name)===queenKey?{...q,results:q.results.some(x=>x.episode===episode)?q.results.map(x=>x.episode===episode?{...x,placement:placement||null}:x):[...q.results,{episode,placement:placement||null}]}:q)};
  await persistData(next);
 }
 async function toggleWinner(queenKey:string){
  if(!canEdit)return;
  const base=dataRef.current;
  const next:TrackRecordData={...base,queens:base.queens.map(q=>(q.id??q.name)===queenKey?{...q,winner:!q.winner}:q)};
  await persistData(next);
 }
 async function updateEpisodeTitle(episode:number,titleValue:string){
  if(!canEdit)return;
  const next:TrackRecordData={...dataRef.current,episodes:dataRef.current.episodes.map(ep=>ep.number===episode?{...ep,title:titleValue.trim()||("Episodio "+episode)}:ep)};
  await persistData(next);
 }
 async function toggleEpisodePpe(episode:number,counts:boolean){
  if(!canEdit)return;
  const next:TrackRecordData={...dataRef.current,episodes:dataRef.current.episodes.map(ep=>ep.number===episode?{...ep,counts_for_ppe:counts}:ep)};
  await persistData(next);
 }
 async function addEpisode(){
  if(!canEdit||dataRef.current.episodes.length>=50)return;
  const number=Math.max(0,...dataRef.current.episodes.map(ep=>ep.number))+1;
  const next:TrackRecordData={...dataRef.current,episodes:[...dataRef.current.episodes,{number,title:"Episodio "+number,counts_for_ppe:true}],queens:dataRef.current.queens.map(q=>({...q,results:[...q.results,{episode:number,placement:null}]}))};
  await persistData(next);
 }
 function requestRemoveQueen(key:string){setPendingRemoval({type:"queen",key});}
 function requestRemoveEpisode(number:number){setPendingRemoval({type:"episode",key:number});}
 async function confirmRemoval(){
  if(!canEdit||!pendingRemoval)return;
  const base=dataRef.current;
  const next:TrackRecordData=pendingRemoval.type==="queen"
   ?{...base,queens:base.queens.filter(q=>(q.id??q.name)!==pendingRemoval.key)}
   :{...base,episodes:base.episodes.filter(ep=>ep.number!==pendingRemoval.key),queens:base.queens.map(q=>({...q,results:q.results.filter(result=>result.episode!==pendingRemoval.key),ppe_episode_numbers:q.ppe_episode_numbers?.filter(number=>number!==pendingRemoval.key)}))};
  setPendingRemoval(null);await persistData(next);
 }
 async function addCatalogQueen(queen:CatalogQueen){
  if(!canEdit||dataRef.current.queens.some(q=>q.id===queen.id))return;
  const results=dataRef.current.episodes.map(ep=>({episode:ep.number,placement:null}));
  await persistData({...dataRef.current,queens:[...dataRef.current.queens,{id:queen.id,name:queen.name,image_url:queen.image_url,rank:null,winner:false,results}]});
  setQueenSearch("");
 }
 async function addCustomQueen(){
  const name=customQueenName.trim();if(!canEdit||!name)return;
  let imageUrl:string|null=null;
  if(customQueenImage.trim()){
   try{const parsed=new URL(customQueenImage.trim());if(!["http:","https:"].includes(parsed.protocol))throw new Error();imageUrl=parsed.toString();}
   catch{setError("L’immagine deve essere un URL HTTP o HTTPS valido.");return;}
  }
  if(dataRef.current.queens.some(q=>q.name.toLowerCase()===name.toLowerCase())){setError("Esiste già una Queen con questo nome nella scheda.");return;}
  const queen:TrackRecordQueen={id:"custom-"+crypto.randomUUID(),name,image_url:imageUrl,rank:null,winner:false,results:dataRef.current.episodes.map(ep=>({episode:ep.number,placement:null}))};
  await persistData({...dataRef.current,queens:[...dataRef.current.queens,queen]});
  setCustomQueenName("");setCustomQueenImage("");
 }
 async function addCustomPlacement(){
  const label=customPlacementLabel.trim(),score=Number(customPlacementScore);
  if(!canEdit||!label||!Number.isFinite(score)){setError("Inserisci nome e punteggio validi per il placement custom.");return;}
  const placement={placement_key:"CUSTOM:"+crypto.randomUUID(),label,score,color:customPlacementColor};
  await persistData({...dataRef.current,custom_placements:[...(dataRef.current.custom_placements??[]),placement]});
  setCustomPlacementLabel("");
 }
 async function removeCustomPlacement(key:string){
  if(!canEdit)return;
  await persistData({...dataRef.current,custom_placements:(dataRef.current.custom_placements??[]).filter(x=>x.placement_key!==key),queens:dataRef.current.queens.map(q=>({...q,results:q.results.map(result=>result.placement===key?{...result,placement:null}:result)}))});
 }

 return <main className="drag-race-page">
  <Link className="drag-back" href="/drag-race/track-record"><ArrowLeft size={16}/> Track Record</Link>
  <header className="drag-game-heading">
   <span>{data.franchise_code??"CUSTOM"} · STAGIONE {data.season_number??"—"}</span>
   {canEdit?<input className="drag-track-title-input" aria-label="Titolo della scheda" value={recordTitle} onChange={e=>setRecordTitle(e.target.value)} onBlur={()=>void updateTitle()} maxLength={120}/>:<h1>{recordTitle}</h1>}
   <p>{data.queens.length} Queen · {data.episodes.length} episodi · PPE calcolato automaticamente{titleSaving?" · Salvataggio titolo…":""}</p>
  </header>
  <div className="drag-track-save-status">
   <span className="drag-track-visibility">{canEdit?<><label htmlFor="drag-track-visibility">Visibilità</label><select id="drag-track-visibility" value={visibility} disabled={visibilitySaving} onChange={e=>void updateVisibility(e.target.value as "PUBLIC"|"PRIVATE")}><option value="PUBLIC">Pubblica</option><option value="PRIVATE">Privata</option></select></>:<span>{visibility==="PUBLIC"?"Pubblica":"Privata"}</span>}</span>
   {saving?<><LoaderCircle className="spin" size={14}/> Salvataggio…</>:savedAt?<><Check size={14}/> Salvato alle {savedAt}</>:<><Save size={14}/> {canEdit?"Le modifiche vengono salvate automaticamente":"Sola lettura"}</>}
   {error&&<span>{error}</span>}
  </div>
  {data.source_metadata?.source_url&&<p className="drag-track-footnote">Fonte: <a href={data.source_metadata.source_url} target="_blank" rel="noreferrer">{data.source_metadata.source_id??"Catalogo Drag Race"}</a>{data.source_metadata.source_version?" · "+data.source_metadata.source_version:""}</p>}

  {canEdit&&<section className="drag-track-section drag-track-editor-tools">
   <div className="drag-track-section-head"><div><span>ROSTER</span><h2>Gestisci le Queen</h2></div></div>
   <div className="drag-track-roster-add"><div><input value={queenSearch} onChange={e=>setQueenSearch(e.target.value)} placeholder="Cerca una Queen nel catalogo"/>{queenSearch.trim()&&<div className="drag-track-roster-options">{filteredQueenOptions.map(q=><button type="button" key={q.id} disabled={data.queens.some(existing=>existing.id===q.id)} onClick={()=>void addCatalogQueen(q)}>{q.name}{data.queens.some(existing=>existing.id===q.id)?" · già presente":" · Aggiungi"}</button>)}{filteredQueenOptions.length===0&&<small>Nessuna Queen trovata nel catalogo.</small>}</div>}</div>
    <div className="drag-track-custom-queen-inline"><input value={customQueenName} onChange={e=>setCustomQueenName(e.target.value)} placeholder="Nome Queen custom"/><input type="url" value={customQueenImage} onChange={e=>setCustomQueenImage(e.target.value)} placeholder="URL immagine facoltativo"/><button type="button" onClick={()=>void addCustomQueen()}><Plus size={14}/> Aggiungi custom</button></div>
   </div>
   <div className="drag-track-custom-placement"><strong>Placement personalizzati</strong><div><input value={customPlacementLabel} onChange={e=>setCustomPlacementLabel(e.target.value)} placeholder="Nome placement"/><input type="number" step="0.1" min="-100" max="100" value={customPlacementScore} onChange={e=>setCustomPlacementScore(e.target.value)} aria-label="Punteggio PPE"/><input type="color" value={customPlacementColor} onChange={e=>setCustomPlacementColor(e.target.value)} aria-label="Colore placement"/><button type="button" onClick={()=>void addCustomPlacement()}><Plus size={14}/> Aggiungi</button></div>{(data.custom_placements??[]).map(rule=><span key={rule.placement_key} style={{backgroundColor:rule.color}}>{rule.label} · {rule.score.toFixed(1)}<button type="button" aria-label={"Rimuovi "+rule.label} onClick={()=>void removeCustomPlacement(rule.placement_key)}><X size={12}/></button></span>)}</div>
  </section>}

  {pendingRemoval&&<div className="drag-track-confirm-remove"><span>{pendingRemoval.type==="queen"?"Rimuovere questa Queen e tutti i suoi risultati?":"Rimuovere questo episodio e i relativi risultati?"}</span><button type="button" onClick={()=>setPendingRemoval(null)}>Annulla</button><button type="button" onClick={()=>void confirmRemoval()}>Conferma</button></div>}
  {canEdit&&<div className="drag-track-add-episode"><button type="button" onClick={()=>void addEpisode()} disabled={data.episodes.length>=50}><Plus size={14}/> Aggiungi episodio</button></div>}
  <section className="drag-track-table-wrap"><table className="drag-track-table"><thead><tr><th>#</th><th>Queen</th><th>PPE</th>{data.episodes.map(ep=><th key={ep.number}><span>{ep.number}</span>{canEdit?<><input className="drag-track-episode-title" aria-label={"Titolo episodio "+ep.number} defaultValue={ep.title} onBlur={e=>void updateEpisodeTitle(ep.number,e.target.value)}/><label className="drag-track-episode-ppe"><input type="checkbox" checked={ep.counts_for_ppe!==false} onChange={e=>void toggleEpisodePpe(ep.number,e.target.checked)}/> PPE</label><button type="button" className="drag-track-remove-episode" aria-label={"Rimuovi episodio "+ep.number} onClick={()=>requestRemoveEpisode(ep.number)}><X size={11}/></button></>:<small>{ep.title}</small>}{(ep.mini_challenge||ep.maxi_challenge||ep.lip_sync_song)&&<div className="drag-track-episode-challenges">{ep.mini_challenge&&<small>Mini: {ep.mini_challenge}</small>}{ep.maxi_challenge&&<small>Maxi: {ep.maxi_challenge}</small>}{ep.lip_sync_song&&<small>Lipsync: {ep.lip_sync_song}</small>}</div>}</th>)}</tr></thead><tbody>{sorted.map((queen,index)=><tr key={queen.id??queen.name} className={queen.eliminated?"is-eliminated":""}><td>{index+1}</td><td><strong>{queen.name}</strong>{canEdit?<><button type="button" className={"drag-track-winner-toggle"+(queen.winner?" is-winner":"")} aria-pressed={Boolean(queen.winner)} onClick={()=>void toggleWinner(queen.id??queen.name)}><Trophy size={12}/>{queen.winner?"Vincitrice":"Segna vincitrice"}</button><button type="button" className="drag-track-remove-queen" onClick={()=>requestRemoveQueen(queen.id??queen.name)}><Trash2 size={11}/> Rimuovi</button></>:queen.winner&&<small className="drag-track-winner-label">Vincitrice</small>}</td><td className="drag-track-ppe">{ppe(queen.ppe)}</td>{data.episodes.map(ep=>{const result=queen.results.find(x=>x.episode===ep.number);const value=result?.placement??"";const rule=availableRules.find(x=>x.placement_key===value);return <td key={ep.number}>{canEdit?<select aria-label={queen.name+" episodio "+ep.number} value={value} onChange={e=>void updatePlacement(queen.id??queen.name,ep.number,e.target.value)} style={rule?{backgroundColor:rule.color}:undefined}><option value="">—</option>{value&&!rule&&<option value={value}>{value.trim()}</option>}{availableRules.map(x=><option key={x.placement_key} value={x.placement_key}>{x.label} · {Number(x.score).toFixed(1)}{x.placement_key.startsWith("CUSTOM:")?" · Custom":""}</option>)}</select>:<span>{value.trim()||"—"}</span>}</td>;}</tr>)}</tbody></table></section>
  <p className="drag-track-footnote">Tutti i placement e la vincitrice sono scelti manualmente. La struttura della stagione (cast, episodi e challenge) proviene dal catalogo; nessun risultato ufficiale viene importato. Le celle vuote non equivalgono a SAFE e non contribuiscono al PPE.</p>
 </main>;
}
