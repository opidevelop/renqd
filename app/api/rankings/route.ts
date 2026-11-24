import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountAccess } from "@/lib/supabase/authorization";

type ItemInput={id:string;title:string;subtitle?:string;imageUrl?:string;previewUrl?:string;appleMusicUrl?:string;spotifyUrl?:string;source?:"catalog"|"manual";payload?:unknown};
const modeMap:Record<string,string>={renq:"RENQ",battle:"BATTLE_RENQ",speed:"SPEED_RENQ",grade:"GRADE"};
const categoryMap:Record<string,string>={music:"MUSIC",games:"VIDEOGAME",film:"CINEMA",books:"BOOK",sport:"OTHER",food:"OTHER",travel:"OTHER",custom:"CUSTOM"};
function jsonError(message:string,status=400){return NextResponse.json({error:message},{status});}
function validHttpsUrl(value:unknown):value is string{if(typeof value!=="string"||value.length>2048)return false;try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password;}catch{return false;}}
export async function POST(request:Request){
 const supabase=await createClient();const {user,status}=await getAccountAccess(supabase);if(!user)return jsonError("Sessione scaduta. Accedi di nuovo.",401);if(status!=="APPROVED")return jsonError("Account non ancora abilitato.",403);
 const body=await request.json().catch(()=>null);if(!body)return jsonError("Richiesta non valida.");
 if(body.action==="delete-all-drafts"){
  const {data:drafts,error:lookupError}=await supabase.from("rankings").select("id").eq("user_id",user.id).eq("status","DRAFT").is("deleted_at",null);
  if(lookupError)return jsonError(lookupError.message,500);
  for(const draft of drafts??[]){
   const {error}=await supabase.rpc("renqd_soft_delete_ranking",{p_ranking_id:draft.id});
   if(error)return jsonError(error.message,500);
  }
  return NextResponse.json({ok:true,deletedCount:drafts?.length??0});
 }
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
  const {rankingId,title,orderedIds,tieMap={}}=body as {rankingId:string;title:string;orderedIds:string[];tieMap?:Record<string,string>};
  const cleanTitle=typeof title==="string"?title.trim():"";
  const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuidPattern.test(rankingId)||!cleanTitle||cleanTitle.length>80)return jsonError("Titolo o Renq non valido.");
  if(!Array.isArray(orderedIds)||orderedIds.length<1||new Set(orderedIds).size!==orderedIds.length||orderedIds.some(id=>typeof id!=="string"||!uuidPattern.test(id)))return jsonError("Ordine degli elementi non valido.");
  if(!tieMap||typeof tieMap!=="object"||Array.isArray(tieMap))return jsonError("Gruppi di pari merito non validi.");
  const {data,error}=await supabase.rpc("renqd_update_published_ranking",{p_ranking_id:rankingId,p_title:cleanTitle,p_ordered_ids:orderedIds,p_tie_map:tieMap});
  if(error)return jsonError(error.message,error.code==="42501"?403:error.code==="P0002"?404:error.code==="22023"?400:500);
  return NextResponse.json(data??{ok:true});
 }
 if(body.action==="complete-grade"){
  const {rankingId,scores,tieOrder={}}=body as {rankingId:string;scores:Record<string,number>;tieOrder?:Record<string,number>};
  if(typeof rankingId!=="string"||!scores||typeof scores!=="object"||Array.isArray(scores))return jsonError("Valutazioni non valide.");
  const {data,error}=await supabase.rpc("renqd_complete_grade",{p_ranking_id:rankingId,p_scores:scores,p_tie_order:tieOrder});
  if(error)return jsonError(error.message,400);
  return NextResponse.json(data??{ok:true});
 }
 if(body.action==="update-grade"){
  const {rankingId,title,scores,tieOrder={},gradeConfig}=body as {rankingId:string;title:string;scores:Record<string,number>;tieOrder?:Record<string,number>;gradeConfig:Record<string,unknown>};
  const cleanTitle=typeof title==="string"?title.trim():"";
  if(!rankingId||!cleanTitle||cleanTitle.length>80||!scores||typeof scores!=="object"||Array.isArray(scores))return jsonError("Dati Grade non validi.");
  if(!gradeConfig||!["score","position"].includes(String(gradeConfig.criterion))||!Array.isArray(gradeConfig.labels)||gradeConfig.labels.length>12)return jsonError("Configurazione delle etichette non valida.");
  const labels=gradeConfig.labels as Array<Record<string,unknown>>;const maxRange=gradeConfig.criterion==="position"?2147483647:10;
  if(labels.some(label=>typeof label.name!=="string"||!label.name.trim()||label.name.length>28||typeof label.min!=="number"||typeof label.max!=="number"||label.min<0||label.max>maxRange||label.min>label.max||(gradeConfig.criterion==="position"&&(!Number.isInteger(label.min)||!Number.isInteger(label.max)))||(gradeConfig.criterion==="score"&&(Math.round(label.min*10)!==label.min*10||Math.round(label.max*10)!==label.max*10))||typeof label.color!=="string"||!/^#[0-9a-f]{6}$/i.test(label.color)))return jsonError("Una o più etichette non sono valide.");
  const {data,error}=await supabase.rpc("renqd_update_grade_published",{p_ranking_id:rankingId,p_title:cleanTitle,p_scores:scores,p_tie_order:tieOrder,p_grade_config:gradeConfig});
  if(error)return jsonError(error.message,400);
  return NextResponse.json(data??{ok:true});
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
   const {sessionId}=body as {sessionId:string};
   if(typeof sessionId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId))return jsonError("Sessione Battle non valida.");
   const {data,error}=await supabase.rpc("renqd_record_battle_choice_and_finalize",{p_session_id:sessionId,p_winner_item_id:null,p_is_tie:true,p_auto_ties:false});
   if(error)return jsonError(error.message,error.code==="42501"?403:error.code==="P0002"?404:400);
   return NextResponse.json(data??{ok:true});
  }
  if(body.action==="battle-pick"){
   const {sessionId,winnerId}=body as {sessionId:string;winnerId:string};
   if(typeof sessionId!=="string"||typeof winnerId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(winnerId))return jsonError("Scelta Battle non valida.");
   const {data,error}=await supabase.rpc("renqd_record_battle_choice_and_finalize",{p_session_id:sessionId,p_winner_item_id:winnerId,p_is_tie:false,p_auto_ties:true});
   if(error)return jsonError(error.message,error.code==="42501"?403:error.code==="P0002"?404:400);
   return NextResponse.json(data??{ok:true});
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
  const {data:rows,error}=await supabase.from("ranking_items").select("id,title_snapshot,rank_position,tie_group_id,custom_item_id,score,tie_order").eq("ranking_id",rankingId).order("rank_position",{ascending:true,nullsFirst:false}).order("tie_order").order("sort_order");if(error||!rows)return jsonError(error?.message??"Impossibile leggere il risultato.",500);
  const customIds=rows.map(x=>x.custom_item_id).filter(Boolean);const {data:custom}=customIds.length?await supabase.from("custom_items").select("id,title,image_url,description,metadata").in("id",customIds):{data:[]};const lookup=new Map((custom??[]).map(x=>[x.id,x]));
  const savedSnapshot={items:rows.map(x=>({id:x.id,title:lookup.get(x.custom_item_id)?.title??x.title_snapshot,image_url:lookup.get(x.custom_item_id)?.image_url??null,description:lookup.get(x.custom_item_id)?.description??null,rank_position:x.rank_position,tie_group_id:x.tie_group_id,score:x.score,tie_order:x.tie_order,metadata:lookup.get(x.custom_item_id)?.metadata??{}}))};
  const ratedRows=rows.filter(x=>x.score!==null);const settings={...(ranking.settings??{}),savedAt:new Date().toISOString(),savedSnapshot,...(ranking.mode==="GRADE"?{gradeAverage:ratedRows.length?Number((ratedRows.reduce((sum,x)=>sum+Number(x.score),0)/ratedRows.length).toFixed(1)):null}:{})};
  const {data:version,error:saveError}=await supabase.rpc("renqd_save_ranking_snapshot",{p_ranking_id:rankingId,p_settings:settings});if(saveError)return jsonError(saveError.message,500);return NextResponse.json({ok:true,version});
 }
 if(body.action==="restart-renq"){
  const {rankingId}=body as {rankingId:string};
  const {error}=await supabase.rpc("renqd_restart_ranking",{p_ranking_id:rankingId});
  if(error)return jsonError(error.message,500);
  return NextResponse.json({ok:true});
 }
 if(body.action==="public-toggle-like"||body.action==="public-add-comment"){
  const {rankingId}=body as {rankingId:string};
  if(typeof rankingId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rankingId))return jsonError("Risultato non valido.");
  const {data:ranking}=await supabase.from("rankings").select("id,user_id,mode,status,visibility,hidden_at,deleted_at,settings")
    .eq("id",rankingId).maybeSingle();
  const settings=(ranking?.settings??{}) as Record<string,unknown>;
  if(!ranking||ranking.mode!=="POKEMON_NAME_EM_ALL"||ranking.status!=="COMPLETED"||ranking.visibility!=="LIVE"
    ||ranking.hidden_at||ranking.deleted_at||settings.access==="private")return jsonError("Risultato non disponibile.",404);
  if(body.action==="public-toggle-like"){
    if(ranking.user_id===user.id)return jsonError("Non puoi mettere Mi piace al tuo risultato.",403);
    const {data:existing}=await supabase.from("ranking_likes").select("user_id").eq("ranking_id",rankingId).eq("user_id",user.id).maybeSingle();
    if(existing){const {error}=await supabase.from("ranking_likes").delete().eq("ranking_id",rankingId).eq("user_id",user.id);if(error)return jsonError(error.message,500);}
    else{const {error}=await supabase.from("ranking_likes").insert({ranking_id:rankingId,user_id:user.id});if(error)return jsonError(error.message,500);}
    const {count,error}=await supabase.from("ranking_likes").select("user_id",{count:"exact",head:true}).eq("ranking_id",rankingId);
    if(error)return jsonError(error.message,500);
    return NextResponse.json({liked:!existing,likeCount:count??0});
  }
  const clean=typeof body.body==="string"?body.body.trim():"";
  if(!clean||clean.length>4000)return jsonError("Il commento deve contenere da 1 a 4000 caratteri.");
  const {data:comment,error}=await supabase.from("ranking_comments").insert({ranking_id:rankingId,author_id:user.id,body:clean})
    .select("id,body,created_at,author_id").single();
  if(error||!comment)return jsonError(error?.message??"Impossibile pubblicare il commento.",500);
  return NextResponse.json({comment});
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
  const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(typeof rankingId!=="string"||!uuidPattern.test(rankingId))return jsonError("Renq non valido.");
  if(coverImagePath!==null&&(typeof coverImagePath!=="string"||!new RegExp("^"+user.id+"/[a-f0-9-]{36}\\\\.(jpg|png|webp)$","i").test(coverImagePath)))return jsonError("La copertina non è valida o non appartiene al tuo spazio.");
  const coverImageUrl=(body as {coverImageUrl?:string|null}).coverImageUrl??null;
  if(coverImageUrl!==null&&!validHttpsUrl(coverImageUrl))return jsonError("Inserisci un URL HTTPS valido per la copertina.");
  const rawPosition=(body as {coverPosition?:{x:number;y:number}}).coverPosition;
  const coverPosition=rawPosition&&Number.isInteger(rawPosition.x)&&Number.isInteger(rawPosition.y)&&rawPosition.x>=0&&rawPosition.x<=100&&rawPosition.y>=0&&rawPosition.y<=100?rawPosition:{x:50,y:50};
  const {data,error}=await supabase.rpc("renqd_update_saved_cover",{p_ranking_id:rankingId,p_cover_image_path:coverImagePath,p_cover_image_url:coverImageUrl,p_cover_position:coverPosition});
  if(error)return jsonError(error.message,error.code==="42501"?403:error.code==="P0002"?404:error.code==="22023"?400:500);
  const previousPath=typeof data?.previousCoverPath==="string"?data.previousCoverPath:null;
  let warning:string|null=null;
  if(previousPath&&previousPath!==coverImagePath){
   const {error:storageError}=await supabase.storage.from("renq-covers").remove([previousPath]);
   if(storageError)warning="Copertina aggiornata, ma il vecchio file non è stato rimosso. La pulizia resta da completare.";
  }
  return NextResponse.json({ok:true,version:data?.version,warning});
 }
 if(body.action==="repeat-battle"){
  const {rankingId}=body as {rankingId:string};
  if(typeof rankingId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rankingId))return jsonError("Battle Renq non valido.");
  const {data,error}=await supabase.rpc("renqd_repeat_battle",{p_ranking_id:rankingId});
  if(error)return jsonError(error.message,error.code==="42501"?403:error.code==="P0002"?404:400);
  return NextResponse.json(data??{ok:true,repeated:true});
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
  let cleanupWarning: string | null = null;
  if(coverPath){
   const {error:storageError}=await supabase.storage.from("renq-covers").remove([coverPath]);
   if(storageError)cleanupWarning="Renq eliminato, ma non è stato possibile rimuovere la copertina. La pulizia del file resta da completare.";
  }
  return NextResponse.json({ok:true,permanentlyDeleted:true,warning:cleanupWarning});
 }
 if(body.action==="cancel-renq"){
  const {rankingId}=body as {rankingId:string};const {data:ranking}=await supabase.from("rankings").select("id").eq("id",rankingId).eq("user_id",user.id).single();if(!ranking)return jsonError("Renq non trovato.",404);const {error}=await supabase.from("rankings").update({status:"CANCELLED"}).eq("id",rankingId);if(error)return jsonError(error.message,500);return NextResponse.json({ok:true});
 }
 const {title,mode,category,contentType,sportDiscipline,coverImageUrl,coverImagePath,defaultCoverImageUrl,coverTitle,participation,collaborators,sessionDurationMinutes,visibility,access,allowTies,duration,battleDepth,gradeConfig,items}=body as {title:string;mode:string;category:string;contentType:string;sportDiscipline?:string;coverImageUrl?:string|null;coverImagePath?:string|null;defaultCoverImageUrl?:string|null;coverTitle?:string;participation:"solo"|"collaborative"|"competitive";collaborators:number;sessionDurationMinutes:number;visibility:string;access:string;allowTies:boolean;duration:number;battleDepth:string;gradeConfig?:Record<string,unknown>;items:ItemInput[]};
 if(!title?.trim()||!modeMap[mode]||!Array.isArray(items)||items.length<1)return jsonError("Completa il titolo e inserisci almeno un elemento.");
 if(coverImagePath!==undefined&&coverImagePath!==null&&(typeof coverImagePath!=="string"||!new RegExp("^"+user.id+"/[a-f0-9-]{36}\\.(jpg|png|webp)$","i").test(coverImagePath)))return jsonError("La copertina caricata non è valida.");
 if(coverImageUrl!==undefined&&coverImageUrl!==null&&!validHttpsUrl(coverImageUrl))return jsonError("L’URL della copertina deve usare HTTPS.");
 const slugBase=title.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"renq";
 const publicSlug=slugBase+"-"+crypto.randomUUID().replace(/-/g,"").slice(0,6);
 const safeGradeConfig=mode==="grade"?gradeConfig??{criterion:"score",labels:[]}:null;if(mode==="grade"){if(!safeGradeConfig||!["score","position"].includes(String(safeGradeConfig.criterion))||!Array.isArray(safeGradeConfig.labels)||safeGradeConfig.labels.length>12)return jsonError("Configurazione Grade non valida.");const rangeMax=safeGradeConfig.criterion==="position"?2147483647:10;const labels=safeGradeConfig.labels as Array<Record<string,unknown>>;if(labels.some(label=>typeof label.name!=="string"||!label.name.trim()||label.name.length>28||typeof label.min!=="number"||typeof label.max!=="number"||label.min<0||label.max>rangeMax||label.min>label.max||(safeGradeConfig.criterion==="position"&&(!Number.isInteger(label.min)||!Number.isInteger(label.max)))||(safeGradeConfig.criterion==="score"&&(Math.round(label.min*10)!==label.min*10||Math.round(label.max*10)!==label.max*10))||typeof label.color!=="string"||!/^#[0-9a-f]{6}$/i.test(label.color)))return jsonError("Una o più etichette Grade non sono valide.");}const isMultiplayer=participation!=="solo";if(isMultiplayer&&(!Number.isInteger(collaborators)||collaborators<2||collaborators>8||!Number.isInteger(sessionDurationMinutes)||sessionDurationMinutes<1||sessionDurationMinutes>1440))return jsonError("Impostazioni multiplayer non valide.");const settings={category,contentType,sportDiscipline:sportDiscipline??null,coverImageUrl:coverImageUrl??null,coverImagePath:coverImagePath??null,defaultCoverImageUrl:defaultCoverImageUrl??null,coverTitle:coverTitle??title.trim(),access:isMultiplayer?"private":access,collaborators:isMultiplayer?collaborators:1,durationSeconds:mode==="speed"?duration:null,battleDepth,...(mode==="grade"?{gradeConfig:safeGradeConfig}:{})};
 const categoryCode=categoryMap[category]??"CUSTOM";
 const payload={public_slug:publicSlug,title:title.trim(),mode:modeMap[mode],participation_mode:isMultiplayer?"COLLAB":"SOLO",visibility:isMultiplayer?"REVEAL":visibility==="live"?"LIVE":"REVEAL",allow_ties:Boolean(allowTies),category:categoryCode,contentType,settings};
 const rpcItems=items.map(item=>({title:item.title.trim(),subtitle:item.subtitle??null,imageUrl:item.imageUrl??null,previewUrl:item.previewUrl??null,appleMusicUrl:item.appleMusicUrl??null,spotifyUrl:item.spotifyUrl??null,source:item.source??"manual",provider:item.payload&&typeof item.payload==="object"?(item.payload as Record<string,unknown>).provider??null:null,externalId:item.id??null}));
 const {data:created,error:createError}=isMultiplayer
  ? await supabase.rpc("renqd_create_multiplayer_ranking",{p_payload:{...payload,items:rpcItems},p_session_mode:participation==="competitive"?"COMPETITIVE":"COLLABORATIVE",p_duration_minutes:sessionDurationMinutes,p_max_participants:collaborators})
  : await supabase.rpc("renqd_create_ranking_with_items",{p_payload:{...payload,items:rpcItems}});
 if(createError||!created)return jsonError(createError?.message??"Impossibile creare il Renq.",500);
 return NextResponse.json({id:created.id,slug:created.slug,sessionId:created.sessionId??null,sessionMode:created.sessionMode??null});
}
