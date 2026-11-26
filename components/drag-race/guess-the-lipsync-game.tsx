"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {useDragRacePreferences} from "@/lib/drag-race/use-preferences";
import {ArrowLeft,Check,SkipForward,Music2,Search,LoaderCircle,PartyPopper} from "lucide-react";
type Franchise={code:string;name:string};
type Season={id:string;franchise_code:string;season_number:number;name:string};
type Queen={id:string;name:string;aliases:string[];image_url:string|null};
type Lipsync={id:string;season_id:string;song_title:string;song_artist:string;queen_ids:string[];preview_url:string;apple_music_url:string|null};
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
 const [startedAt,setStartedAt]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [showAbandon,setShowAbandon]=useState(false);
 const [finished,setFinished]=useState(false);
 const finishLock=useRef(false);
 const supabase=useMemo(()=>createClient(),[]);
 const current=queue[index]??null;
 const queenMap=useMemo(()=>new Map(queens.map(q=>[q.id,q])),[queens]);
 const seasonOptions=seasons.filter(s=>selectedFranchises.includes(s.franchise_code));
 const filtered=useMemo(()=>lipsyncs.filter(x=>{const season=seasons.find(s=>s.id===x.season_id);return Boolean(season&&selectedFranchises.includes(season.franchise_code)&&(allSeasons||selectedSeasons.includes(x.season_id)));}),[lipsyncs,seasons,selectedFranchises,allSeasons,selectedSeasons]);
 const targetSlot=found.length;
 const suggestions=useMemo(()=>{const query=norm(input);if(!query)return[];return queens.filter(q=>norm(q.name).includes(query)||(q.aliases??[]).some(a=>norm(a).includes(query))).slice(0,8);},[input,queens]);
 const progress=queue.length?Math.round((index/queue.length)*100):0;
 useEffect(()=>{if(found.length===2&&current){const timer=setTimeout(()=>{setIndex(v=>v+1);setFound([]);setErrorSlots([]);setInput("");setFeedback(null);setRevealed(false);},850);return()=>clearTimeout(timer);}},[found,current]);
 useEffect(()=>{if(!queue.length||index<queue.length||finishLock.current||!sessionId)return;finishLock.current=true;const summary={total:queue.length,completed:queue.length-skipped,skipped,errors,percentage:Math.round(((queue.length-skipped)/queue.length)*100),durationSeconds:startedAt?Math.max(0,Math.round((Date.now()-startedAt)/1000)):0};void supabase.rpc("drag_race_update_session",{p_session_id:sessionId,p_state:{queue:queue.map(x=>x.id),index,errors,skipped},p_status:"COMPLETED",p_summary:summary}).then(({error})=>{if(error)setNotice("Partita terminata, ma il riepilogo non è stato salvato.");setFinished(true);});},[index,queue,sessionId,errors,skipped,startedAt,supabase]);
 function toggleFranchise(code:string){setSelectedFranchises(old=>old.includes(code)?old.filter(x=>x!==code):[...old,code]);setSelectedSeasons([]);}
 async function start(){
  const count=Math.max(1,Math.min(200,Number(amount)||1));if(!filtered.length){setNotice("Non ci sono lipsync completi e disponibili con questi filtri.");return;}
  setBusy(true);setNotice("");const chosen=[...filtered].sort(()=>Math.random()-.5).slice(0,Math.min(count,filtered.length));
  const config={franchises:selectedFranchises,seasons:allSeasons?"ALL":selectedSeasons,amount:chosen.length};
  const {data,error}=await supabase.rpc("drag_race_create_session",{p_mode:"GUESS_THE_LIPSYNC",p_config:config,p_state:{queue:chosen.map(x=>x.id),index:0}});
  if(error){setNotice("Non è stato possibile avviare e registrare la partita.");setBusy(false);return;}
  finishLock.current=false;setSessionId(data);setStartedAt(Date.now());setQueue(chosen);setIndex(0);setFound([]);setErrorSlots([]);setErrors(0);setSkipped(0);setFinished(false);setBusy(false);
 }
 function guess(queen:Queen){
  if(!current||found.includes(queen.id)||feedback)return;
  const correct=current.queen_ids.includes(queen.id);
  if(correct){setFound(old=>[...old,queen.id]);setFeedback("correct");setInput("");setTimeout(()=>setFeedback(null),650);}
  else{if(!errorSlots.includes(targetSlot)){setErrorSlots(old=>[...old,targetSlot]);setErrors(v=>v+1);}setFeedback("wrong");setTimeout(()=>setFeedback(null),650);}
 }
 function skip(){if(!current)return;setRevealed(true);setSkipped(v=>v+1);setTimeout(()=>{setIndex(v=>v+1);setFound([]);setErrorSlots([]);setInput("");setFeedback(null);setRevealed(false);},1000);}
 async function abandon(){setShowAbandon(false);if(sessionId){await supabase.rpc("drag_race_update_session",{p_session_id:sessionId,p_state:{queue:queue.map(x=>x.id),index,errors,skipped},p_status:"ABANDONED",p_summary:{total:queue.length,completed:index,errors,skipped}});}setQueue([]);setSessionId(null);setFinished(false);}
 if(!queue.length)return <main className={"drag-game-page"+(!preferences.animations_enabled?" drag-no-animations":"")}><Link className="drag-back" href="/drag-race"><ArrowLeft size={16}/> Drag Race</Link><header className="drag-game-heading"><span> LALAPARUZA · 01</span><h1>Guess the <em>Lipsync.</em></h1><p>Ascolta la canzone, osserva le due card anonime e indovina le Queen che si sono affrontate.</p></header>
  {lipsyncs.length===0?<section className="drag-game-empty"><Music2 size={28}/><h2>Catalogo non ancora pronto</h2><p>Servono lipsync con partecipanti, artista e preview musicale verificati. Lo staff può sincronizzare il catalogo dall’hub Drag Race.</p></section>:<section className="drag-config-card"><div className="drag-config-block"><h2>Quanti lipsync vuoi indovinare?</h2><input className="drag-number-input" type="number" min="1" max="200" value={amount} onChange={e=>setAmount(e.target.value)}/><small>Puoi scegliere un numero personalizzato, fino a 200 per partita.</small></div><div className="drag-config-block"><h2>Franchise</h2><div className="drag-chip-list">{franchises.map(f=><button key={f.code} type="button" className={selectedFranchises.includes(f.code)?"is-selected":""} onClick={()=>toggleFranchise(f.code)}>{f.name}</button>)}</div></div><div className="drag-config-block"><h2>Stagioni</h2><label className="drag-check"><input type="checkbox" checked={allSeasons} onChange={e=>setAllSeasons(e.target.checked)}/> Tutte le stagioni dei franchise selezionati</label>{!allSeasons&&<div className="drag-chip-list">{seasonOptions.map(s=><button key={s.id} type="button" className={selectedSeasons.includes(s.id)?"is-selected":""} onClick={()=>setSelectedSeasons(old=>old.includes(s.id)?old.filter(x=>x!==s.id):[...old,s.id])}>{s.name}</button>)}</div>}</div><div className="drag-start-row"><span>{filtered.length} lipsync disponibili con questi filtri</span><button type="button" disabled={busy||!filtered.length} onClick={start}>{busy?<LoaderCircle className="spin" size={16}/>:null} Inizia la partita</button></div>{notice&&<p className="drag-notice">{notice}</p>}</section>}
 </main>;
 if(finished||index>=queue.length)return <main className={"drag-game-page"+(!preferences.animations_enabled?" drag-no-animations":"")}><Link className="drag-back" href="/drag-race"><ArrowLeft size={16}/> Drag Race</Link><section className="drag-result-card"><PartyPopper size={34}/><span>PARTITA COMPLETATA</span><h1>That’s a <em>wrap!</em></h1><div className="drag-result-stats"><div><strong>{queue.length-skipped}</strong><small>Indovinati</small></div><div><strong>{skipped}</strong><small>Rinunce</small></div><div><strong>{errors}</strong><small>Queen con errori</small></div><div><strong>{Math.round(((queue.length-skipped)/queue.length)*100)}%</strong><small>Risultato</small></div></div><button type="button" onClick={()=>{setQueue([]);setSessionId(null);setNotice("");}}>Nuova partita</button></section></main>;
 const participants=current?.queen_ids.map(id=>queenMap.get(id)).filter(Boolean) as Queen[]??[];
 return <main className={"drag-game-page"+(!preferences.animations_enabled?" drag-no-animations":"")}><Link className="drag-back" href="/drag-race"><ArrowLeft size={16}/> Drag Race</Link><header className="drag-game-top"><div><span>GUESS THE LIPSYNC</span><h1>Who slayed <em>the stage?</em></h1></div><div className="drag-game-count">{index+1}<small> / {queue.length}</small></div></header><div className="drag-game-progress"><span style={{width:progress+"%"}}/></div>
  <section className="drag-current-song"><div><span>THE LIPSYNC SONG</span><h2>{current.song_title}</h2><p>{current.song_artist}</p></div><audio ref={playerRef} controls preload="none" src={current.preview_url}/>{current.apple_music_url&&<a href={current.apple_music_url} target="_blank" rel="noreferrer">Apple Music ↗</a>}</section>
  <section className="drag-queen-pair">{[0,1].map(slot=>{const q=participants[slot];const visible=Boolean(q&&(found.includes(q.id)||revealed));return <article key={slot} className={"drag-queen-card "+(found.includes(q?.id??"")?"is-found":feedback==="wrong"&&targetSlot===slot?"is-wrong":"")}><div className="drag-queen-image">{visible&&q?.image_url?<img src={q.image_url} alt={q.name}/>:visible?<span>{q?.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</span>:<span>?</span>}</div><div><small>QUEEN {slot+1}</small><strong>{visible?q?.name:"Who is this Queen?"}</strong></div>{found.includes(q?.id??"")&&<Check size={20}/>}</article>;})}</section>
  {!revealed&&found.length<2&&<section className="drag-answer-card"><label htmlFor="drag-queen-search">Cerca una Queen</label><div className="drag-search-field"><Search size={17}/><input id="drag-queen-search" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&suggestions[0])guess(suggestions[0]);}} placeholder="Nome o alias della Queen…" autoComplete="off"/></div>{suggestions.length>0&&<div className="drag-suggestions">{suggestions.map(q=><button key={q.id} type="button" onClick={()=>guess(q)}>{q.name}</button>)}</div>}<button className="drag-skip" type="button" onClick={skip}><SkipForward size={15}/> Rinuncia</button>{feedback&&<p className={"drag-feedback "+feedback}>{feedback==="correct"?"Correct! You got her.":"Non è la Queen corretta. Riprova!"}</p>}</section>}
  <div className="drag-game-footer"><span>{found.length}/2 Queen indovinate · {errors} errori</span><button type="button" onClick={()=>setShowAbandon(true)}>Abbandona partita</button></div>
  {showAbandon&&<div className="drag-modal-backdrop"><section className="drag-confirm-modal"><h2>Abbandonare la partita?</h2><p>La sessione verrà conservata nella cronologia come interrotta e non contribuirà alle classifiche.</p><div><button onClick={()=>setShowAbandon(false)}>Continua</button><button onClick={()=>void abandon()}>Abbandona</button></div></section></div>}
 </main>;
}
