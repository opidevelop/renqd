"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {Check,ChevronDown,ChevronUp,CircleDot,Trophy} from "lucide-react";
import {RenqRankHeading} from "@/components/renq-ranking-ui";
import {createClient} from "@/lib/supabase/client";

type GradeItem={id:string;title:string;title_snapshot:string;sort_order:number;rank_position:number|null;tie_group_id?:string|null;image_url:string|null;description:string|null;score?:number|null;tie_order?:number|null};
type GradeRanking={id:string;public_slug?:string;title:string;mode:string;status:string;visibility:string;participation_mode:string;allow_ties:boolean;settings:Record<string,unknown>;created_at:string;started_at?:string|null;completed_at?:string|null};
type Label={name:string;min:number;max:number;color:string};
type Config={criterion:"score"|"position";labels:Label[]};
const defaultConfig:Config={criterion:"score",labels:[{name:"Win",min:9.5,max:10,color:"#e58a32"},{name:"High",min:8,max:9.4,color:"#8c72cf"},{name:"Safe",min:6,max:7.9,color:"#4c9b82"},{name:"Low",min:0,max:5.9,color:"#9b9690"}]};
function readConfig(value:unknown):Config{if(!value||typeof value!=="object")return defaultConfig;const raw=value as Partial<Config>;const labels=Array.isArray(raw.labels)?raw.labels.filter(x=>x&&typeof x.name==="string"&&typeof x.min==="number"&&typeof x.max==="number"&&typeof x.color==="string"):[];return {criterion:raw.criterion==="position"?"position":"score",labels};}
function labelFor(score:number,position:number,config:Config){const value=config.criterion==="score"?score:position;return config.labels.find(label=>label.name.trim()&&value>=label.min&&value<=label.max)??null;}
function isValidGradeScore(value:string){return /^(10([,.]0)?|[0-9]([,.][0-9])?)$/.test(value.trim());}

function GradeScoreInput({value,onCommit,placeholder,ariaLabel,disabled=false}:{value:string;onCommit:(value:string)=>void;placeholder?:string;ariaLabel:string;disabled?:boolean}){
 const [draft,setDraft]=useState(value);useEffect(()=>setDraft(value),[value]);
 function commit(){
  const clean=draft.trim();
  if(!clean){setDraft("");onCommit("");return;}
  if(isValidGradeScore(clean)){
   const normalized=Number(clean.replace(",",".")).toFixed(1).replace(".",",");
   setDraft(normalized);
   onCommit(normalized);
  }else{
   setDraft(value);
  }
 }
 return <input type="text" inputMode="decimal" placeholder={placeholder} value={draft} aria-label={ariaLabel} disabled={disabled}
  onChange={event=>setDraft(event.target.value.replace(/[^0-9,.]/g,"").replace(/\\./g,","))}
  onBlur={commit}
  onKeyDown={event=>{if(event.key==="Enter")event.currentTarget.blur();}}/>;
}

