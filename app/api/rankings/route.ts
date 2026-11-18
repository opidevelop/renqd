import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountAccess } from "@/lib/supabase/authorization";

type ItemInput={id:string;title:string;subtitle?:string;imageUrl?:string;previewUrl?:string;appleMusicUrl?:string;spotifyUrl?:string;source?:"catalog"|"manual";payload?:unknown};
const modeMap:Record<string,string>={renq:"RENQ",battle:"BATTLE_RENQ",speed:"SPEED_RENQ"};
const categoryMap:Record<string,string>={music:"MUSIC",games:"VIDEOGAME",film:"CINEMA",books:"BOOK",sport:"OTHER",food:"OTHER",travel:"OTHER",custom:"CUSTOM"};
function jsonError(message:string,status=400){return NextResponse.json({error:message},{status});}
function validHttpsUrl(value:unknown):value is string{if(typeof value!=="string"||value.length>2048)return false;try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password;}catch{return false;}}
export async function POST(request:Request){
 const supabase=await createClient();const {user,status}=await getAccountAccess(supabase);if(!user)return jsonError("Sessione scaduta. Accedi di nuovo.",401);if(status!=="APPROVED")return jsonError("Account non ancora abilitato.",403);
 const body=await request.json().catch(()=>null);if(!body)return jsonError("Richiesta non valida.");
 if(body.action==="update-title"){
  const {rankingId,title}=body as {rankingId:string;title:string};
  const clean=typeof title==="string"?title.trim():"";
  if(!rankingId||!clean||clean.length>80)return jsonError("Il titolo deve contenere da 1 a 80 caratteri.");
  const {data,error}=await supabase.from("rankings").update({title:clean}).eq("id",rankingId).eq("user_id",user.id).eq("status","DRAFT").is("deleted_at",null).select("id").maybeSingle();
  if(error)return jsonError(error.message,500);
  if(!data)return jsonError("Renq non modificabile o non trovato.",404);
  return NextResponse.json({ok:true,title:clean});
 }
 if(body.action==="update-published-renq"){
  const {rankingId,title,orderedIds,tieMap={},visibility,access}=body as {rankingId:string;title:string;orderedIds:string[];tieMap?:Record<string,string>;visibility?:string;access?:string};
  const cleanTitle=typeof title==="string"?title.trim():"";
  if(!rankingId||!cleanTitle||cleanTitle.length>80)return jsonError("Il titolo deve contenere da 1 a 80 caratteri.");
  if(!Array.isArray(orderedIds)||orderedIds.length<1||orderedIds.length>100||new Set(orderedIds).size!==orderedIds.length||orderedIds.some(id=>typeof id!=="string"))return jsonError("Ordine degli elementi non valido.");
  const {data:ranking,error:rankingLookupError}=await supabase.from("rankings").select("id,title,status,settings,visibility").eq("id",rankingId).eq("user_id",user.id).is("deleted_at",null).maybeSingle();
  if(rankingLookupError||!ranking||ranking.status!=="COMPLETED"||!(ranking.settings as Record<string,unknown>|null)?.savedAt)return jsonError("Renq pubblicato non trovato o non modificabile.",404);
  const {data:rows,error:rowsError}=await supabase.from("ranking_items").select("id,rank_position,tie_group_id").eq("ranking_id",rankingId);
  if(rowsError||!rows)return jsonError(rowsError?.message??"Impossibile leggere gli elementi.",500);
  const rowById=new Map(rows.map(row=>[row.id,row]));
  if(rows.length!==orderedIds.length||orderedIds.some(id=>!rowById.has(id)))return jsonError("La lista degli elementi non corrisponde alla classifica.");
  const safeTieMap=tieMap&&typeof tieMap==="object"?tieMap:{};
  const positions=new Map<string,number>();
  const groups=new Map<string,number>();
  let nextPosition=0;
  for(const id of orderedIds){
   const group=typeof safeTieMap[id]==="string"&&safeTieMap[id]?safeTieMap[id]:null;
   if(group&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(group))return jsonError("Gruppo di pari merito non valido.");
   let position:number;
   if(group&&groups.has(group))position=groups.get(group)!;
   else{position=++nextPosition;if(group)groups.set(group,position);}
   positions.set(id,position);
  }
  const changedIds:string[]=[];
  for(const id of orderedIds){
   const group=typeof safeTieMap[id]==="string"&&safeTieMap[id]?safeTieMap[id]:null;
   const {error:updateError}=await supabase.from("ranking_items").update({rank_position:positions.get(id),tie_group_id:group}).eq("id",id).eq("ranking_id",rankingId);
   if(updateError){
    for(const changedId of changedIds){const previous=rowById.get(changedId)!;await supabase.from("ranking_items").update({rank_position:previous.rank_position,tie_group_id:previous.tie_group_id}).eq("id",changedId).eq("ranking_id",rankingId);}
    return jsonError(updateError.message,500);
   }
   changedIds.push(id);
  }
  const settings=(ranking.settings??{}) as Record<string,unknown>;
  const nextVisibility=visibility===undefined?ranking.visibility:visibility;
  if(nextVisibility!=="LIVE"&&nextVisibility!=="REVEAL")return jsonError("Visibilità non valida.");
  const nextAccess=access===undefined?(settings.access==="private"?"private":"public"):access;
  if(nextAccess!=="public"&&nextAccess!=="private")return jsonError("Accesso non valido.");
  const savedSnapshot=settings.savedSnapshot as {items?:Array<Record<string,unknown>>}|undefined;
  const snapshotItems=savedSnapshot?.items;
  if(!Array.isArray(snapshotItems)||snapshotItems.length!==orderedIds.length){
   for(const id of changedIds){const previous=rowById.get(id)!;await supabase.from("ranking_items").update({rank_position:previous.rank_position,tie_group_id:previous.tie_group_id}).eq("id",id).eq("ranking_id",rankingId);}
   return jsonError("Snapshot della classifica non valido.",500);
  }
  const snapshotById=new Map(snapshotItems.map(item=>[String(item.id),item]));
  const nextItems=orderedIds.map(id=>{const item=snapshotById.get(id);return item?{...item,rank_position:positions.get(id)??null,tie_group_id:typeof safeTieMap[id]==="string"&&safeTieMap[id]?safeTieMap[id]:null}:null;});
  if(nextItems.some(item=>item===null)){
   for(const id of changedIds){const previous=rowById.get(id)!;await supabase.from("ranking_items").update({rank_position:previous.rank_position,tie_group_id:previous.tie_group_id}).eq("id",id).eq("ranking_id",rankingId);}
   return jsonError("Snapshot incompleto: impossibile salvare la modifica.",500);
  }
  const nextSettings={...settings,access:nextAccess,savedSnapshot:{...savedSnapshot,items:nextItems}};
  const {error:saveError}=await supabase.from("rankings").update({title:cleanTitle,visibility:nextVisibility,settings:nextSettings,updated_at:new Date().toISOString()}).eq("id",rankingId).eq("user_id",user.id);
  if(saveError){
   for(const id of changedIds){const previous=rowById.get(id)!;await supabase.from("ranking_items").update({rank_position:previous.rank_position,tie_group_id:previous.tie_group_id}).eq("id",id).eq("ranking_id",rankingId);}
   return jsonError(saveError.message,500);
  }
  const {data:version,error:revisionError}=await supabase.rpc("renqd_record_revision",{p_ranking_id:rankingId,p_change_summary:"Modifica classifica pubblicata"});
  if(revisionError){
   await supabase.from("rankings").update({title:ranking.title,visibility:ranking.visibility,settings:ranking.settings}).eq("id",rankingId).eq("user_id",user.id);
   for(const id of changedIds){const previous=rowById.get(id)!;await supabase.from("ranking_items").update({rank_position:previous.rank_position,tie_group_id:previous.tie_group_id}).eq("id",id).eq("ranking_id",rankingId);}
   return jsonError(revisionError.message,500);
  }
  return NextResponse.json({ok:true,title:cleanTitle,visibility:nextVisibility,access:nextAccess,version,items:nextItems});
 }
 if(body.action==="start-battle"){
  const {rankingId,pairs,difficulty}=body as {rankingId:string;pairs:{a:string;b:string}[];difficulty:string};
  if(!Array.isArray(pairs)||pairs.length<1)return jsonError("Confronti non validi.");
  const {data:sessionId,error}=await supabase.rpc("renqd_start_battle_session",{p_ranking_id:rankingId,p_difficulty:difficulty,p_pairs:pairs});
  if(error||!sessionId)return jsonError(error?.message??"Impossibile avviare la sfida.",500);
  return NextResponse.json({sessionId});
 }
 if(body.action==="battle-undo"){
   const {sessionId}=body as {sessionId:string};
   if(typeof sessionId!=="string")return jsonError("Sessione Battle non valida.");
   const {data:session,error:sessionError}=await supabase.from("ranking_battle_sessions").select("id,status").eq("id",sessionId).eq("user_id",user.id).single();
   if(sessionError||!session||session.status!=="ACTIVE")return jsonError("Sessione Battle non disponibile.",404);
   const {data,error}=await supabase.rpc("renqd_undo_battle_choice",{p_session_id:sessionId});
   if(error)return jsonError(error.message,500);
   return NextResponse.json(data??{ok:true});
  }
  if(body.action==="battle-tie"){
  const {sessionId}=body as {sessionId:string};const {data:session,error}=await supabase.from("ranking_battle_sessions").select("*").eq("id",sessionId).eq("user_id",user.id).single();
  if(error||!session||session.status!=="ACTIVE")return jsonError("Sessione Battle non disponibile.",404);
  const state=session.comparison_state as {pairs:{a:string;b:string}[];cursor:number;wins:Record<string,number>;tiePairs?:{a:string;b:string}[]};
  const {data:choice,error:choiceError}=await supabase.rpc("renqd_record_battle_choice",{p_session_id:sessionId,p_winner_item_id:null,p_is_tie:true});
  if(choiceError||!choice)return jsonError(choiceError?.message??"Impossibile registrare il pari merito.",500);
  state.cursor=choice.cursor;state.wins=choice.wins??{};state.tiePairs=choice.tiePairs??[];
  const completed=Boolean(choice.completed);
  if(completed){const {data:allItems}=await supabase.from("ranking_items").select("id").eq("ranking_id",session.ranking_id);const ids=(allItems??[]).map(x=>x.id);const parent=new Map(ids.map(id=>[id,id]));const find=(id:string):string=>{const p=parent.get(id)??id;if(p===id)return id;const root=find(p);parent.set(id,root);return root;};for(const pair of state.tiePairs??[]){const a=find(pair.a),b=find(pair.b);if(a!==b)parent.set(b,a);}const members=new Map<string,string[]>();for(const id of ids){const root=find(id);const group=members.get(root)??[];group.push(id);members.set(root,group);}const tieGroups:Record<string,string>={};for(const group of members.values())if(group.length>1){const groupId=crypto.randomUUID();for(const id of group)tieGroups[id]=groupId;}const groups=[...members.values()].sort((a,b)=>Math.max(...b.map(id=>state.wins[id]??0))-Math.max(...a.map(id=>state.wins[id]??0)));let position=0;const rankPositions:Record<string,number>={};for(const group of groups){position++;for(const id of group)rankPositions[id]=position;}const {error:finalizeError}=await supabase.rpc("renqd_finalize_battle_ranking",{p_session_id:session.id,p_rank_positions:rankPositions,p_tie_groups:tieGroups});if(finalizeError)return jsonError(finalizeError.message,500);return NextResponse.json({completed,cursor:state.cursor,total:state.pairs.length,wins:state.wins,tiePairs:state.tiePairs,tieGroups,rankPositions});}
  return NextResponse.json({completed,cursor:state.cursor,total:state.pairs.length,wins:state.wins,tiePairs:state.tiePairs??[]});
 }
 if(body.action==="battle-pick"){
  const {sessionId,winnerId}=body;
  const {data:session,error}=await supabase.from("ranking_battle_sessions").select("*").eq("id",sessionId).eq("user_id",user.id).single();
  if(error||!session||session.status!=="ACTIVE")return jsonError("Sessione Battle non disponibile.",404);
  const state=session.comparison_state as {pairs:{a:string;b:string}[];cursor:number;wins:Record<string,number>;tiePairs?:{a:string;b:string}[]};
  const {data:choice,error:choiceError}=await supabase.rpc("renqd_record_battle_choice",{p_session_id:sessionId,p_winner_item_id:winnerId,p_is_tie:false});
  if(choiceError||!choice)return jsonError(choiceError?.message??"Impossibile registrare la scelta.",500);
  state.cursor=choice.cursor;state.wins=choice.wins??{};state.tiePairs=choice.tiePairs??[];
  const completed=Boolean(choice.completed);
  if(completed){
   const {data:rankingTieSetting}=await supabase.from("rankings").select("allow_ties").eq("id",session.ranking_id).single();const rankingAllowsTies=Boolean(rankingTieSetting?.allow_ties);
   const {data:allItems}=await supabase.from("ranking_items").select("id").eq("ranking_id",session.ranking_id);const ids=(allItems??[]).map(x=>x.id);
   const parent=new Map(ids.map(id=>[id,id]));const find=(id:string):string=>{const p=parent.get(id)??id;if(p===id)return id;const root=find(p);parent.set(id,root);return root;};
   if(rankingAllowsTies){const byWins=new Map<number,string[]>();for(const id of ids){const wins=state.wins[id]??0;const group=byWins.get(wins)??[];group.push(id);byWins.set(wins,group);}for(const group of byWins.values())if(group.length>1)for(let i=1;i<group.length;i++){const a=find(group[0]),b=find(group[i]);if(a!==b)parent.set(b,a);}
    for(const pair of state.tiePairs??[]){const a=find(pair.a),b=find(pair.b);if(a!==b)parent.set(b,a);}
   }
   const members=new Map<string,string[]>();for(const id of ids){const root=find(id);const group=members.get(root)??[];group.push(id);members.set(root,group);}
   const groups=[...members.values()].sort((a,b)=>Math.max(...b.map(id=>state.wins[id]??0))-Math.max(...a.map(id=>state.wins[id]??0)));
   const tieGroups:Record<string,string>={},rankPositions:Record<string,number>={};let position=0;
   for(const group of groups){position++;const groupId=group.length>1?crypto.randomUUID():null;for(const id of group){rankPositions[id]=position;if(groupId)tieGroups[id]=groupId;}}
   const {error:finalizeError}=await supabase.rpc("renqd_finalize_battle_ranking",{p_session_id:session.id,p_rank_positions:rankPositions,p_tie_groups:tieGroups});
   if(finalizeError)return jsonError(finalizeError.message,500);
   return NextResponse.json({completed,cursor:state.cursor,total:state.pairs.length,wins:state.wins,tiePairs:state.tiePairs??[],tieGroups,rankPositions});
  }
  return NextResponse.json({completed,cursor:state.cursor,total:state.pairs.length,wins:state.wins});
 }
 if(body.action==="start-speed"){
  const {rankingId,durationSeconds}=body as {rankingId:string;durationSeconds:number};
  if(!Number.isInteger(durationSeconds)||durationSeconds<1||durationSeconds>10800)return jsonError("Durata non valida.");
  const {data:session,error}=await supabase.rpc("renqd_start_speed_session",{p_ranking_id:rankingId,p_duration_seconds:durationSeconds});
  if(error||!session)return jsonError(error?.message??"Impossibile avviare il timer.",500);
  return NextResponse.json({session});
 }
 if(body.action==="complete-speed"){
  const {sessionId,rankingId,orderedIds,tieMap={}}=body as {sessionId:string;rankingId:string;orderedIds:string[];tieMap?:Record<string,string>};
  const {data,error}=await supabase.rpc("renqd_complete_speed_session",{p_session_id:sessionId,p_ranking_id:rankingId,p_ordered_ids:orderedIds,p_tie_map:tieMap});
  if(error)return jsonError(error.message,500);
  return NextResponse.json(data??{timedOut:false});
 }
 if(body.action==="finish-renq"){
  const {rankingId,orderedIds,tieMap={}}=body as {rankingId:string;orderedIds:string[];tieMap?:Record<string,string>};
  if(!Array.isArray(orderedIds)||orderedIds.length<1)return jsonError("Ordine degli elementi non valido.");
  const {data,error}=await supabase.rpc("renqd_complete_ranking",{p_ranking_id:rankingId,p_ordered_ids:orderedIds,p_tie_map:tieMap});
  if(error)return jsonError(error.message,500);
  return NextResponse.json(data??{ok:true});
 }
 if(body.action==="reorder"){
  const {rankingId,orderedIds,tieMap={}}=body as {rankingId:string;orderedIds:string[];tieMap?:Record<string,string>};
  if(!Array.isArray(orderedIds)||orderedIds.length<1)return jsonError("Ordine degli elementi non valido.");
  const {data,error}=await supabase.rpc("renqd_reorder_ranking",{p_ranking_id:rankingId,p_ordered_ids:orderedIds,p_tie_map:tieMap});
  if(error)return jsonError(error.message,500);
  return NextResponse.json(data??{ok:true});
 }
 if(body.action==="save-renq"){
  const {rankingId}=body as {rankingId:string};const {data:ranking}=await supabase.from("rankings").select("*").eq("id",rankingId).eq("user_id",user.id).is("deleted_at",null).single();if(!ranking||ranking.status!=="COMPLETED")return jsonError("Completa il Renq prima di salvarlo.");
  const {data:rows,error}=await supabase.from("ranking_items").select("id,title_snapshot,rank_position,tie_group_id,custom_item_id").eq("ranking_id",rankingId).order("rank_position").order("sort_order");if(error||!rows)return jsonError(error?.message??"Impossibile leggere il risultato.",500);
  const customIds=rows.map(x=>x.custom_item_id).filter(Boolean);const {data:custom}=customIds.length?await supabase.from("custom_items").select("id,title,image_url,description,metadata").in("id",customIds):{data:[]};const lookup=new Map((custom??[]).map(x=>[x.id,x]));
  const savedSnapshot={items:rows.map(x=>({id:x.id,title:lookup.get(x.custom_item_id)?.title??x.title_snapshot,image_url:lookup.get(x.custom_item_id)?.image_url??null,description:lookup.get(x.custom_item_id)?.description??null,rank_position:x.rank_position,tie_group_id:x.tie_group_id,metadata:lookup.get(x.custom_item_id)?.metadata??{}}))};
  const settings={...(ranking.settings??{}),savedAt:new Date().toISOString(),savedSnapshot};
  const {data:version,error:saveError}=await supabase.rpc("renqd_save_ranking_snapshot",{p_ranking_id:rankingId,p_settings:settings});if(saveError)return jsonError(saveError.message,500);return NextResponse.json({ok:true,version});
 }
 if(body.action==="restart-renq"){
  const {rankingId}=body as {rankingId:string};
  const {error}=await supabase.rpc("renqd_restart_ranking",{p_ranking_id:rankingId});
  if(error)return jsonError(error.message,500);
  return NextResponse.json({ok:true});
 }
 if(body.action==="toggle-like"){
  const {rankingId}=body as {rankingId:string};
  const {data:ranking}=await supabase.from("rankings").select("id").eq("id",rankingId).eq("user_id",user.id).single();
  if(!ranking)return jsonError("Renq non trovato.",404);
  const {data:existing}=await supabase.from("ranking_likes").select("user_id").eq("ranking_id",rankingId).eq("user_id",user.id).maybeSingle();
  if(existing){const {error}=await supabase.from("ranking_likes").delete().eq("ranking_id",rankingId).eq("user_id",user.id);if(error)return jsonError(error.message,500);}
  else{const {error}=await supabase.from("ranking_likes").insert({ranking_id:rankingId,user_id:user.id});if(error)return jsonError(error.message,500);}
  const {count,error}=await supabase.from("ranking_likes").select("user_id",{count:"exact",head:true}).eq("ranking_id",rankingId);
  if(error)return jsonError(error.message,500);
  return NextResponse.json({liked:!existing,likeCount:count??0});
 }
 if(body.action==="add-comment"){
  const {rankingId,body:commentBody}=body as {rankingId:string;body:string};
  const clean=typeof commentBody==="string"?commentBody.trim():"";
  if(!clean||clean.length>4000)return jsonError("Il commento deve contenere da 1 a 4000 caratteri.");
  const {data:ranking}=await supabase.from("rankings").select("id").eq("id",rankingId).eq("user_id",user.id).single();
  if(!ranking)return jsonError("Renq non trovato.",404);
  const {data:comment,error}=await supabase.from("ranking_comments").insert({ranking_id:rankingId,author_id:user.id,body:clean}).select("id,body,created_at,author_id").single();
  if(error||!comment)return jsonError(error?.message??"Impossibile pubblicare il commento.",500);
  return NextResponse.json({comment});
 }
 if(body.action==="update-cover"){
  const {rankingId,coverImagePath}=body as {rankingId:string;coverImagePath:string|null};
  const {data:ranking}=await supabase.from("rankings").select("id,status,settings").eq("id",rankingId).eq("user_id",user.id).single();
  if(!ranking||ranking.status!=="COMPLETED"||!(ranking.settings as Record<string,unknown>|null)?.savedAt)return jsonError("Renq salvato non trovato.",404);
  if(coverImagePath!==null&&(typeof coverImagePath!=="string"||!new RegExp("^"+user.id+"/[a-f0-9-]{36}\\.(jpg|png|webp)$","i").test(coverImagePath)))return jsonError("La copertina non è valida o non appartiene al tuo spazio.");
  const coverImageUrl=(body as {coverImageUrl?:string|null}).coverImageUrl??null;if(coverImageUrl!==null&&!validHttpsUrl(coverImageUrl))return jsonError("Inserisci un URL HTTPS valido per la copertina.");
  const rawPosition=(body as {coverPosition?:{x:number;y:number}}).coverPosition;
  const coverPosition=rawPosition&&Number.isInteger(rawPosition.x)&&Number.isInteger(rawPosition.y)&&rawPosition.x>=0&&rawPosition.x<=100&&rawPosition.y>=0&&rawPosition.y<=100?rawPosition:{x:50,y:50};
  const settings={...(ranking.settings as Record<string,unknown>),coverImagePath,coverImageUrl,coverPosition};
  const {error}=await supabase.from("rankings").update({settings}).eq("id",rankingId).eq("user_id",user.id);
  if(error)return jsonError(error.message,500);
  const {error:revisionError}=await supabase.rpc("renqd_record_revision",{p_ranking_id:rankingId,p_change_summary:"Modifica copertina"});
  if(revisionError){await supabase.from("rankings").update({settings:ranking.settings}).eq("id",rankingId).eq("user_id",user.id);return jsonError(revisionError.message,500);}
  return NextResponse.json({ok:true});
 }
 if(body.action==="repeat-battle"){
  const {rankingId}=body as {rankingId:string};
  const {data:ranking,error:lookupError}=await supabase.from("rankings").select("id,status,mode,settings").eq("id",rankingId).eq("user_id",user.id).is("deleted_at",null).maybeSingle();
  if(lookupError||!ranking||ranking.status!=="COMPLETED"||ranking.mode!=="BATTLE_RENQ")return jsonError("Battle Renq non trovato o non ripetibile.",404);
  const {data:rows,error:rowsError}=await supabase.from("ranking_items").select("id,rank_position,tie_group_id").eq("ranking_id",rankingId);
  if(rowsError||!rows)return jsonError(rowsError?.message??"Impossibile leggere gli elementi.",500);
  const changed:string[]=[];
  for(const row of rows){
   const {error:updateError}=await supabase.from("ranking_items").update({rank_position:null,tie_group_id:null}).eq("id",row.id).eq("ranking_id",rankingId);
   if(updateError){
    for(const id of changed){const previous=rows.find(item=>item.id===id)!;await supabase.from("ranking_items").update({rank_position:previous.rank_position,tie_group_id:previous.tie_group_id}).eq("id",id).eq("ranking_id",rankingId);}
    return jsonError(updateError.message,500);
   }
   changed.push(row.id);
  }
  const settings={...((ranking.settings??{}) as Record<string,unknown>)};
  delete settings.savedAt;
  delete settings.savedSnapshot;
  const {error:updateRankingError}=await supabase.from("rankings").update({status:"DRAFT",started_at:null,completed_at:null,settings,updated_at:new Date().toISOString()}).eq("id",rankingId).eq("user_id",user.id);
  if(updateRankingError){
   for(const row of rows)await supabase.from("ranking_items").update({rank_position:row.rank_position,tie_group_id:row.tie_group_id}).eq("id",row.id).eq("ranking_id",rankingId);
   return jsonError(updateRankingError.message,500);
  }
  return NextResponse.json({ok:true,repeated:true});
 }
 if(body.action==="edit-saved-renq"){
  const {rankingId}=body as {rankingId:string};
  const {data:ranking}=await supabase.from("rankings").select("id,status,settings").eq("id",rankingId).eq("user_id",user.id).single();
  if(!ranking||!(ranking.settings as Record<string,unknown>|null)?.savedAt)return jsonError("Renq salvato non trovato.",404);
  const {error}=await supabase.from("rankings").update({status:"DRAFT",started_at:null,completed_at:null}).eq("id",rankingId).eq("user_id",user.id);
  if(error)return jsonError(error.message,500);
  return NextResponse.json({ok:true});
 }
 if(body.action==="delete-renq"){
  const {rankingId}=body as {rankingId:string};
  const {error}=await supabase.rpc("renqd_soft_delete_ranking",{p_ranking_id:rankingId});
  if(error)return jsonError(error.message,500);
  return NextResponse.json({ok:true,deleted:true});
 }
 if(body.action==="restore-renq"){
  const {rankingId}=body as {rankingId:string};
  const {error}=await supabase.rpc("renqd_restore_ranking",{p_ranking_id:rankingId});
  if(error)return jsonError(error.message,500);
  return NextResponse.json({ok:true,restored:true});
 }
 if(body.action==="permanently-delete-renq"){
  const {rankingId}=body as {rankingId:string};
  const {data:ranking,error:lookupError}=await supabase.from("rankings").select("id,settings").eq("id",rankingId).eq("user_id",user.id).not("deleted_at","is",null).maybeSingle();
  if(lookupError||!ranking)return jsonError("Renq non trovato nel cestino.",404);
  const settings=(ranking.settings??{}) as Record<string,unknown>;
  const coverPath=typeof settings.coverImagePath==="string"?settings.coverImagePath:null;
  const {error}=await supabase.rpc("renqd_permanently_delete_ranking",{p_ranking_id:rankingId});
  if(error)return jsonError(error.message,500);
  if(coverPath)await supabase.storage.from("renq-covers").remove([coverPath]);
  return NextResponse.json({ok:true,permanentlyDeleted:true});
 }
 if(body.action==="cancel-renq"){
  const {rankingId}=body as {rankingId:string};const {data:ranking}=await supabase.from("rankings").select("id").eq("id",rankingId).eq("user_id",user.id).single();if(!ranking)return jsonError("Renq non trovato.",404);const {error}=await supabase.from("rankings").update({status:"CANCELLED"}).eq("id",rankingId);if(error)return jsonError(error.message,500);return NextResponse.json({ok:true});
 }
 const {title,mode,category,contentType,sportDiscipline,coverImageUrl,coverImagePath,defaultCoverImageUrl,coverTitle,participation,collaborators,visibility,access,allowTies,duration,battleDepth,items}=body as {title:string;mode:string;category:string;contentType:string;sportDiscipline?:string;coverImageUrl?:string|null;coverImagePath?:string|null;defaultCoverImageUrl?:string|null;coverTitle?:string;participation:string;collaborators:number;visibility:string;access:string;allowTies:boolean;duration:number;battleDepth:string;items:ItemInput[]};
 if(!title?.trim()||!modeMap[mode]||!Array.isArray(items)||items.length<1||items.length>100)return jsonError("Completa il titolo e inserisci da 1 a 100 elementi.");
 if(coverImagePath!==undefined&&coverImagePath!==null&&(typeof coverImagePath!=="string"||!new RegExp("^"+user.id+"/[a-f0-9-]{36}\\.(jpg|png|webp)$","i").test(coverImagePath)))return jsonError("La copertina caricata non è valida.");
 if(coverImageUrl!==undefined&&coverImageUrl!==null&&!validHttpsUrl(coverImageUrl))return jsonError("L’URL della copertina deve usare HTTPS.");
 const slugBase=title.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"renq";
 const publicSlug=slugBase+"-"+crypto.randomUUID().replace(/-/g,"").slice(0,6);
 const settings={category,contentType,sportDiscipline:sportDiscipline??null,coverImageUrl:coverImageUrl??null,coverImagePath:coverImagePath??null,defaultCoverImageUrl:defaultCoverImageUrl??null,coverTitle:coverTitle??title.trim(),access,collaborators:participation==="collab"?collaborators:1,durationSeconds:mode==="speed"?duration:null,battleDepth};
 const categoryCode=categoryMap[category]??"CUSTOM";
 const payload={public_slug:publicSlug,title:title.trim(),mode:modeMap[mode],participation_mode:participation==="collab"?"COLLAB":"SOLO",visibility:visibility==="live"?"LIVE":"REVEAL",allow_ties:Boolean(allowTies),category:categoryCode,contentType,settings};
 const rpcItems=items.map(item=>({title:item.title.trim(),subtitle:item.subtitle??null,imageUrl:item.imageUrl??null,previewUrl:item.previewUrl??null,appleMusicUrl:item.appleMusicUrl??null,spotifyUrl:item.spotifyUrl??null,source:item.source??"manual",provider:item.payload&&typeof item.payload==="object"?(item.payload as Record<string,unknown>).provider??null:null,externalId:item.id??null}));
 const {data:created,error:createError}=await supabase.rpc("renqd_create_ranking_with_items",{p_payload:{...payload,items:rpcItems}});
 if(createError||!created)return jsonError(createError?.message??"Impossibile creare il Renq.",500);
 return NextResponse.json({id:created.id,slug:created.slug});
}
