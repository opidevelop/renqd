import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ItemInput={id:string;title:string;subtitle?:string;imageUrl?:string;previewUrl?:string;appleMusicUrl?:string;spotifyUrl?:string;source?:"catalog"|"manual";payload?:unknown};
const modeMap:Record<string,string>={renq:"RENQ",battle:"BATTLE_RENQ",speed:"SPEED_RENQ"};
const categoryMap:Record<string,string>={music:"MUSIC",games:"VIDEOGAME",film:"CINEMA",books:"BOOK",sport:"OTHER",food:"OTHER",travel:"OTHER",custom:"CUSTOM"};
function jsonError(message:string,status=400){return NextResponse.json({error:message},{status});}
export async function POST(request:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return jsonError("Sessione scaduta. Accedi di nuovo.",401);
 const body=await request.json().catch(()=>null);if(!body)return jsonError("Richiesta non valida.");
 if(body.action==="start-battle"){
  const {rankingId,pairs,difficulty}=body as {rankingId:string;pairs:{a:string;b:string}[];difficulty:string};
  const {data:ranking,error:rankingError}=await supabase.from("rankings").select("id,mode,user_id,allow_ties").eq("id",rankingId).eq("user_id",user.id).single();
  if(rankingError||!ranking||ranking.mode!=="BATTLE_RENQ")return jsonError("Battle Renq non trovato.",404);
  const {data:items,error:itemsError}=await supabase.from("ranking_items").select("id").eq("ranking_id",rankingId);
  if(itemsError||!items||items.length<2)return jsonError("Servono almeno due elementi per avviare un Battle Renq.");
  const valid=new Set(items.map(x=>x.id));if(!Array.isArray(pairs)||pairs.some(p=>!valid.has(p.a)||!valid.has(p.b)||p.a===p.b))return jsonError("Confronti non validi.");
  const {data:session,error}=await supabase.from("ranking_battle_sessions").insert({ranking_id:rankingId,user_id:user.id,difficulty,algorithm_key:"pairwise-ranking",algorithm_version:"1.0",total_pairs:pairs.length,comparison_state:{pairs,cursor:0,wins:{}}}).select("id").single();
  if(error||!session)return jsonError(error?.message??"Impossibile avviare la sfida.",500);
  await supabase.from("rankings").update({status:"ACTIVE",started_at:new Date().toISOString()}).eq("id",rankingId);
  return NextResponse.json({sessionId:session.id});
 }
 if(body.action==="battle-pick"){
  const {sessionId,winnerId}=body;
  const {data:session,error}=await supabase.from("ranking_battle_sessions").select("*").eq("id",sessionId).eq("user_id",user.id).single();
  if(error||!session||session.status!=="ACTIVE")return jsonError("Sessione Battle non disponibile.",404);
  const state=session.comparison_state as {pairs:{a:string;b:string}[];cursor:number;wins:Record<string,number>};
  const pair=state.pairs[state.cursor];if(!pair)return jsonError("Non ci sono altri confronti.");
  if(winnerId!==pair.a&&winnerId!==pair.b)return jsonError("Scelta non valida.");
  const [a,b]=[pair.a,pair.b].sort();const {error:insertError}=await supabase.from("ranking_battle_comparisons").insert({session_id:sessionId,item_a_id:a,item_b_id:b,winner_item_id:winnerId});
  if(insertError)return jsonError(insertError.message,500);
  state.wins[winnerId]=(state.wins[winnerId]??0)+1;state.cursor++;
  const completed=state.cursor>=state.pairs.length;
  const {error:updateError}=await supabase.from("ranking_battle_sessions").update({completed_pairs:state.cursor,comparison_state:state,status:completed?"COMPLETED":"ACTIVE",completed_at:completed?new Date().toISOString():null}).eq("id",sessionId);
  if(updateError)return jsonError(updateError.message,500);
  if(completed){
   const {data:rankingTieSetting}=await supabase.from("rankings").select("allow_ties").eq("id",session.ranking_id).single();const rankingAllowsTies=Boolean(rankingTieSetting?.allow_ties);
   const {data:allItems}=await supabase.from("ranking_items").select("id").eq("ranking_id",session.ranking_id);
   const ordered=(allItems??[]).map(x=>x.id).sort((a,b)=>(state.wins[b]??0)-(state.wins[a]??0));
   const tieIds=new Map<string,string>();if(rankingAllowsTies){const byWins=new Map<number,string[]>();for(const id of ordered){const wins=state.wins[id]??0;const group=byWins.get(wins)??[];group.push(id);byWins.set(wins,group);}for(const group of byWins.values())if(group.length>1){const groupId=crypto.randomUUID();for(const id of group)tieIds.set(id,groupId);}}
   let position=0;let previousWins:number|null=null;for(let i=0;i<ordered.length;i++){const id=ordered[i];const wins=state.wins[id]??0;if(!tieIds.has(id)||wins!==previousWins)position=i+1-[...tieIds.entries()].filter(([member])=>ordered.indexOf(member)<i&&state.wins[member]===wins).length;previousWins=wins;await supabase.from("ranking_items").update({rank_position:position,tie_group_id:tieIds.get(id)??null}).eq("id",id);}
   await supabase.from("rankings").update({status:"COMPLETED",completed_at:new Date().toISOString()}).eq("id",session.ranking_id);
  }
  return NextResponse.json({completed,cursor:state.cursor,total:state.pairs.length,wins:state.wins});
 }
 if(body.action==="start-speed"){
  const {rankingId,durationSeconds}=body;
  if(!Number.isInteger(durationSeconds)||durationSeconds<1||durationSeconds>10800)return jsonError("Durata non valida.");
  const {data:ranking}=await supabase.from("rankings").select("id,mode").eq("id",rankingId).eq("user_id",user.id).single();
  if(!ranking||ranking.mode!=="SPEED_RENQ")return jsonError("Speed Renq non trovato.",404);
  const deadline=new Date(Date.now()+durationSeconds*1000).toISOString();
  const {data:session,error}=await supabase.from("ranking_speed_sessions").insert({ranking_id:rankingId,user_id:user.id,duration_seconds:durationSeconds,deadline_at:deadline}).select("id,started_at,deadline_at").single();
  if(error||!session)return jsonError(error?.message??"Impossibile avviare il timer.",500);
  await supabase.from("rankings").update({status:"ACTIVE",started_at:session.started_at}).eq("id",rankingId);
  return NextResponse.json({session});
 }
 if(body.action==="complete-speed"){
  const {sessionId,rankingId,orderedIds,tieMap={}}=body as {sessionId:string;rankingId:string;orderedIds:string[];tieMap?:Record<string,string>};
  const {data:session}=await supabase.from("ranking_speed_sessions").select("*").eq("id",sessionId).eq("ranking_id",rankingId).eq("user_id",user.id).single();
  if(!session||session.status!=="ACTIVE")return jsonError("Sessione Speed non disponibile.",404);
  const {data:items}=await supabase.from("ranking_items").select("id").eq("ranking_id",rankingId);
  const {data:ranking}=await supabase.from("rankings").select("allow_ties").eq("id",rankingId).eq("user_id",user.id).single();
  const valid=new Set((items??[]).map(x=>x.id));if(!Array.isArray(orderedIds)||orderedIds.length!==valid.size||new Set(orderedIds).size!==valid.size||orderedIds.some(id=>!valid.has(id)))return jsonError("Ordine degli elementi non valido.");
  const firstPosition=new Map<string,number>();let position=0;for(let i=0;i<orderedIds.length;i++){const id=orderedIds[i];const group=ranking?.allow_ties?tieMap[id]:undefined;let rank:number;if(group&&firstPosition.has(group)){rank=firstPosition.get(group)!;}else{position++;rank=position;if(group)firstPosition.set(group,rank);}const {error:positionError}=await supabase.from("ranking_items").update({rank_position:rank,tie_group_id:group??null}).eq("id",id);if(positionError)return jsonError(positionError.message,500);}
  const timedOut=Date.now()>new Date(session.deadline_at).getTime();
  await supabase.from("ranking_speed_sessions").update({status:timedOut?"TIMED_OUT":"COMPLETED",completed_at:new Date().toISOString(),result_snapshot:{orderedIds}}).eq("id",sessionId);
  await supabase.from("rankings").update({status:"COMPLETED",completed_at:new Date().toISOString()}).eq("id",rankingId);
  return NextResponse.json({timedOut});
 }
 if(body.action==="finish-renq"){
  const {rankingId,orderedIds,tieMap={}}=body as {rankingId:string;orderedIds:string[];tieMap?:Record<string,string>};
  const {data:ranking}=await supabase.from("rankings").select("id,status,mode,allow_ties").eq("id",rankingId).eq("user_id",user.id).single();
  if(!ranking||ranking.mode!=="RENQ")return jsonError("Renq non trovato.",404);
  if(ranking.status==="COMPLETED")return NextResponse.json({ok:true});
  const {data:rows,error}=await supabase.from("ranking_items").select("id").eq("ranking_id",rankingId);
  const valid=new Set((rows??[]).map(x=>x.id));if(error||!Array.isArray(orderedIds)||orderedIds.length!==valid.size||new Set(orderedIds).size!==valid.size||orderedIds.some(id=>!valid.has(id)))return jsonError("Ordine degli elementi non valido.");
  const firstPosition=new Map<string,number>();let position=0;for(let i=0;i<orderedIds.length;i++){const id=orderedIds[i];const group=ranking.allow_ties?tieMap[id]:undefined;let rank:number;if(group&&firstPosition.has(group)){rank=firstPosition.get(group)!;}else{position++;rank=position;if(group)firstPosition.set(group,rank);}const {error:positionError}=await supabase.from("ranking_items").update({rank_position:rank,tie_group_id:group??null}).eq("id",id);if(positionError)return jsonError(positionError.message,500);}
  const {error:completeError}=await supabase.from("rankings").update({status:"COMPLETED",completed_at:new Date().toISOString()}).eq("id",rankingId);
  if(completeError)return jsonError(completeError.message,500);
  return NextResponse.json({ok:true});
 }
 if(body.action==="reorder"){
  const {rankingId,orderedIds,tieMap={}}=body as {rankingId:string;orderedIds:string[];tieMap?:Record<string,string>};
  const {data:ranking}=await supabase.from("rankings").select("id,status,allow_ties").eq("id",rankingId).eq("user_id",user.id).single();
  if(!ranking||ranking.status==="COMPLETED")return jsonError("Questa classifica non è modificabile.",404);
  const {data:items}=await supabase.from("ranking_items").select("id").eq("ranking_id",rankingId);
  const valid=new Set((items??[]).map(x=>x.id));if(!Array.isArray(orderedIds)||orderedIds.length!==valid.size||orderedIds.some(id=>!valid.has(id)))return jsonError("Ordine degli elementi non valido.");
  // sort_order is immutable creation order; only rank_position and tie_group_id are mutable.
  if(new Set(orderedIds).size!==valid.size)return jsonError("La lista contiene elementi duplicati.");
  const firstPosition=new Map<string,number>();let position=0;for(let i=0;i<orderedIds.length;i++){const id=orderedIds[i];const group=ranking.allow_ties?tieMap[id]:undefined;let rank:number;if(group&&firstPosition.has(group)){rank=firstPosition.get(group)!;}else{position++;rank=position;if(group)firstPosition.set(group,rank);}const {error}=await supabase.from("ranking_items").update({rank_position:rank,tie_group_id:group??null}).eq("id",id);if(error)return jsonError(error.message,500);}
  return NextResponse.json({ok:true});
 }
 const {title,mode,category,contentType,sportDiscipline,participation,collaborators,visibility,access,allowTies,duration,battleDepth,items}=body as {title:string;mode:string;category:string;contentType:string;sportDiscipline?:string;participation:string;collaborators:number;visibility:string;access:string;allowTies:boolean;duration:number;battleDepth:string;items:ItemInput[]};
 if(!title?.trim()||!modeMap[mode]||!Array.isArray(items)||items.length<1||items.length>100)return jsonError("Completa il titolo e inserisci da 1 a 100 elementi.");
 const settings={category,contentType,sportDiscipline:sportDiscipline??null,access,collaborators:participation==="collab"?collaborators:1,durationSeconds:mode==="speed"?duration:null,battleDepth};
 const {data:ranking,error:rankingError}=await supabase.from("rankings").insert({user_id:user.id,title:title.trim(),album_id:null,album_title:null,mode:modeMap[mode],participation_mode:participation==="collab"?"COLLAB":"SOLO",visibility:visibility==="live"?"LIVE":"REVEAL",status:"DRAFT",allow_ties:Boolean(allowTies),settings}).select("id").single();
 if(rankingError||!ranking)return jsonError(rankingError?.message??"Impossibile creare il Renq.",500);
 const customRows=items.map(item=>({owner_id:user.id,category:categoryMap[category]??"CUSTOM",title:item.title.trim().slice(0,120),description:item.subtitle??null,image_url:item.imageUrl??null,is_reusable:false,metadata:{source:item.source??"manual",previewUrl:item.previewUrl??null,appleMusicUrl:item.appleMusicUrl??null,spotifyUrl:item.spotifyUrl??null,provider:item.payload&&typeof item.payload==="object"?(item.payload as Record<string,unknown>).provider??null:null,externalId:item.id??null,contentType}}));
 const {data:customItems,error:customError}=await supabase.from("custom_items").insert(customRows).select("id,title");
 if(customError||!customItems||customItems.length!==items.length){await supabase.from("rankings").delete().eq("id",ranking.id);return jsonError(customError?.message??"Impossibile salvare gli elementi.",500);}
 const rankingRows=customItems.map((item,index)=>({ranking_id:ranking.id,custom_item_id:item.id,title_snapshot:item.title,sort_order:index+1}));
 const {error:itemError}=await supabase.from("ranking_items").insert(rankingRows);
 if(itemError){await supabase.from("rankings").delete().eq("id",ranking.id);return jsonError(itemError.message,500);}
 return NextResponse.json({id:ranking.id});
}