type GradeMultiplayer={mode:"COLLABORATIVE"|"COMPETITIVE";status:string;progressStatus:string;deadlineAt:string|null};
export function GradeExperience({ranking,items:initialItems,multiplayer}:{ranking:GradeRanking;items:GradeItem[];multiplayer?:GradeMultiplayer|null}){
 const router=useRouter();const config=readConfig(ranking.settings?.gradeConfig);const isMultiplayer=Boolean(multiplayer);const isCompetitive=multiplayer?.mode==="COMPETITIVE";const isCollaborative=multiplayer?.mode==="COLLABORATIVE";const [finished,setFinished]=useState(multiplayer?.progressStatus==="FINISHED"||multiplayer?.progressStatus==="INCOMPLETE");const [scores,setScores]=useState<Record<string,string>>(()=>Object.fromEntries(initialItems.map(item=>[item.id,item.score===null||item.score===undefined?"":String(item.score).replace(".",",")])));const [tieOrder,setTieOrder]=useState<Record<string,number>>(()=>Object.fromEntries(initialItems.map(item=>[item.id,item.tie_order&&item.tie_order>0?item.tie_order:item.sort_order])));const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{if(!isCollaborative)return;const supabase=createClient();const refresh=async()=>{const {data}=await supabase.from("ranking_items").select("id,score,tie_order,sort_order").eq("ranking_id",ranking.id);if(!data)return;setScores(Object.fromEntries(data.map(row=>[row.id,row.score===null||row.score===undefined?"":String(row.score).replace(".",",")])));setTieOrder(Object.fromEntries(data.map(row=>[row.id,row.tie_order??row.sort_order])));};const channel=supabase.channel("renqd-grade-mp-"+ranking.id).on("postgres_changes",{event:"*",schema:"public",table:"ranking_items",filter:"ranking_id=eq."+ranking.id},()=>{void refresh();}).subscribe();return()=>{void supabase.removeChannel(channel);};},[isCollaborative,ranking.id]);
 const validScore=isValidGradeScore;
 const scoredCount=initialItems.filter(item=>isValidGradeScore(scores[item.id]??"")).length;
 const sorted=useMemo(()=>[...initialItems].sort((a,b)=>{const av=scores[a.id]?.trim()??"",bv=scores[b.id]?.trim()??"";const aValid=isValidGradeScore(av),bValid=isValidGradeScore(bv);if(aValid&&bValid){const diff=Number(av.replace(",","."))-Number(bv.replace(",","."));if(diff!==0)return -diff;}else if(aValid!==bValid)return aValid?-1:1;return (tieOrder[a.id]??a.sort_order)-(tieOrder[b.id]??b.sort_order)||a.sort_order-b.sort_order;}),[initialItems,scores,tieOrder]);
 const scoreValue=(id:string)=>Number((scores[id]??"").replace(",","."));
 const positionMap=new Map<string,number>();let position=0;let previous:number|null=null;
 for(const item of sorted){if(!isValidGradeScore(scores[item.id]??""))continue;const current=scoreValue(item.id);if(previous===null||current!==previous)position++;positionMap.set(item.id,position);previous=current;}
 function moveTie(itemId:string,direction:-1|1){const current=sorted.filter(item=>validScore(scores[item.id]??"")&&scoreValue(item.id)===scoreValue(itemId));const index=current.findIndex(item=>item.id===itemId),target=index+direction;if(target<0||target>=current.length)return;const next={...tieOrder};const a=current[index],b=current[target];next[a.id]=tieOrder[b.id]??b.sort_order;next[b.id]=tieOrder[a.id]??a.sort_order;setTieOrder(next);void saveMultiplayerGrade(scores,next);}
 async function finish(){if(busy)return;if(scoredCount===0){setError("Assegna almeno un voto prima di completare il Grade.");return;}setBusy(true);setError("");try{const snapshotItems=initialItems.map((item,index)=>({id:item.id,score:isValidGradeScore(scores[item.id]??"")?Number((scores[item.id]??"").replace(",",".")):null,tie_order:tieOrder[item.id]??item.sort_order,rank_position:positionMap.get(item.id)??null}));if(isCompetitive){await multiplayerPost({action:"submit-result",rankingId:ranking.id,resultSnapshot:{items:snapshotItems}});}else if(isCollaborative){await saveMultiplayerGrade(scores,tieOrder);await multiplayerPost({action:"mark-finished",rankingId:ranking.id});}else{const rated=initialItems.filter(item=>isValidGradeScore(scores[item.id]??""));const normalized=Object.fromEntries(rated.map(item=>[item.id,Number((scores[item.id]??"").replace(",","."))]));const ratedTieOrder=Object.fromEntries(rated.map(item=>[item.id,tieOrder[item.id]??item.sort_order]));await post({action:"complete-grade",rankingId:ranking.id,scores:normalized,tieOrder:ratedTieOrder});await post({action:"save-renq",rankingId:ranking.id});router.replace("/renq/"+(ranking.public_slug??ranking.id));}setFinished(true);router.refresh();}catch(e){setError(e instanceof Error?e.message:"Non è stato possibile completare il Grade.");setBusy(false);}}
 async function post(payload:Record<string,unknown>){const response=await fetch("/api/rankings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw new Error(data.error??"Operazione non riuscita.");return data;}
 async function multiplayerPost(payload:Record<string,unknown>){const response=await fetch("/api/multiplayer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw new Error(data.error??"Operazione multiplayer non riuscita.");return data;}
 async function saveMultiplayerGrade(nextScores:Record<string,string>,nextOrder:Record<string,number>){const rated=initialItems.filter(item=>isValidGradeScore(nextScores[item.id]??""));if(!rated.length)return;const normalized=Object.fromEntries(rated.map(item=>[item.id,Number((nextScores[item.id]??"").replace(",","."))]));const order=Object.fromEntries(rated.map(item=>[item.id,nextOrder[item.id]??item.sort_order]));if(isCollaborative)await multiplayerPost({action:"shared-grade",rankingId:ranking.id,scores:normalized,tieOrder:order});else if(isCompetitive){const snapshotItems=initialItems.map(item=>({id:item.id,score:isValidGradeScore(nextScores[item.id]??"")?Number((nextScores[item.id]??"").replace(",",".")):null,tie_order:nextOrder[item.id]??item.sort_order}));await multiplayerPost({action:"save-progress",rankingId:ranking.id,resultSnapshot:{items:snapshotItems}});}}
 function commitScore(itemId:string,value:string){const next={...scores,[itemId]:value};setScores(next);void saveMultiplayerGrade(next,tieOrder);}

 return <main className="renq-experience mode-grade">
  <div className="renq-page-actions"><span className="grade-mode-pill"><CircleDot size={14}/> GRADE</span></div>
  <section className="renq-panel grade-panel">
   <RenqRankHeading ranking={ranking as never} items={initialItems as never}/>
   <div className="grade-intro"><div><span>VALUTA OGNI ELEMENTO</span><h2>Che voto gli dai?</h2><p>Usa una scala da 0 a 10. Sono ammessi anche i decimali, con una sola cifra dopo la virgola.</p></div><Trophy/></div>
   <div className="grade-progress"><div><strong>{scoredCount} di {initialItems.length}</strong><span>elementi valutati</span></div><div className="grade-progress-track"><i style={{width:(scoredCount/Math.max(initialItems.length,1)*100)+"%"}}/></div></div>
   <div className="grade-live-list">{sorted.filter(item=>validScore(scores[item.id]??"")).map(item=>{const score=scoreValue(item.id),rank=positionMap.get(item.id)??0,label=labelFor(score,rank,config);const group=sorted.filter(other=>isValidGradeScore(scores[other.id]??"")&&scoreValue(other.id)===score);const index=group.findIndex(other=>other.id===item.id);return <article className="grade-item-card" key={item.id}><span className="grade-item-position">{String(rank).padStart(2,"0")}</span>{item.image_url?<img src={item.image_url} alt=""/>:<span className="grade-item-art-placeholder"><CircleDot size={19}/></span>}<div className="grade-item-copy"><strong>{item.title}</strong>{label&&<small style={{color:label.color}}>{label.name}</small>}</div><label className="grade-item-score"><GradeScoreInput value={scores[item.id]??""} ariaLabel={"Voto per "+item.title} onCommit={value=>commitScore(item.id,value)} disabled={finished} disabled={finished}/><small>/10</small></label>{group.length>1&&<div className="grade-tie-controls"><button type="button" disabled={finished||index===0} onClick={()=>moveTie(item.id,-1)} aria-label="Sposta su nel pari merito"><ChevronUp size={15}/></button><button type="button" disabled={finished||index===group.length-1} onClick={()=>moveTie(item.id,1)} aria-label="Sposta giù nel pari merito"><ChevronDown size={15}/></button></div>}</article>;})}</div>
   <div className="grade-unrated"><div className="grade-unrated-heading"><strong>Da valutare</strong><span>{initialItems.length-scoredCount}</span></div>{sorted.filter(item=>!validScore(scores[item.id]??"")).map(item=><article className="grade-unrated-row" key={item.id}>{item.image_url?<img src={item.image_url} alt=""/>:<span className="grade-item-art-placeholder"><CircleDot size={18}/></span>}<strong>{item.title}</strong><label><GradeScoreInput value={scores[item.id]??""} placeholder="—" ariaLabel={"Voto per "+item.title} onCommit={value=>commitScore(item.id,value)}/><span>/10</span></label></article>)}</div>
   {error&&<p className="renq-error" role="alert">{error}</p>}
   {finished?<div className="renq-finish"><Trophy/><h2>Hai completato il tuo Grade.</h2><p>Attendi che gli altri partecipanti terminino o che il creatore avvii il Reveal.</p><a className="renq-primary-button" href={"/multiplayer/"+ranking.id}>Torna alla sessione</a></div>:<button type="button" className="renq-primary-button renq-finish-button" onClick={()=>void finish()} disabled={busy||scoredCount===0}>{busy?"Salvataggio…":isMultiplayer?"Completa il Grade":"Pubblica Grade"} <Check/></button>}
   <p className="grade-publish-note">Puoi pubblicare anche con elementi ancora da valutare: resteranno in una sezione separata e non entreranno nella media.</p>
  </section>
 </main>;
}
