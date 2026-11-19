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
 if(body.action==="decide"){
  if(!rankingId||!["REVEAL","EXTEND"].includes(body.decision))return jsonError("Decisione non valida.");
  const extendMinutes=body.decision==="EXTEND"?Number(body.extendMinutes):null;
  if(body.decision==="EXTEND"&&(extendMinutes===null||!Number.isInteger(extendMinutes)||extendMinutes<1||extendMinutes>1440))return jsonError("La proroga deve essere compresa tra 1 e 1440 minuti.");
  const {data,error}=await supabase.rpc("renqd_multiplayer_decide",{p_ranking_id:rankingId,p_action:body.decision,p_extend_minutes:extendMinutes});
  if(error)return jsonError(error.message,400);return NextResponse.json(data??{});
 }
 return jsonError("Azione multiplayer non riconosciuta.");
}
