"use client";
import {useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {toPng} from "html-to-image";
import Link from "next/link";
import Image from "next/image";
import {createClient} from "@/lib/supabase/client";
import {ArrowLeft,Check,Download,FileSpreadsheet,FileText,Image as ImageIcon,LoaderCircle,Save,Share2,Trophy,Plus,Trash2,X} from "lucide-react";
import {Dialog} from "@/components/ui/dialog";
import {sortTrackRecordQueens,type TrackRecordData,type TrackRecordPlacementScore,type TrackRecordQueen} from "@/lib/drag-race/track-record";
import {TrackRecordSocial} from "@/components/drag-race/track-record-social";

type CatalogQueen={id:string;name:string;aliases:string[];image_url:string|null};
type Props={recordId:string;title:string;visibility:"PUBLIC"|"PRIVATE";initialData:TrackRecordData;rules:TrackRecordPlacementScore[];canEdit:boolean;catalogQueens:CatalogQueen[];userId:string;ownerId:string;canModerateComments:boolean;socialEnabled:boolean};
type PendingRemoval={type:"queen";key:string}|{type:"episode";key:number};

export function TrackRecordEditor({recordId,title,visibility:initialVisibility,initialData,rules,canEdit,catalogQueens,userId,ownerId,canModerateComments,socialEnabled}:Props){
 const db=createClient();const router=useRouter();const exportRef=useRef<HTMLDivElement|null>(null);
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
 const [deleteOpen,setDeleteOpen]=useState(false);const [deleteBusy,setDeleteBusy]=useState(false);const [shareNotice,setShareNotice]=useState("");const [exportBusy,setExportBusy]=useState(false);

 const availableRules=useMemo(()=>[...rules,...(data.custom_placements??[]).map((x,index)=>({...x,sort_order:1000+index}))],[rules,data.custom_placements]);
 const sorted=useMemo(()=>sortTrackRecordQueens(data,rules),[data,rules]);
 const filteredQueenOptions=useMemo(()=>{
  const term=queenSearch.trim().toLowerCase();
  if(!term)return [];
  return catalogQueens.filter(q=>q.name.toLowerCase().includes(term)||(q.aliases??[]).some(alias=>alias.toLowerCase().includes(term))).slice(0,12);
 },[catalogQueens,queenSearch]);
 const ppe=(value:number|null)=>value===null?"—":value.toFixed(2);
 const summary=useMemo(()=>{const results=data.queens.flatMap(queen=>queen.results).filter(result=>Boolean(result.placement));const ppeValues=sorted.map(queen=>queen.ppe).filter((value):value is number=>value!==null);return {placements:results.length,winners:data.queens.filter(queen=>queen.winner).length,eliminated:sorted.filter(queen=>queen.eliminated).length,averagePpe:ppeValues.length?ppeValues.reduce((sum,value)=>sum+value,0)/ppeValues.length:null};},[data,sorted]);
 const placementCounts=useMemo(()=>{const counts=new Map<string,number>();for(const queen of data.queens)for(const result of queen.results)if(result.placement)counts.set(result.placement,(counts.get(result.placement)??0)+1);return [...counts.entries()].sort((a,b)=>b[1]-a[1]);},[data.queens]);

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
  const current=base.queens.find(q=>(q.id??q.name)===queenKey);
  const next:TrackRecordData={...base,queens:base.queens.map(q=>({...q,winner:(q.id??q.name)===queenKey?!current?.winner:false}))};
  await persistData(next);
 }
 async function updateEliminationOrder(queenKey:string,value:string){
  if(!canEdit)return;
  const order=value.trim()?Number(value):null;
  if(order!==null&&(!Number.isInteger(order)||order<1))return;
  const next:TrackRecordData={...dataRef.current,queens:dataRef.current.queens.map(q=>(q.id??q.name)===queenKey?{...q,elimination_tie_order:order}:q)};
  await persistData(next);
 }
 async function updateEpisodeTitle(episode:number,titleValue:string){
  if(!canEdit)return;
  const next:TrackRecordData={...dataRef.current,episodes:dataRef.current.episodes.map(ep=>ep.number===episode?{...ep,title:titleValue.trim()||("Episodio "+episode)}:ep)};
  await persistData(next);
 }
 async function toggleEpisodePpe(episode:number,counts:boolean){
  if(!canEdit)return;
  const base=dataRef.current;const next:TrackRecordData={...base,episodes:base.episodes.map(ep=>ep.number===episode?{...ep,counts_for_ppe:counts}:ep),queens:base.queens.map(q=>{const eligible=q.ppe_episode_numbers??base.episodes.filter(ep=>ep.counts_for_ppe!==false).map(ep=>ep.number);return {...q,ppe_episode_numbers:counts?[...new Set([...eligible,episode])]:eligible.filter(number=>number!==episode)};})};
  await persistData(next);
 }
 async function addEpisode(){
  if(!canEdit||dataRef.current.episodes.length>=50)return;
  const number=Math.max(0,...dataRef.current.episodes.map(ep=>ep.number))+1;
  const next:TrackRecordData={...dataRef.current,episodes:[...dataRef.current.episodes,{number,title:"Episodio "+number,counts_for_ppe:true}],queens:dataRef.current.queens.map(q=>({...q,results:[...q.results,{episode:number,placement:null}],ppe_episode_numbers:[...new Set([...(q.ppe_episode_numbers??dataRef.current.episodes.filter(ep=>ep.counts_for_ppe!==false).map(ep=>ep.number)),number])]}))};
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
  await persistData({...dataRef.current,queens:[...dataRef.current.queens,{id:queen.id,name:queen.name,image_url:queen.image_url,winner:false,results}]});
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
  const queen:TrackRecordQueen={id:"custom-"+crypto.randomUUID(),name,image_url:imageUrl,winner:false,results:dataRef.current.episodes.map(ep=>({episode:ep.number,placement:null}))};
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
 function exportMatrix(){
  const headers=["Queen","PPE","Vincitrice","Eliminazione",...data.episodes.map(ep=>[ep.number,ep.title,ep.mini_challenge?"Mini: "+ep.mini_challenge:"",ep.maxi_challenge?"Maxi: "+ep.maxi_challenge:"",ep.lip_sync_song?"Lipsync: "+ep.lip_sync_song:""].filter(Boolean).join(" · "))];
  return [headers,...sorted.map(queen=>[queen.name,queen.ppe??"",queen.winner?"Sì":"No",queen.elimination_episode??"",...data.episodes.map(ep=>queen.results.find(result=>result.episode===ep.number)?.placement??"")])];
 }
 function fileBase(){return (recordTitle||"track-record").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"track-record";}
 function downloadFile(filename:string,content:string,type:string){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);}
 function exportCsv(){const csv=exportMatrix().map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(";")).join("\r\n");downloadFile(fileBase()+".csv","\uFEFF"+csv,"text/csv;charset=utf-8");}
 function exportExcel(){const xmlEscape=(value:unknown)=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");const rows=exportMatrix().map(row=>"<Row>"+row.map(value=>{const numeric=typeof value==="number"&&Number.isFinite(value);return '<Cell><Data ss:Type="'+(numeric?"Number":"String")+'">'+xmlEscape(value)+'</Data></Cell>';}).join("")+"</Row>").join("");const xml='<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Track Record"><Table>'+rows+"</Table></Worksheet></Workbook>";downloadFile(fileBase()+".xls",xml,"application/vnd.ms-excel;charset=utf-8");}
 async function exportPng(){if(!exportRef.current||exportBusy)return;setExportBusy(true);setError("");try{const image=await toPng(exportRef.current,{cacheBust:true,pixelRatio:2});const anchor=document.createElement("a");anchor.href=image;anchor.download=fileBase()+".png";anchor.click();}catch(e){setError("Esportazione PNG non riuscita: "+(e instanceof Error?e.message:"errore sconosciuto"));}finally{setExportBusy(false);}}
 async function shareRecord(){if(visibility!=="PUBLIC"||!socialEnabled)return;const url=window.location.href;try{if(navigator.share)await navigator.share({title:recordTitle,url});else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);else{const field=document.createElement("textarea");field.value=url;document.body.appendChild(field);field.select();document.execCommand("copy");field.remove();}setShareNotice("Link della Track Record copiato o condiviso.");}catch(e){if(e instanceof Error&&e.name==="AbortError")return;setError("Non è stato possibile condividere il link.");}}
 async function deleteRecord(){if(!canEdit||deleteBusy)return;setDeleteBusy(true);setError("");const {error:deleteError}=await db.from("drag_race_track_records").delete().eq("id",recordId);if(deleteError){setError("Eliminazione non riuscita: "+deleteError.message);setDeleteBusy(false);return;}router.push("/drag-race/track-record");router.refresh();}
 function jumpToEpisode(value:string){if(!value)return;const selector=window.matchMedia("(max-width: 760px)").matches?".drag-track-mobile-episode[data-episode=\""+value+"\"]":".drag-track-table th[data-episode=\""+value+"\"]";document.querySelector(selector)?.scrollIntoView({behavior:"smooth",block:"center"});}

 return <main className="drag-race-page drag-race-pop-track-editor">
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
  <div className="drag-track-toolbar"><div className="drag-track-quick-nav"><label htmlFor="drag-track-quick-episode">Vai all’episodio</label><select id="drag-track-quick-episode" defaultValue="" onChange={e=>jumpToEpisode(e.target.value)}><option value="">Seleziona episodio</option>{data.episodes.map(ep=><option key={ep.number} value={ep.number}>E{ep.number} · {ep.title}</option>)}</select></div><div className="drag-track-export-actions"><button type="button" onClick={exportCsv}><Download size={14}/> CSV</button><button type="button" onClick={exportExcel}><FileSpreadsheet size={14}/> Excel</button><button type="button" onClick={()=>window.print()}><FileText size={14}/> PDF</button><button type="button" disabled={exportBusy} onClick={()=>void exportPng()}>{exportBusy?<LoaderCircle size={14} className="spin"/>:<ImageIcon size={14}/>} PNG</button>{visibility==="PUBLIC"&&socialEnabled&&<button type="button" onClick={()=>void shareRecord()}><Share2 size={14}/> Condividi</button>}{canEdit&&<button type="button" className="is-danger" onClick={()=>setDeleteOpen(true)}><Trash2 size={14}/> Elimina</button>}</div></div>{shareNotice&&<p className="drag-track-social-notice" role="status">{shareNotice}</p>}
  {data.source_metadata?.source_url&&<p className="drag-track-footnote">Fonte: <a href={data.source_metadata.source_url} target="_blank" rel="noreferrer">{data.source_metadata.source_id??"Catalogo Drag Race"}</a>{data.source_metadata.source_version?" · "+data.source_metadata.source_version:""}</p>}

  <section className="drag-track-stats-grid"><article><strong>{data.queens.length}</strong><span>Queen</span></article><article><strong>{data.episodes.length}</strong><span>Episodi</span></article><article><strong>{summary.placements}</strong><span>Placement assegnati</span></article><article><strong>{summary.winners}</strong><span>Vincitrici</span></article><article><strong>{summary.averagePpe===null?"—":summary.averagePpe.toFixed(2)}</strong><span>PPE medio</span></article><article><strong>{summary.eliminated}</strong><span>Eliminate</span></article></section>{placementCounts.length>0&&<div className="drag-track-placement-stats">{placementCounts.map(([key,count])=><span key={key}>{availableRules.find(rule=>rule.placement_key===key)?.label??key}: <b>{count}</b></span>)}</div>}
  {canEdit&&<section className="drag-track-section drag-track-editor-tools">
   <div className="drag-track-section-head"><div><span>ROSTER</span><h2>Gestisci le Queen</h2></div></div>
   <div className="drag-track-roster-add"><div><input value={queenSearch} onChange={e=>setQueenSearch(e.target.value)} placeholder="Cerca una Queen nel catalogo"/>{queenSearch.trim()&&<div className="drag-track-roster-options">{filteredQueenOptions.map(q=><button type="button" key={q.id} disabled={data.queens.some(existing=>existing.id===q.id)} onClick={()=>void addCatalogQueen(q)}>{q.name}{data.queens.some(existing=>existing.id===q.id)?" · già presente":" · Aggiungi"}</button>)}{filteredQueenOptions.length===0&&<small>Nessuna Queen trovata nel catalogo.</small>}</div>}</div>
    <div className="drag-track-custom-queen-inline"><input value={customQueenName} onChange={e=>setCustomQueenName(e.target.value)} placeholder="Nome Queen custom"/><input type="url" value={customQueenImage} onChange={e=>setCustomQueenImage(e.target.value)} placeholder="URL immagine facoltativo"/><button type="button" onClick={()=>void addCustomQueen()}><Plus size={14}/> Aggiungi custom</button></div>
   </div>
   <div className="drag-track-custom-placement"><strong>Placement personalizzati</strong><div><input value={customPlacementLabel} onChange={e=>setCustomPlacementLabel(e.target.value)} placeholder="Nome placement"/><input type="number" step="0.1" min="-100" max="100" value={customPlacementScore} onChange={e=>setCustomPlacementScore(e.target.value)} aria-label="Punteggio PPE"/><input type="color" value={customPlacementColor} onChange={e=>setCustomPlacementColor(e.target.value)} aria-label="Colore placement"/><button type="button" onClick={()=>void addCustomPlacement()}><Plus size={14}/> Aggiungi</button></div>{(data.custom_placements??[]).map(rule=><span key={rule.placement_key} style={{backgroundColor:rule.color}}>{rule.label} · {rule.score.toFixed(1)}<button type="button" aria-label={"Rimuovi "+rule.label} onClick={()=>void removeCustomPlacement(rule.placement_key)}><X size={12}/></button></span>)}</div>
  </section>}

  {pendingRemoval&&<div className="drag-track-confirm-remove"><span>{pendingRemoval.type==="queen"?"Rimuovere questa Queen e tutti i suoi risultati?":"Rimuovere questo episodio e i relativi risultati?"}</span><button type="button" onClick={()=>setPendingRemoval(null)}>Annulla</button><button type="button" onClick={()=>void confirmRemoval()}>Conferma</button></div>}
  {canEdit&&<div className="drag-track-add-episode"><button type="button" onClick={()=>void addEpisode()} disabled={data.episodes.length>=50}><Plus size={14}/> Aggiungi episodio</button></div>}
  <div className="drag-track-export-capture" ref={exportRef}><section className="drag-track-table-wrap"><table className="drag-track-table"><thead><tr><th>#</th><th>Queen</th><th>PPE</th>{data.episodes.map(ep=><th key={ep.number} data-episode={ep.number}><span>{ep.number}</span>{canEdit?<><input className="drag-track-episode-title" aria-label={"Titolo episodio "+ep.number} defaultValue={ep.title} onBlur={e=>void updateEpisodeTitle(ep.number,e.target.value)}/><label className="drag-track-episode-ppe"><input type="checkbox" checked={ep.counts_for_ppe!==false} onChange={e=>void toggleEpisodePpe(ep.number,e.target.checked)}/> PPE</label><button type="button" className="drag-track-remove-episode" aria-label={"Rimuovi episodio "+ep.number} onClick={()=>requestRemoveEpisode(ep.number)}><X size={11}/></button></>:<small>{ep.title}</small>}{(ep.mini_challenge||ep.maxi_challenge||ep.lip_sync_song)&&<div className="drag-track-episode-challenges">{ep.mini_challenge&&<small>Mini: {ep.mini_challenge}</small>}{ep.maxi_challenge&&<small>Maxi: {ep.maxi_challenge}</small>}{ep.lip_sync_song&&<small>Lipsync: {ep.lip_sync_song}</small>}</div>}</th>)}</tr></thead><tbody>{sorted.map((queen,index)=><tr key={queen.id??queen.name} className={queen.eliminated?"is-eliminated":""}><td>{index+1}</td><td><div className="drag-track-queen-cell">{queen.image_url?<Image src={queen.image_url} alt="" width={34} height={34} unoptimized/>:<span className="drag-track-queen-initial">{queen.name.slice(0,1).toUpperCase()}</span>}<div><strong>{queen.id&&!queen.id.startsWith("custom-")?<Link href={"/drag-race/queens/"+queen.id}>{queen.name}</Link>:queen.name}</strong>{canEdit?<><button type="button" className={"drag-track-winner-toggle"+(queen.winner?" is-winner":"")} aria-pressed={Boolean(queen.winner)} onClick={()=>void toggleWinner(queen.id??queen.name)}><Trophy size={12}/>{queen.winner?"Vincitrice":"Segna vincitrice"}</button>{queen.eliminated&&<label className="drag-track-elimination-order">Ordine uscita<input type="number" min="1" step="1" value={queen.elimination_tie_order??""} onChange={e=>void updateEliminationOrder(queen.id??queen.name,e.target.value)}/></label>}<button type="button" className="drag-track-remove-queen" onClick={()=>requestRemoveQueen(queen.id??queen.name)}><Trash2 size={11}/> Rimuovi</button></>:queen.winner&&<small className="drag-track-winner-label">Vincitrice</small>}</div></div></td><td className="drag-track-ppe">{ppe(queen.ppe)}</td>{data.episodes.map(ep=>{const result=queen.results.find(x=>x.episode===ep.number);const value=result?.placement??"";const rule=availableRules.find(x=>x.placement_key===value);return <td key={ep.number}>{canEdit?<select aria-label={queen.name+" episodio "+ep.number} value={value} onChange={e=>void updatePlacement(queen.id??queen.name,ep.number,e.target.value)} style={rule?{backgroundColor:rule.color}:undefined}><option value="">—</option>{value&&!rule&&<option value={value}>{value.trim()}</option>}{availableRules.map(x=><option key={x.placement_key} value={x.placement_key}>{x.label} · {Number(x.score).toFixed(1)}{x.placement_key.startsWith("CUSTOM:")?" · Custom":""}</option>)}</select>:<span>{value.trim()||"—"}</span>}</td>;})}</tr>)}</tbody></table></section>
  <section className="drag-track-mobile-cards">{sorted.map((queen,index)=><article className={"drag-track-mobile-card"+(queen.eliminated?" is-eliminated":"")} key={queen.id??queen.name}><div className="drag-track-mobile-queen-head"><div className="drag-track-mobile-queen-identity">{queen.image_url?<Image src={queen.image_url} alt="" width={38} height={38} unoptimized/>:<span className="drag-track-queen-initial">{queen.name.slice(0,1).toUpperCase()}</span>}<div><strong>{index+1}. {queen.id&&!queen.id.startsWith("custom-")?<Link href={"/drag-race/queens/"+queen.id}>{queen.name}</Link>:queen.name}</strong><small>PPE: {ppe(queen.ppe)}{queen.eliminated?" · Eliminata E"+queen.elimination_episode:""}</small></div></div>{canEdit?<div className="drag-track-mobile-queen-actions"><button type="button" className={"drag-track-winner-toggle"+(queen.winner?" is-winner":"")} onClick={()=>void toggleWinner(queen.id??queen.name)}><Trophy size={12}/>{queen.winner?"Vincitrice":"Segna vincitrice"}</button><button type="button" className="drag-track-remove-queen" onClick={()=>requestRemoveQueen(queen.id??queen.name)}><Trash2 size={11}/> Rimuovi</button></div>:queen.winner&&<small className="drag-track-winner-label">Vincitrice</small>}</div>{queen.eliminated&&canEdit&&<label className="drag-track-elimination-order">Ordine uscita<input type="number" min="1" step="1" value={queen.elimination_tie_order??""} onChange={e=>void updateEliminationOrder(queen.id??queen.name,e.target.value)}/></label>}{data.episodes.map(ep=>{const value=queen.results.find(result=>result.episode===ep.number)?.placement??"";const rule=availableRules.find(item=>item.placement_key===value);return <div className="drag-track-mobile-episode" data-episode={ep.number} key={ep.number}><div className="drag-track-mobile-episode-info"><strong>E{ep.number} · {ep.title}</strong>{(ep.mini_challenge||ep.maxi_challenge||ep.lip_sync_song)&&<small>{[ep.mini_challenge?"Mini: "+ep.mini_challenge:"",ep.maxi_challenge?"Maxi: "+ep.maxi_challenge:"",ep.lip_sync_song?"Lipsync: "+ep.lip_sync_song:""].filter(Boolean).join(" · ")}</small>}</div>{canEdit?<select aria-label={queen.name+" episodio "+ep.number} value={value} onChange={e=>void updatePlacement(queen.id??queen.name,ep.number,e.target.value)} style={rule?{backgroundColor:rule.color}:undefined}><option value="">—</option>{value&&!rule&&<option value={value}>{value.trim()}</option>}{availableRules.map(item=><option key={item.placement_key} value={item.placement_key}>{item.label} · {Number(item.score).toFixed(1)}</option>)}</select>:<span>{value.trim()||"—"}</span>}</div>;})}</article>)}</section></div>
  <p className="drag-track-footnote">Tutti i placement e la vincitrice sono scelti manualmente. La struttura della stagione (cast, episodi e challenge) proviene dal catalogo; nessun risultato ufficiale viene importato. Le celle vuote non equivalgono a SAFE e non contribuiscono al PPE.</p>
  <TrackRecordSocial recordId={recordId} ownerId={ownerId} userId={userId} canModerate={canModerateComments} socialEnabled={socialEnabled}/>
  <Dialog open={deleteOpen} onClose={()=>setDeleteOpen(false)} overlayClassName="renqd-report-overlay" className="report-renq-dialog renqd-report-dialog" ariaLabel="Elimina Track Record"><div className="report-renq-dialog-head"><div><span>ELIMINAZIONE DEFINITIVA</span><strong>Eliminare questa Track Record?</strong></div><button type="button" aria-label="Chiudi" onClick={()=>setDeleteOpen(false)}>×</button></div><p>La scheda e i relativi commenti saranno eliminati definitivamente. La vincitrice verrà rimossa anche dalla Hall of Fame.</p><div className="report-renq-dialog-actions"><button type="button" className="is-quiet" onClick={()=>setDeleteOpen(false)}>Annulla</button><button type="button" disabled={deleteBusy} onClick={()=>void deleteRecord()}>{deleteBusy?<LoaderCircle size={14} className="spin"/>:<Trash2 size={14}/>} Elimina definitivamente</button></div></Dialog>
 </main>;
}
