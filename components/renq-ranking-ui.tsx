"use client";
import {useRef,useState} from "react";
import type {PointerEvent,ReactNode} from "react";
import {ChevronDown,ChevronUp,Layers3,Pause,Play,Trophy} from "lucide-react";
import {RenqReveal} from "@/components/renq-reveal";

export type RenqItem={id:string;title:string;title_snapshot:string;sort_order:number;rank_position:number|null;tie_group_id?:string|null;image_url:string|null;description:string|null;preview_url?:string|null;apple_music_url?:string|null;spotify_url?:string|null};
export type RenqRanking={id:string;public_slug?:string;title:string;mode:string;status:string;visibility:string;participation_mode:string;allow_ties:boolean;settings:Record<string,unknown>;created_at:string;started_at?:string|null;completed_at?:string|null};

export function RenqMusicActions({item}:{item:RenqItem}){
 const audioRef=useRef<HTMLAudioElement>(null);const[playing,setPlaying]=useState(false);
 async function togglePreview(){const audio=audioRef.current;if(!audio)return;if(playing){audio.pause();setPlaying(false);}else{try{await audio.play();setPlaying(true);}catch{setPlaying(false);}}}
 return <div className="renq-music-actions">
  {item.preview_url&&<><audio ref={audioRef} src={item.preview_url} preload="none" onEnded={()=>setPlaying(false)} onPause={()=>setPlaying(false)}/><button type="button" className="music-action preview-action" onClick={()=>void togglePreview()} aria-label={playing?"Pausa anteprima":"Ascolta anteprima"}>{playing?<Pause size={15}/>:<Play size={15}/>}</button></>}
  {item.spotify_url&&<a className="music-action spotify-action" href={item.spotify_url} target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M6.2 9.2c4.2-1.2 8.5-.7 11.8 1.2M7 12.1c3.6-1 7.1-.5 9.9 1.1M7.8 14.8c2.8-.7 5.5-.3 7.8.9" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"/></svg></a>}
  {item.apple_music_url&&<a className="music-action apple-action" href={item.apple_music_url} target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.7 2.5c-.1 1.1-.5 2-1.3 2.8-.8.8-1.8 1.2-2.9 1.1-.1-1 .3-2 1.1-2.8.8-.7 1.9-1.2 3.1-1.1ZM20.5 17.2c-.5 1.1-.8 1.6-1.4 2.5-.9 1.3-2.1 2.9-3.6 2.9-1.3 0-1.6-.8-3.4-.8s-2.1.8-3.4.8c-1.5 0-2.6-1.4-3.5-2.7C2.8 15.7 2.5 10.7 4 8.1c1.1-1.8 2.8-2.9 4.6-2.9 1.4 0 2.3.8 3.5.8s1.9-.8 3.7-.8c1.5 0 3.1.8 4.2 2.1-3.7 2-3.1 7.3.5 9.9Z"/></svg></a>}
 </div>;
}

export function RenqRankHeading({ranking,items}:{ranking:RenqRanking;items:RenqItem[]}){
 const settings=ranking.settings??{};const rawPosition=settings.coverPosition as {x?:unknown;y?:unknown}|null;const coverPosition={x:typeof rawPosition?.x==="number"?rawPosition.x:50,y:typeof rawPosition?.y==="number"?rawPosition.y:50};
 const cover=typeof settings.coverImageUrl==="string"?settings.coverImageUrl:items.find(item=>item.image_url)?.image_url??null;
 return <div className={"renq-card-heading"+(cover?" has-cover":"")}>{cover&&<div className="renq-card-cover"><img src={cover} alt="" style={{objectPosition:coverPosition.x+"% "+coverPosition.y+"%"}}/><span/></div>}<div className="renq-card-heading-copy"><h1>{ranking.title}</h1><p>{String(settings.category??"custom").toUpperCase()} · {String(settings.contentType??"Lista personalizzata")} · {items.length} elementi</p><div className="renq-meta-chips"><span>{ranking.participation_mode==="COLLAB"?"Collaborativa":"Solo"}</span><span>{ranking.visibility==="LIVE"?"Live":"Reveal"}</span><span>{ranking.allow_ties?"Ex aequo":"Senza ex aequo"}</span>{ranking.mode==="SPEED_RENQ"&&ranking.started_at&&ranking.completed_at&&<span>Tempo impiegato {Math.floor(Math.max(0,new Date(ranking.completed_at).getTime()-new Date(ranking.started_at).getTime())/60000)}m {String(Math.floor(Math.max(0,new Date(ranking.completed_at).getTime()-new Date(ranking.started_at).getTime())/1000)%60).padStart(2,"0")}s</span>}</div></div></div>;
}

export function getRenqRankPositions(items:RenqItem[],tieMap:Record<string,string>={}){const positions:Record<string,number>={};const groupRanks=new Map<string,number>();let skipped=0;for(let i=0;i<items.length;i++){const item=items[i];const group=tieMap[item.id]??item.tie_group_id??null;if(group){if(!groupRanks.has(group))groupRanks.set(group,i+1-skipped);else skipped++;positions[item.id]=groupRanks.get(group)!;}else positions[item.id]=i+1-skipped;}return positions;}

export function RenqFinalRankList({items,tieMap={}}:{items:RenqItem[];tieMap?:Record<string,string>}){
 const positions=getRenqRankPositions(items,tieMap);
 return <div className="renq-sort-list">{items.map((item,index)=>{const position=positions[item.id]??item.rank_position??index+1;return <article className="renq-sort-row is-final-row" key={item.id}><strong className="renq-position">{String(position).padStart(2,"0")}</strong>{item.image_url?<img src={item.image_url} alt=""/>:<span className="renq-item-placeholder"><Layers3/></span>}<div className="renq-sort-copy"><strong>{item.title}</strong>{item.description&&<small>{item.description}</small>}</div><div className="renq-final-actions"><RenqMusicActions item={item}/></div><span className="renq-medal-slot">{position<=3?<span className={"renq-medal medal-"+position} aria-label={"Posizione "+position}>{position===1?"🥇":position===2?"🥈":"🥉"}</span>:null}</span></article>;})}</div>;
}

type SortableProps={items:RenqItem[];positions:Record<string,number>;allowTies:boolean;tieMap:Record<string,string>;onToggleTie:(index:number)=>void;onMove:(index:number,direction:-1|1)=>void;showDescription?:boolean;showDragHandle?:boolean;dragIndex?:number|null;onDragStart?:(index:number,event:PointerEvent<HTMLSpanElement>)=>void;onDragMove?:(index:number,event:PointerEvent<HTMLElement>)=>void;onDragEnd?:()=>void};
export function RenqSortableList({items,positions,allowTies,tieMap,onToggleTie,onMove,showDescription=true,showDragHandle=false,dragIndex=null,onDragStart,onDragMove,onDragEnd}:SortableProps){
 return <div className="renq-sort-list">{items.map((item,index)=>{const position=positions[item.id]??item.rank_position??index+1;return <article className={"renq-sort-row"+(dragIndex===index?" is-dragging":"")} data-renq-index={index} key={item.id} onPointerMove={showDragHandle?event=>onDragMove?.(index,event):undefined} onPointerUp={showDragHandle?onDragEnd:undefined} onPointerCancel={showDragHandle?onDragEnd:undefined}>
  {showDragHandle&&<span className="renq-drag-handle" role="button" tabIndex={0} aria-label="Trascina per riordinare" onPointerDown={event=>onDragStart?.(index,event)} onKeyDown={event=>{if(event.key==="ArrowUp")onMove(index,-1);if(event.key==="ArrowDown")onMove(index,1);}}>⠿</span>}
  <strong className="renq-position">{String(position).padStart(2,"0")}</strong>
  {item.image_url?<img src={item.image_url} alt=""/>:<span className="renq-item-placeholder"><Layers3/></span>}
  <div className="renq-sort-copy"><strong>{item.title}</strong>{showDescription&&<small>{item.description??"Elemento della tua classifica"}</small>}</div>
  <div className="renq-sort-actions">{allowTies&&index>0&&<button className={tieMap[item.id]&&tieMap[item.id]===tieMap[items[index-1].id]?"is-tied":""} type="button" onClick={()=>onToggleTie(index)} aria-label="Attiva o rimuovi pari merito">=</button>}<button type="button" onClick={()=>onMove(index,-1)} disabled={index===0} aria-label="Sposta su"><ChevronUp/></button><button type="button" onClick={()=>onMove(index,1)} disabled={index===items.length-1} aria-label="Sposta giù"><ChevronDown/></button></div>
  <div className="renq-row-extra"><RenqMusicActions item={item}/></div>
 </article>;})}</div>;
}

type FinishedProps={ranking:RenqRanking;items:RenqItem[];rankPositions:Record<string,number>;tieMap:Record<string,string>;finishActions:ReactNode;title:string;description:string;coverPosition:{x:number;y:number}};
export function RenqFinishedPanel({ranking,items,rankPositions,tieMap,finishActions,title,description,coverPosition}:FinishedProps){
 const finalPositions=ranking.mode==="BATTLE_RENQ"?Object.fromEntries(items.map(item=>[item.id,item.rank_position??rankPositions[item.id]??999])):rankPositions;
 const ordered=[...items].sort((a,b)=>(finalPositions[a.id]??a.rank_position??999)-(finalPositions[b.id]??b.rank_position??999));
 if(ranking.visibility==="REVEAL")return <RenqReveal title={ranking.title} mode={ranking.mode} category={String(ranking.settings.category??"Renq")} contentType={String(ranking.settings.contentType??"Lista personalizzata")} coverImageUrl={typeof ranking.settings.coverImageUrl==="string"?ranking.settings.coverImageUrl:null} coverPosition={coverPosition} participationMode={ranking.participation_mode} allowTies={ranking.allow_ties} items={ordered.map(item=>({...item,rank_position:finalPositions[item.id]??item.rank_position}))} actions={finishActions}/>;
 return <div className="renq-finish"><Trophy/><h2>{title}</h2><p>{description}</p><RenqFinalRankList items={ordered} tieMap={tieMap}/>{finishActions}</div>;
}
