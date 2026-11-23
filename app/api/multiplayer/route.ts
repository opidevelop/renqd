import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAccountAccess } from "@/lib/supabase/authorization";
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function jsonError(message:string,status=400){return NextResponse.json({error:message},{status});}
function hashToken(token:string){return createHash("sha256").update(token,"utf8").digest("hex");}
export async function POST(request:Request){
 const supabase=await createClient();const {user,status}=await getAccountAccess(supabase);
 if(!user)return jsonError("Sessione scaduta. Accedi di nuovo.",401);
 if(status!=="APPROVED")return jsonError("Account non ancora abilitato.",403);
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.action!=="string")return jsonError("Richiesta non valida.");
 const rankingId=body.rankingId;
 if(rankingId!==undefined&&(typeof rankingId!=="string"||!UUID_PATTERN.test(rankingId)))return jsonError("Renq non valido.");
 if(body.action==="invite-users"){
  if(!rankingId||!Array.isArray(body.usernames)||body.usernames.length<1||body.usernames.length>7||body.usernames.some((name:unknown)=>typeof name!=="string"||name.trim().length>40))return jsonError("Inserisci da 1 a 7 username validi.");
  const {data,error}=await supabase.rpc("renqd_invite_multiplayer_users",{p_ranking_id:rankingId,p_usernames:body.usernames});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{count:0,invited:[]});
 }
 if(body.action==="create-link"){
  if(!rankingId)return jsonError("Renq non valido.");
  const token=randomBytes(32).toString("hex");
  const {error}=await supabase.rpc("renqd_create_multiplayer_invite_link",{p_ranking_id:rankingId,p_token_hash:hashToken(token),p_expires_at:null});
  if(error)return jsonError(error.message,400);
  const url=new URL("/multiplayer/join",request.url);url.searchParams.set("token",token);
  return NextResponse.json({url:url.toString()});
 }
 if(body.action==="revoke-link"){
  if(!rankingId)return jsonError("Renq non valido.");
  const {error}=await supabase.rpc("renqd_revoke_multiplayer_invite_link",{p_ranking_id:rankingId});
  if(error)return jsonError(error.message,400);return NextResponse.json({ok:true});
 }
 if(body.action==="respond-invitation"){
  if(typeof body.participantId!=="string"||!UUID_PATTERN.test(body.participantId)||typeof body.accept!=="boolean")return jsonError("Invito non valido.");
  const {data,error}=await supabase.rpc("renqd_respond_multiplayer_invitation",{p_participant_id:body.participantId,p_accept:body.accept});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="join-link"){
  if(typeof body.token!=="string"||!/^[0-9a-f]{64}$/i.test(body.token))return jsonError("Link invito non valido.");
  const {data,error}=await supabase.rpc("renqd_join_multiplayer_invite_link",{p_token_hash:hashToken(body.token)});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="start"){
  if(!rankingId)return jsonError("Renq non valido.");
  const {data,error}=await supabase.rpc("renqd_start_multiplayer_session",{p_ranking_id:rankingId});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="progress"){
  if(!rankingId||!["IN_PROGRESS","INCOMPLETE"].includes(body.progressStatus))return jsonError("Stato partecipazione non valido.");
  const {data,error}=await supabase.rpc("renqd_set_multiplayer_progress",{p_ranking_id:rankingId,p_progress_status:body.progressStatus});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="save-progress"||body.action==="submit-result"){
  if(!rankingId||!body.resultSnapshot||typeof body.resultSnapshot!=="object")return jsonError("Risultato non valido.");
  const rpcName=body.action==="save-progress"?"renqd_save_multiplayer_progress":"renqd_submit_multiplayer_result";
  const {data,error}=await supabase.rpc(rpcName,{p_ranking_id:rankingId,p_result_snapshot:body.resultSnapshot});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="mark-finished"){
  if(!rankingId)return jsonError("Renq non valido.");
  const {data,error}=await supabase.rpc("renqd_mark_multiplayer_finished",{p_ranking_id:rankingId});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="shared-order"){
  if(!rankingId||!Array.isArray(body.orderedIds)||body.orderedIds.some((id:unknown)=>typeof id!=="string"))return jsonError("Ordine non valido.");
  const {data,error}=await supabase.rpc("renqd_multiplayer_update_shared_order",{p_ranking_id:rankingId,p_ordered_ids:body.orderedIds,p_tie_map:body.tieMap??{}});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="shared-grade"){
  if(!rankingId||!body.scores||typeof body.scores!=="object"||Array.isArray(body.scores))return jsonError("Valutazioni non valide.");
  const {data,error}=await supabase.rpc("renqd_multiplayer_update_shared_grade",{p_ranking_id:rankingId,p_scores:body.scores,p_tie_order:body.tieOrder??{}});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="finish-shared-speed"){
  if(!rankingId||!Array.isArray(body.orderedIds)||body.orderedIds.some((id:unknown)=>typeof id!=="string"))return jsonError("Ordine Speed non valido.");
  const {data,error}=await supabase.rpc("renqd_multiplayer_finish_shared_speed",{p_ranking_id:rankingId,p_ordered_ids:body.orderedIds,p_tie_map:body.tieMap??{}});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="battle-start"){
  if(!rankingId||!Array.isArray(body.pairs))return jsonError("Confronti Battle non validi.");
  const {data,error}=await supabase.rpc("renqd_multiplayer_battle_start",{p_ranking_id:rankingId,p_pairs:body.pairs});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="battle-choice"){
  if(!rankingId||typeof body.isTie!=="boolean"||(!body.isTie&&(typeof body.winnerId!=="string"||!UUID_PATTERN.test(body.winnerId))))return jsonError("Scelta Battle non valida.");
  const {data,error}=await supabase.rpc("renqd_multiplayer_battle_choice",{p_ranking_id:rankingId,p_winner_item_id:body.isTie?null:body.winnerId,p_is_tie:body.isTie});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="submit-proposal"){
  if(!rankingId||!body.proposedSnapshot||typeof body.proposedSnapshot!=="object"||Array.isArray(body.proposedSnapshot))return jsonError("Proposta non valida.");
  const {data,error}=await supabase.rpc("renqd_submit_multiplayer_proposal",{p_ranking_id:rankingId,p_proposed_snapshot:body.proposedSnapshot});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="vote-proposal"){
  if(typeof body.proposalId!=="string"||!UUID_PATTERN.test(body.proposalId)||!["APPROVED","REJECTED"].includes(body.decision))return jsonError("Voto non valido.");
  const {data,error}=await supabase.rpc("renqd_vote_multiplayer_proposal",{p_proposal_id:body.proposalId,p_decision:body.decision});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="revoke-invitation"){
  if(typeof body.participantId!=="string"||!UUID_PATTERN.test(body.participantId))return jsonError("Invito non valido.");
  const {error}=await supabase.rpc("renqd_revoke_multiplayer_invitation",{p_participant_id:body.participantId});
  if(error)return jsonError(error.message,400);return NextResponse.json({ok:true});
 }
 if(body.action==="speed-start"){
  if(!rankingId)return jsonError("Renq non valido.");
  const {data,error}=await supabase.rpc("renqd_multiplayer_speed_start",{p_ranking_id:rankingId});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="request-reveal"){
  if(!rankingId)return jsonError("Renq non valido.");
  const {data,error}=await supabase.rpc("renqd_request_multiplayer_reveal",{p_ranking_id:rankingId});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 if(body.action==="decide"){
  if(!rankingId||!["REVEAL","EXTEND","CLOSE_EARLY"].includes(body.decision))return jsonError("Decisione non valida.");
  const extendMinutes=body.decision==="EXTEND"?Number(body.extendMinutes):null;
  if(body.decision==="EXTEND"&&(extendMinutes===null||!Number.isInteger(extendMinutes)||extendMinutes<1||extendMinutes>1440))return jsonError("La proroga deve essere compresa tra 1 e 1440 minuti.");
  const {data,error}=await supabase.rpc("renqd_multiplayer_decide",{p_ranking_id:rankingId,p_action:body.decision,p_extend_minutes:extendMinutes});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 return jsonError("Azione multiplayer non riconosciuta.");
}
