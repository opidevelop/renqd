"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {ArrowLeft,GitBranch,LoaderCircle,RefreshCw,Crown,Check} from "lucide-react";
type Queen={id:string;name:string;aliases:string[];image_url:string|null;franchiseCodes:string[]};
type Franchise={code:string;name:string};
type Song={id:string;song_title:string;song_artist:string|null;preview_url:string|null;apple_music_url:string|null};
type Match={id:string;a:string|null;b:string|null;songId:string|null;winner:string|null};
type Props={franchises:Franchise[];queens:Queen[];songs:Song[]};
const shuffle=<T,>(items:T[])=>[...items].sort(()=>Math.random()-.5);
export function SlayoffGame({franchises,queens,songs}:Props){
 const db=useMemo(()=>createClient(),[]);
 const [count,setCount]=useState("8");const [custom,setCustom]=useState("12");const [selectedFranchises,setSelectedFranchises]=useState(franchises.map(x=>x.code));
 const [manual,setManual]=useState(false);const [selectedQueens,setSelectedQueens]=useState<string[]>([]);const [search,setSearch]=useState("");const [ordered,setOrdered]=useState<Queen[]>([]);const [dragQueen,setDragQueen]=useState<string|null>(null);
 const [prelim,setPrelim]=useState<Match[]>([]);const [byes,setByes]=useState<string[]>([]);const [rounds,setRounds]=useState<Match[][]>([]);const [third,setThird]=useState<Match|null>(null);
 const [sessionId,setSessionId]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [pendingWinner,setPendingWinner]=useState<string|null>(null);const [confirm,setConfirm]=useState(false);const [finished,setFinished]=useState(false);const [notice,setNotice]=useState("");const [dragMatch,setDragMatch]=useState<string|null>(null);
 const pool=queens.filter(q=>q.franchiseCodes.some(code=>selectedFranchises.includes(code)));
 const desired=count==="CUSTOM"?Math.max(4,Math.min(64,Number(custom)||4)):Number(count);
 const suggestions=search.trim()?pool.filter(q=>q.name.toLowerCase().includes(search.toLowerCase())||(q.aliases??[]).some(a=>a.toLowerCase().includes(search.toLowerCase()))).slice(0,8):[];
 const songMap=useMemo(()=>new Map(songs.map(s=>[s.id,s])),[songs]);const queenMap=useMemo(()=>new Map(queens.map(q=>[q.id,q])),[queens]);
 function randomSong(){return songs.length?songs[Math.floor(Math.random()*songs.length)].id:null;}
 function buildMain(ids:string[]){let current=[...ids];const built:Match[][]=[];let round=1;while(current.length>1){const matches:Match[]=[];for(let i=0;i<current.length;i+=2)matches.push({id:"r"+round+"-"+(i/2),a:current[i]??null,b:current[i+1]??null,songId:randomSong(),winner:null});built.push(matches);current=Array.from({length:current.length/2},(_,i)=>"");round++;}return built;}
 async function start(){
  setBusy(true);setNotice("");let participants=manual?ordered.map(q=>q.id):shuffle(pool).slice(0,desired).map(q=>q.id);
  if(manual&&selectedQueens.length!==desired){setNotice("Seleziona esattamente "+desired+" Queen.");setBusy(false);return;}
  if(!manual)participants=shuffle(pool).slice(0,desired).map(q=>q.id);
  if(participants.length!==desired||participants.length<4){setNotice("Numero di Queen non disponibile nel catalogo selezionato.");setBusy(false);return;}
  if(!songs.length){setNotice("Non ci sono brani nel catalogo.");setBusy(false);return;}
  const power=2**Math.floor(Math.log2(participants.length));const prelimCount=participants.length-power;
  const preliminary:Match[]=[];for(let i=0;i<prelimCount*2;i+=2)preliminary.push({id:"p-"+(i/2),a:participants[i],b:participants[i+1],songId:randomSong(),winner:null});
  const bye=participants.slice(prelimCount*2);const main=prelimCount?[]:buildMain(participants);
  const config={franchises:selectedFranchises,participants:participants.length,selection:manual?"MANUAL":"RANDOM"};
  const state={prelim:preliminary,byes:bye,rounds:main,third:null};
  const {data,error}=await db.rpc("drag_race_create_session",{p_mode:"SLAYOFF",p_config:config,p_state:state});
  if(error){setNotice("Impossibile salvare il torneo.");setBusy(false);return;}
  setSessionId(data);setPrelim(preliminary);setByes(bye);setRounds(main);setThird(null);setFinished(false);setBusy(false);
 }
 function saveState(p:unknown,status="ACTIVE",summary:unknown=null){if(sessionId)void db.rpc("drag_race_update_session",{p_session_id:sessionId,p_state:p,p_status:status,p_summary:summary});}
 function currentMatch():{type:"prelim"|"round"|"third";match:Match;round:number;index:number}|null{
  const p=prelim.findIndex(m=>!m.winner);if(p>=0)return{type:"prelim",match:prelim[p],round:-1,index:p};
  for(let r=0;r<rounds.length;r++){const i=rounds[r].findIndex(m=>m.a&&m.b&&!m.winner);if(i>=0)return{type:"round",match:rounds[r][i],round:r,index:i};}
  if(third&&!third.winner)return{type:"third",match:third,round:-2,index:0};
  return null;
 }
 const active=currentMatch();
 function askWinner(id:string){setPendingWinner(id);setConfirm(true);}
 function confirmWinner(){
  if(!active||!pendingWinner)return;
  let nextPrelim=prelim,nextRounds=rounds,nextThird=third;
  if(active.type==="prelim"){
   nextPrelim=prelim.map(m=>m.id===active.match.id?{...m,winner:pendingWinner}:m);setPrelim(nextPrelim);
   if(nextPrelim.every(m=>m.winner)){const entrants=[...byes,...nextPrelim.map(m=>m.winner!)];nextRounds=buildMain(entrants);setRounds(nextRounds);}
  }else if(active.type==="round"){
   nextRounds=rounds.map((list,r)=>r===active.round?list.map(m=>m.id===active.match.id?{...m,winner:pendingWinner}:m):list);
   if(active.round<rounds.length-1){const nextIndex=Math.floor(active.index/2),slot=active.index%2;nextRounds=nextRounds.map((list,r)=>r===active.round+1?list.map((m,i)=>i===nextIndex?{...m,[slot===0?"a":"b"]:pendingWinner}:m):list);}
   setRounds(nextRounds);
   if(active.round===rounds.length-2&&nextRounds[active.round].every(m=>m.winner)){const losers=nextRounds[active.round].map(m=>m.a===m.winner?m.b:m.a).filter(Boolean) as string[];if(losers.length===2)nextThird={id:"third-place",a:losers[0],b:losers[1],songId:randomSong(),winner:null};setThird(nextThird);}
  }else{nextThird=third?{...third,winner:pendingWinner}:null;setThird(nextThird);}
  const state={prelim:nextPrelim,byes,rounds:nextRounds,third:nextThird};saveState(state);
  setConfirm(false);setPendingWinner(null);
  const final=nextRounds.at(-1)?.[0];if(final?.winner&&nextThird?.winner){const summary={completed:1,wins:1,losses:0,percentage:100,winnerId:final.winner,runnerUpId:final.a===final.winner?final.b:final.a,thirdPlaceId:nextThird.winner,prelim:nextPrelim,rounds:nextRounds,third:nextThird};saveState(state,"COMPLETED",summary);setFinished(true);}
 }
 function reorderQueens(targetId:string){if(!dragQueen||dragQueen===targetId)return;const list=[...ordered];const from=list.findIndex(q=>q.id===dragQueen),to=list.findIndex(q=>q.id===targetId);if(from<0||to<0)return;const [item]=list.splice(from,1);list.splice(to,0,item);setOrdered(list);setDragQueen(null);}
 function toggleQueen(q:Queen){setSelectedQueens(old=>{if(old.includes(q.id)){setOrdered(list=>list.filter(x=>x.id!==q.id));return old.filter(x=>x!==q.id);}if(old.length>=desired)return old;setOrdered(list=>[...list,q]);return[...old,q.id];});}
 function updateSong(matchId:string,songId:string){setPrelim(old=>old.map(m=>m.id===matchId&&!m.winner?{...m,songId}:m));setRounds(old=>old.map(list=>list.map(m=>m.id===matchId&&!m.winner?{...m,songId}:m)));if(third?.id===matchId&&!third.winner)setThird({...third,songId});}
 function randomizeSongs(){setPrelim(old=>old.map(m=>m.winner?m:{...m,songId:randomSong()}));setRounds(old=>old.map(list=>list.map(m=>m.winner?m:{...m,songId:randomSong()})));if(third&&!third.winner)setThird({...third,songId:randomSong()});}
 function swapSongs(targetId:string){if(!dragMatch||dragMatch===targetId)return;const all=[...prelim,...rounds.flat(),...(third?[third]:[])];const a=all.find(x=>x.id===dragMatch),b=all.find(x=>x.id===targetId);if(a&&b&&!a.winner&&!b.winner){const first=a.songId??"",second=b.songId??"";updateSong(a.id,second);updateSong(b.id,first);}setDragMatch(null);}
 const matchRows=[...prelim,...rounds.flat(),...(third?[third]:[])];
 const champion=rounds.at(-1)?.[0]?.winner??null;const runner=rounds.at(-1)?.[0]?.a===champion?rounds.at(-1)?.[0]?.b:rounds.at(-1)?.[0]?.a;
 if(!prelim.length&&!rounds.length)return <main className="drag-game-page"><Link className="drag-back" href="/drag-race/lalaparuza"><ArrowLeft size={16}/> Lalaparuza</Link><header className="drag-game-heading"><span>LALAPARUZA · 02</span><h1>Slay <em>off.</em></h1><p>Un torneo a eliminazione diretta. Scegli il cast, prepara il tabellone e decidi chi avanza.</p></header><section className="drag-config-card"><div className="drag-config-block"><h2>Numero di Queen</h2><select className="drag-number-input" value={count} onChange={e=>setCount(e.target.value)}><option value="8">8 Queen</option><option value="16">16 Queen</option><option value="32">32 Queen</option><option value="CUSTOM">Personalizzato</option></select>{count==="CUSTOM"&&<input className="drag-number-input" type="number" min="4" max="64" value={custom} onChange={e=>setCustom(e.target.value)}/>}</div><div className="drag-config-block"><h2>Franchise</h2><div className="drag-chip-list">{franchises.map(f=><button key={f.code} className={selectedFranchises.includes(f.code)?"is-selected":""} onClick={()=>setSelectedFranchises(old=>old.includes(f.code)?old.filter(x=>x!==f.code):[...old,f.code])}>{f.name}</button>)}</div></div><div className="drag-config-block"><h2>Selezione Queen</h2><label className="drag-check"><input type="checkbox" checked={manual} onChange={e=>setManual(e.target.checked)}/> Selezione manuale</label>{manual&&<><input className="drag-number-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca Queen o alias…"/><div className="drag-suggestions">{suggestions.map(q=><button key={q.id} onClick={()=>toggleQueen(q)}>{selectedQueens.includes(q.id)?"✓ ":"＋ "}{q.name}</button>)}</div><p>{selectedQueens.length}/{desired} selezionate. Trascina per riordinare.</p><div className="drag-chip-list">{ordered.map(q=><button draggable key={q.id} onDragStart={()=>setDragQueen(q.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>reorderQueens(q.id)} className="is-selected">{q.name}</button>)}</div></>}</div><div className="drag-start-row"><span>{pool.length} Queen disponibili · {songs.length} brani</span><button disabled={busy||pool.length<desired||songs.length===0} onClick={()=>void start()}>{busy?<LoaderCircle size={16}/>:null} Crea tabellone</button></div>{notice&&<p className="drag-notice">{notice}</p>}</section></main>;
 if(finished)return <main className="drag-game-page"><Link className="drag-back" href="/drag-race/lalaparuza">← Lalaparuza</Link><section className="drag-result-card"><Crown size={34}/><span>TORNEO COMPLETATO</span><h1>The winner <em>is…</em></h1><div className="drag-result-stats">{[["1° posto",champion],["2° posto",runner],["3° posto",third?.winner??null]].map(([label,id])=><div key={label}><strong>{typeof id==="string"?queenMap.get(id)?.name??"—":"—"}</strong><small>{label}</small></div>)}</div><button onClick={()=>{setPrelim([]);setRounds([]);setThird(null);setSessionId(null);setFinished(false);}}>Nuovo torneo</button></section></main>;
 return <main className="drag-game-page"><Link className="drag-back" href="/drag-race/lalaparuza"><ArrowLeft size={16}/> Lalaparuza</Link><header className="drag-game-top"><div><span>SLAYOFF · TORNEO</span><h1>Choose the <em>slayer.</em></h1></div><button className="drag-skip" onClick={randomizeSongs}><RefreshCw size={14}/> Randomize canzoni</button></header><div className="drag-bracket">{prelim.length>0&&<section><h2>Preliminari</h2>{prelim.map(m=><MatchCard key={m.id} match={m} queenMap={queenMap} songMap={songMap} onSong={updateSong} onWinner={askWinner} onDragStart={setDragMatch} onDragOver={()=>{}} onDrop={swapSongs}/>)}</section>}{rounds.map((list,r)=><section key={r}><h2>{["Round of 64","Round of 32","Round of 16","Quarti di finale","Semifinali","Finale"][Math.max(0,6-rounds.length+r)]??("Turno "+(r+1))}</h2>{list.map(m=><MatchCard key={m.id} match={m} queenMap={queenMap} songMap={songMap} onSong={updateSong} onWinner={askWinner} onDragStart={setDragMatch} onDragOver={()=>{}} onDrop={swapSongs}/>)}</section>)}{third&&<section><h2>Finale per il terzo posto</h2><MatchCard match={third} queenMap={queenMap} songMap={songMap} onSong={updateSong} onWinner={askWinner} onDragStart={setDragMatch} onDragOver={()=>{}} onDrop={swapSongs}/></section>}</div>{active&&<section className="drag-active-duel"><span>DUELLO IN CORSO</span><h2>{queenMap.get(active.match.a??"")?.name} <em>vs</em> {queenMap.get(active.match.b??"")?.name}</h2><p>{songMap.get(active.match.songId??"")?.song_title} · {songMap.get(active.match.songId??"")?.song_artist??""}</p>{songMap.get(active.match.songId??"")?.preview_url&&<audio controls src={songMap.get(active.match.songId??"")?.preview_url??undefined}/>}<div>{[active.match.a,active.match.b].filter(Boolean).map(id=><button key={id} onClick={()=>askWinner(id!)}>Vince {queenMap.get(id!)?.name}</button>)}</div></section>}{confirm&&<div className="drag-modal-backdrop"><section className="drag-confirm-modal"><h2>Confermare la vincitrice?</h2><p>{queenMap.get(pendingWinner??"")?.name} avanzerà al turno successivo.</p><div><button onClick={()=>{setConfirm(false);setPendingWinner(null);}}>Annulla</button><button onClick={confirmWinner}>Conferma vincitrice</button></div></section></div>}</main>;
}
function MatchCard({match,queenMap,songMap,onSong,onWinner,onDragStart,onDragOver,onDrop}:{match:Match;queenMap:Map<string,Queen>;songMap:Map<string,Song>;onSong:(id:string,song:string)=>void;onWinner:(id:string)=>void;onDragStart:(id:string)=>void;onDragOver:()=>void;onDrop:(id:string)=>void}){
 const song=songMap.get(match.songId??"");return <article className="drag-bracket-match" draggable={!match.winner} onDragStart={()=>onDragStart(match.id)} onDragOver={e=>{e.preventDefault();onDragOver();}} onDrop={()=>onDrop(match.id)}><div className="drag-bracket-pair">{[match.a,match.b].map((id,i)=><div key={i} className={match.winner===id?"is-found":""}>{id?queenMap.get(id)?.name??"Queen":"In attesa"}{match.winner===id&&<Check size={13}/>}</div>)}</div><select disabled={Boolean(match.winner)} value={match.songId??""} onChange={e=>onSong(match.id,e.target.value)}><option value="">Scegli canzone</option>{[...songMap.values()].map(s=><option key={s.id} value={s.id}>{s.song_title} · {s.song_artist??"Artista n/d"}</option>)}</select>{song&&<small>{song.preview_url?"Preview disponibile":"Preview non disponibile"}</small>}{match.a&&match.b&&!match.winner&&<div className="drag-match-actions"><button onClick={()=>onWinner(match.a!)}>Vince {queenMap.get(match.a)?.name}</button><button onClick={()=>onWinner(match.b!)}>Vince {queenMap.get(match.b)?.name}</button></div>}</article>;
}
