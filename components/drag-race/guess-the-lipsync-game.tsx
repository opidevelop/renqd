"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {CatalogReportButton} from "@/components/drag-race/catalog-report-button";
import {FranchisePicker} from "@/components/drag-race/franchise-picker";
import {QueenCatalogImage} from "@/components/drag-race/queen-catalog-image";
import {createClient} from "@/lib/supabase/client";
import {useDragRacePreferences} from "@/lib/drag-race/use-preferences";
import {ArrowLeft,Check,SkipForward,Music2,Search,LoaderCircle,PartyPopper} from "lucide-react";
type Franchise={code:string;name:string};
type Season={id:string;franchise_code:string;season_number:number;name:string};
type Queen={id:string;name:string;aliases:string[];image_url:string|null};
type Lipsync={id:string;season_id:string;song_title:string;song_artist:string;queen_ids:string[];preview_url:string|null;apple_music_url:string|null;source_version:string|null;pairs?:string[][];recordIds?:string[]};
type Props={franchises:Franchise[];seasons:Season[];queens:Queen[];lipsyncs:Lipsync[]};
const norm=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"").trim();
export function GuessTheLipsyncGame({franchises,seasons,queens,lipsyncs}:Props){
 const [selectedFranchises,setSelectedFranchises]=useState<string[]>(franchises.map(x=>x.code));
 const [selectedSeasons,setSelectedSeasons]=useState<string[]>([]);
 const [allSeasons,setAllSeasons]=useState(true);
 const [amount,setAmount]=useState("10");
 const [queue,setQueue]=useState<Lipsync[]>([]);
 const [index,setIndex]=useState(0);
 const [found,setFound]=useState<string[]>([]);
 const [errorSlots,setErrorSlots]=useState<number[]>([]);
 const [errors,setErrors]=useState(0);
 const [skipped,setSkipped]=useState(0);
 const [input,setInput]=useState("");
 const [feedback,setFeedback]=useState<"correct"|"wrong"|null>(null);
 const [revealed,setRevealed]=useState(false);
 const [sessionId,setSessionId]=useState<string|null>(null);
 const [failedPreviewId,setFailedPreviewId]=useState<string|null>(null);
 const [startedAt,setStartedAt]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [showAbandon,setShowAbandon]=useState(false);
 const [finished,setFinished]=useState(false);
 const finishLock=useRef(false);
 const supabase=useMemo(()=>createClient(),[]);const {preferences}=useDragRacePreferences();const playerRef=useRef<HTMLAudioElement>(null);
 const current=queue[index]??null;
 useEffect(()=>{const player=playerRef.current;if(!player)return;player.volume=preferences.sounds_enabled?preferences.player_volume:0;if(current?.preview_url&&preferences.player_autoplay&&preferences.sounds_enabled)void player.play().catch(()=>{});else player.pause();},[current?.id,current?.preview_url,preferences.player_autoplay,preferences.player_volume,preferences.sounds_enabled]);
 const queenMap=useMemo(()=>new Map(queens.map(q=>[q.id,q])),[queens]);
 const seasonOptions=seasons.filter(s=>selectedFranchises.includes(s.franchise_code));
 const filtered=useMemo(()=>lipsyncs.filter(x=>{const season=seasons.find(s=>s.id===x.season_id);return x.queen_ids?.length===2&&Boolean(season&&selectedFranchises.includes(season.franchise_code)&&(allSeasons||selectedSeasons.includes(x.season_id)));}),[lipsyncs,seasons,selectedFranchises,allSeasons,selectedSeasons]);
 const prompts=useMemo(()=>{const groups=new Map<string,Lipsync[]>();for(const row of filtered){const key=norm(row.song_title)+"|"+norm(row.song_artist);const list=groups.get(key)??[];list.push(row);groups.set(key,list);}return [...groups.values()].map(rows=>{const playable=rows.find(row=>Boolean(row.preview_url))??rows[0];const pairMap=new Map<string,string[]>();for(const row of rows)if(row.queen_ids?.length===2)pairMap.set([...row.queen_ids].sort().join("|"),[...row.queen_ids]);const pairs=[...pairMap.values()];return {...playable,pairs,recordIds:rows.map(row=>row.id)};}).filter(prompt=>Boolean(prompt.preview_url));},[filtered]);
 const currentPairs=current?.pairs??(current?[current.queen_ids]:[]);
 const targetSlot=found.length;
 const suggestions=useMemo(()=>{const query=norm(input);if(!query)return[];const allowedIds=found.length===1?[...new Set(currentPairs.filter(pair=>pair.includes(found[0])).flat().filter(id=>id!==found[0]))]:[...new Set(currentPairs.flat())];return queens.filter(q=>allowedIds.includes(q.id)&&(norm(q.name).includes(query)||(q.aliases??[]).some(a=>norm(a).includes(query)))).slice(0,8);},[input,queens,found,currentPairs]);
 const progress=queue.length?Math.round((index/queue.length)*100):0;
 useEffect(()=>{if(found.length===2&&current){const timer=setTimeout(()=>{setIndex(v=>v+1);setFound([]);setErrorSlots([]);setInput("");setFeedback(null);setRevealed(false);},850);return()=>clearTimeout(timer);}},[found,current]);
 useEffect(()=>{if(!queue.length||index<queue.length||finishLock.current||!sessionId)return;finishLock.current=true;const summary={total:queue.length,completed:queue.length-skipped,skipped,errors,percentage:Math.round(((queue.length-skipped)/queue.length)*100),durationSeconds:startedAt?Math.max(0,Math.round((Date.now()-startedAt)/1000)):0};void supabase.rpc("drag_race_update_session",{p_session_id:sessionId,p_state:{queue:queue.map(x=>x.id),index,errors,skipped},p_status:"COMPLETED",p_summary:summary}).then(({error})=>{if(error)setNotice("Partita terminata, ma il riepilogo non è stato salvato.");setFinished(true);});},[index,queue,sessionId,errors,skipped,startedAt,supabase]);

 async function start(){
  const count=Math.max(1,Math.min(200,Number(amount)||1));if(!prompts.length){setNotice("Non ci sono brani con coppie Queen e preview disponibili per questi filtri.");return;}
  setBusy(true);setNotice("");const chosen=[...prompts].sort(()=>Math.random()-.5).slice(0,Math.min(count,prompts.length));
  const config={franchises:selectedFranchises,seasons:allSeasons?"ALL":selectedSeasons,amount:chosen.length};
  const {data,error}=await supabase.rpc("drag_race_create_session",{p_mode:"GUESS_THE_LIPSYNC",p_config:config,p_state:{queue:chosen.map(x=>x.id),index:0}});
  if(error){setNotice("Non è stato possibile avviare e registrare la partita.");setBusy(false);return;}
  finishLock.current=false;setSessionId(data);setStartedAt(Date.now());setQueue(chosen);setIndex(0);setFound([]);setErrorSlots([]);setErrors(0);setSkipped(0);setFinished(false);setBusy(false);
 }
 function changeSong(){if(!current)return;const upcomingIds=new Set(queue.slice(index+1).map(x=>x.id));const candidates=prompts.filter(x=>Boolean(x.preview_url)&&x.id!==current.id&&(!queue.some(item=>item.id===x.id)||upcomingIds.has(x.id)));if(!candidates.length){setNotice("Non ci sono altre canzoni con anteprima disponibile per questi filtri.");return;}const replacement=candidates[Math.floor(Math.random()*candidates.length)];const next=[...queue];const swapIndex=next.findIndex((item,i)=>i>index&&item.id===replacement.id);if(swapIndex>=0)next[swapIndex]=current;next[index]=replacement;setQueue(next);setFailedPreviewId(null);setNotice("");setFound([]);setErrorSlots([]);setInput("");setFeedback(null);setRevealed(false);}
 function guess(queen:Queen){
  if(!current||found.includes(queen.id)||feedback)return;
  const correct=found.length===0?currentPairs.some(pair=>pair.includes(queen.id)):currentPairs.some(pair=>pair.includes(found[0])&&pair.includes(queen.id));
  if(correct){setFound(old=>[...old,queen.id]);setFeedback("correct");setInput("");setTimeout(()=>setFeedback(null),650);}
  else{if(!errorSlots.includes(targetSlot)){setErrorSlots(old=>[...old,targetSlot]);setErrors(v=>v+1);}setFeedback("wrong");setTimeout(()=>setFeedback(null),650);}
 }
 function skip(){if(!current)return;setRevealed(true);setSkipped(v=>v+1);setTimeout(()=>{setIndex(v=>v+1);setFound([]);setErrorSlots([]);setInput("");setFeedback(null);setRevealed(false);},1600);}
 async function abandon(){setShowAbandon(false);if(sessionId){await supabase.rpc("drag_race_update_session",{p_session_id:sessionId,p_state:{queue:queue.map(x=>x.id),index,errors,skipped},p_status:"ABANDONED",p_summary:{total:queue.length,completed:index,errors,skipped}});}setQueue([]);setSessionId(null);setFinished(false);}
 if(!queue.length)return <main className={"drag-game-page"+(!preferences.animations_enabled?" drag-no-animations":"")}><Link className="drag-back" href="/drag-race"><ArrowLeft size={16}/> Drag Race</Link><header className="drag-game-heading"><span> LALAPARUZA · 01</span><h1>Guess the <em>Lipsync.</em></h1><p>Ascolta la canzone, osserva le due card anonime e indovina le Queen che si sono affrontate.</p></header>
  {lipsyncs.length===0?<section className="drag-game-empty"><Music2 size={28}/><h2>Catalogo non ancora pronto</h2><p>Servono lipsync con partecipanti, artista e preview musicale verificati. Lo staff può sincronizzare il catalogo dall’hub Drag Race.</p></section>:<section className="drag-config-card"><div className="drag-config-block"><h2>Quanti lipsync vuoi indovinare?</h2><input className="drag-number-input" type="number" min="1" max="200" value={amount} onChange={e=>setAmount(e.target.value)}/><small>Puoi scegliere un numero personalizzato, fino a 200 per partita.</small></div><div className="drag-config-block"><h2>Franchise</h2><FranchisePicker franchises={franchises} selected={selectedFranchises} onChange={next=>{setSelectedFranchises(next);setSelectedSeasons([]);}} mode="multiple"/></div><div className="drag-config-block"><h2>Stagioni</h2><label className="drag-check"><input type="checkbox" checked={allSeasons} onChange={e=>setAllSeasons(e.target.checked)}/> Tutte le stagioni dei franchise selezionati</label>{!allSeasons&&<div className="drag-chip-list">{seasonOptions.map(s=><button key={s.id} type="button" className={selectedSeasons.includes(s.id)?"is-selected":""} onClick={()=>setSelectedSeasons(old=>old.includes(s.id)?old.filter(x=>x!==s.id):[...old,s.id])}>{s.name}</button>)}</div>}</div><div className="drag-start-row"><span>{prompts.length} brani unici con preview disponibili</span><button type="button" disabled={busy||!filtered.length} onClick={start}>{busy?<LoaderCircle className="spin" size={16}/>:null} Inizia la partita</button></div>{notice&&<p className="drag-notice">{notice}</p>}</section>}
 </main>;
 if(finished||index>=queue.length)return <main className={"drag-game-page"+(!preferences.animations_enabled?" drag-no-animations":"")}><Link className="drag-back" href="/drag-race"><ArrowLeft size={16}/> Drag Race</Link><section className="drag-result-card"><PartyPopper size={34}/><span>PARTITA COMPLETATA</span><h1>That’s a <em>wrap!</em></h1><div className="drag-result-stats"><div><strong>{queue.length-skipped}</strong><small>Indovinati</small></div><div><strong>{skipped}</strong><small>Rinunce</small></div><div><strong>{errors}</strong><small>Queen con errori</small></div><div><strong>{Math.round(((queue.length-skipped)/queue.length)*100)}%</strong><small>Risultato</small></div></div><button type="button" onClick={()=>{setQueue([]);setSessionId(null);setNotice("");}}>Nuova partita</button></section></main>;
 
 return <main className={"drag-game-page"+(!preferences.animations_enabled?" drag-no-animations":"")}><Link className="drag-back" href="/drag-race"><ArrowLeft size={16}/> Drag Race</Link><header className="drag-game-top"><div><span>GUESS THE LIPSYNC</span><h1>Who slayed <em>the stage?</em></h1></div><div className="drag-game-count">{index+1}<small> / {queue.length}</small></div></header><div className="drag-game-progress"><span style={{width:progress+"%"}}/></div>
  <section className="drag-current-song"><div><span>THE LIPSYNC SONG</span><h2>{current.song_title}</h2><p>{current.song_artist}</p></div>{current.preview_url?<audio ref={playerRef} controls preload="none" src={current.preview_url} onError={()=>setFailedPreviewId(current.id)} onCanPlay={()=>setFailedPreviewId(null)}/>:null}{(!current.preview_url||failedPreviewId===current.id)&&<button type="button" className="drag-song-recovery" onClick={changeSong}><span>Anteprima non disponibile</span><strong>Cambia canzone</strong></button>}{current.apple_music_url&&<a href={current.apple_music_url} target="_blank" rel="noreferrer">Apple Music ↗</a>}<CatalogReportButton entityType="LIPSYNC" entityId={current.id} entityName={current.song_title+" · "+current.song_artist} sourceUrl={current.apple_music_url} sourceVersion={current.source_version}/></section>
  {revealed?<section className="drag-queen-reveals">{currentPairs.map((pair,pairIndex)=><div className="drag-queen-pair" key={pairIndex}>{pair.map((id,slot)=>{const q=queenMap.get(id);return <article key={id} className="drag-queen-card is-found"><div className="drag-queen-image">{q&&<QueenCatalogImage id={q.id} name={q.name} src={q.image_url}/>}</div><div><small>QUEEN {slot+1}</small><strong>{q?.name??"Queen"}</strong></div><Check size={20}/></article>;})}</div>)}</section>:<section className="drag-queen-pair">{[0,1].map(slot=>{const id=slot===0?found[0]:found[1],q=id?queenMap.get(id):null;const visible=Boolean(q);return <article key={slot} className={"drag-queen-card "+(visible?"is-found":feedback==="wrong"&&targetSlot===slot?"is-wrong":"")}><div className="drag-queen-image">{visible&&q?<QueenCatalogImage id={q.id} name={q.name} src={q.image_url}/>:<span>?</span>}</div><div><small>QUEEN {slot+1}</small><strong>{visible?q?.name:"Who is this Queen?"}</strong></div>{visible&&<Check size={20}/>}</article>;})}</section>}
  {!revealed&&found.length<2&&<section className="drag-answer-card"><label htmlFor="drag-queen-search">Cerca una Queen</label><div className="drag-search-field"><Search size={17}/><input id="drag-queen-search" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&suggestions[0])guess(suggestions[0]);}} placeholder="Nome o alias della Queen…" autoComplete="off"/></div>{suggestions.length>0&&<div className="drag-suggestions">{suggestions.map(q=><button key={q.id} type="button" onClick={()=>guess(q)}>{q.name}</button>)}</div>}<button className="drag-skip" type="button" onClick={skip}><SkipForward size={15}/> Rinuncia</button>{feedback&&<p className={"drag-feedback "+feedback}>{feedback==="correct"?"Correct! You got her.":"Non è la Queen corretta. Riprova!"}</p>}</section>}
  <div className="drag-game-footer"><span>{found.length}/2 Queen indovinate · {errors} errori</span><button type="button" onClick={()=>setShowAbandon(true)}>Abbandona partita</button></div>
  {showAbandon&&<div className="drag-modal-backdrop"><section className="drag-confirm-modal"><h2>Abbandonare la partita?</h2><p>La sessione verrà conservata nella cronologia come interrotta e non contribuirà alle classifiche.</p><div><button onClick={()=>setShowAbandon(false)}>Continua</button><button onClick={()=>void abandon()}>Abbandona</button></div></section></div>}
 </main>;
}
