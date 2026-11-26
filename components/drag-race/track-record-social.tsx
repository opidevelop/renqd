"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {Dialog} from "@/components/ui/dialog";
import {Flag,Heart,LoaderCircle,MessageCircle,MoreHorizontal,Pencil,Reply,Send,ShieldCheck,Trash2,X} from "lucide-react";

type CommentRow={id:string;track_record_id:string;author_id:string;parent_comment_id:string|null;body:string;edited_at:string|null;deleted_at:string|null;created_at:string};
type LikeRow={comment_id:string;user_id:string};
type PublicProfile={user_id:string;username:string|null;display_name:string|null;avatar_url:string|null};
type Props={recordId:string;recordTitle:string;ownerId:string;userId:string;canModerate:boolean;socialEnabled:boolean};

const reasons=[
 ["INAPPROPRIATE_CONTENT","Contenuto inappropriato"],
 ["SPAM","Spam o contenuto ingannevole"],
 ["HARASSMENT","Molestie o contenuto offensivo"],
 ["COPYRIGHT","Violazione del diritto d'autore"],
 ["FALSE_INFORMATION","Informazioni false"],
 ["OTHER","Altro"]
] as const;

export function TrackRecordSocial({recordId,recordTitle,ownerId,userId,canModerate,socialEnabled}:Props){
 const db=createClient();
 const [comments,setComments]=useState<CommentRow[]>([]);
 const [likes,setLikes]=useState<LikeRow[]>([]);
 const [profiles,setProfiles]=useState<Record<string,PublicProfile>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [draft,setDraft]=useState("");
 const [replyTo,setReplyTo]=useState<string|null>(null);
 const [replyDraft,setReplyDraft]=useState("");
 const [editing,setEditing]=useState<string|null>(null);
 const [editDraft,setEditDraft]=useState("");
 const [reportTarget,setReportTarget]=useState<{type:"record"}|{type:"comment";id:string}|null>(null);
 const [reportReason,setReportReason]=useState("");
 const [reportDetails,setReportDetails]=useState("");
 const [reportConfirming,setReportConfirming]=useState(false);
 const [reportBusy,setReportBusy]=useState(false);
 const [recordReported,setRecordReported]=useState(false);

 async function loadComments(){
  setLoading(true);setError("");
  const {data,error:loadError}=await db.from("drag_race_track_record_comments").select("id,track_record_id,author_id,parent_comment_id,body,edited_at,deleted_at,created_at").eq("track_record_id",recordId).order("created_at",{ascending:true});
  if(loadError){setError("Non è stato possibile caricare i commenti: "+loadError.message);setLoading(false);return;}
  const rows=(data??[]) as CommentRow[];
  setComments(rows);
  const ids=rows.map(row=>row.id);
  const authorIds=[...new Set(rows.map(row=>row.author_id))];
  if(ids.length){
   const [likeResult,profileResult]=await Promise.all([
    db.from("drag_race_track_record_comment_likes").select("comment_id,user_id").in("comment_id",ids),
    db.from("public_profiles").select("user_id,username,display_name,avatar_url").in("user_id",authorIds)
   ]);
   if(!likeResult.error)setLikes((likeResult.data??[]) as LikeRow[]);
   if(!profileResult.error)setProfiles(Object.fromEntries(((profileResult.data??[]) as PublicProfile[]).map(profile=>[profile.user_id,profile])));
  }else{setLikes([]);setProfiles({});}
  setLoading(false);
 }
 useEffect(()=>{if(!socialEnabled){setLoading(false);return;}void loadComments();},[recordId,socialEnabled]);
 useEffect(()=>{if(!socialEnabled||ownerId===userId)return;let active=true;void db.rpc("renqd_drag_race_track_record_report_exists",{p_record_id:recordId}).then(({data,error:rpcError})=>{if(active&&!rpcError)setRecordReported(Boolean(data));});return()=>{active=false;};},[db,recordId,ownerId,socialEnabled,userId]);

 const topLevel=useMemo(()=>comments.filter(comment=>comment.parent_comment_id===null),[comments]);
 const replyMap=useMemo(()=>{const map=new Map<string,CommentRow[]>();for(const comment of comments){if(!comment.parent_comment_id)continue;const list=map.get(comment.parent_comment_id)??[];list.push(comment);map.set(comment.parent_comment_id,list);}return map;},[comments]);
 const count=comments.length;
 const profileLabel=(authorId:string)=>profiles[authorId]?.display_name||profiles[authorId]?.username||"Utente Renqd";
 const liked=(commentId:string)=>likes.some(like=>like.comment_id===commentId&&like.user_id===userId);
 const likeCount=(commentId:string)=>likes.filter(like=>like.comment_id===commentId).length;

 async function submitComment(parentId:string|null){
  const body=(parentId?replyDraft:draft).trim();
  if(!body||busy)return;
  setBusy(parentId??"new");setError("");setNotice("");
  const {error:insertError}=await db.from("drag_race_track_record_comments").insert({track_record_id:recordId,author_id:userId,parent_comment_id:parentId,body});
  if(insertError)setError("Commento non inviato: "+insertError.message);
  else{if(parentId){setReplyDraft("");setReplyTo(null);}else setDraft("");await loadComments();}
  setBusy(null);
 }
 async function toggleLike(comment:CommentRow){
  if(comment.author_id===userId||busy)return;
  setBusy("like-"+comment.id);setError("");
  const existing=likes.some(like=>like.comment_id===comment.id&&like.user_id===userId);
  const result=existing
   ?await db.from("drag_race_track_record_comment_likes").delete().eq("comment_id",comment.id).eq("user_id",userId)
   :await db.from("drag_race_track_record_comment_likes").insert({comment_id:comment.id,user_id:userId});
  if(result.error)setError("Like non aggiornato: "+result.error.message);else await loadComments();
  setBusy(null);
 }
 async function saveEdit(commentId:string){
  const body=editDraft.trim();if(!body||busy)return;
  setBusy("edit-"+commentId);setError("");
  const {error:updateError}=await db.from("drag_race_track_record_comments").update({body}).eq("id",commentId).eq("author_id",userId);
  if(updateError)setError("Modifica non salvata: "+updateError.message);else{setEditing(null);setEditDraft("");await loadComments();}
  setBusy(null);
 }
 async function deleteOwnComment(commentId:string){
  if(busy)return;
  setBusy("delete-"+commentId);setError("");
  const {error:updateError}=await db.from("drag_race_track_record_comments").update({deleted_at:new Date().toISOString()}).eq("id",commentId).eq("author_id",userId);
  if(updateError)setError("Commento non eliminato: "+updateError.message);else await loadComments();
  setBusy(null);
 }
 async function moderateComment(commentId:string){
  if(busy)return;
  setBusy("moderate-"+commentId);setError("");
  const {error:rpcError}=await db.rpc("renqd_drag_race_track_record_moderate_comment",{p_comment_id:commentId});
  if(rpcError)setError("Moderazione non riuscita: "+rpcError.message);else await loadComments();
  setBusy(null);
 }
 function openReport(target:{type:"record"}|{type:"comment";id:string}){
  setReportTarget(target);setReportReason("");setReportDetails("");setReportConfirming(false);setError("");
 }
 async function submitReport(){
  if(!reportTarget||!reportReason||reportBusy)return;
  setReportBusy(true);setError("");
  const result=reportTarget.type==="record"
   ?await db.rpc("renqd_drag_race_track_record_report",{p_record_id:recordId,p_reason:reportReason,p_details:reportDetails||null})
   :await db.rpc("renqd_drag_race_track_record_report_comment",{p_comment_id:reportTarget.id,p_reason:reportReason,p_details:reportDetails||null});
  if(result.error){setError("Segnalazione non inviata: "+result.error.message);setReportConfirming(false);}
  else{if(reportTarget.type==="record")setRecordReported(true);setNotice("Segnalazione inviata. Grazie per averci aiutato.");setReportTarget(null);}
  setReportBusy(false);
 }

 if(!socialEnabled)return null;
 const renderComment=(comment:CommentRow,isReply=false)=>(
  <article className={"drag-track-comment"+(isReply?" is-reply":"")} id={"comment-"+comment.id} key={comment.id}>
   <div className="drag-track-comment-avatar">{profileLabel(comment.author_id).slice(0,1).toUpperCase()}</div>
   <div className="drag-track-comment-main">
    <div className="drag-track-comment-meta"><strong>{profiles[comment.author_id]?.username?<Link href={"/u/"+profiles[comment.author_id].username}>@{profiles[comment.author_id].username}</Link>:profileLabel(comment.author_id)}</strong><time>{new Date(comment.created_at).toLocaleDateString("it-IT")}{comment.edited_at?" · modificato":""}</time></div>
    {comment.deleted_at?<p className="drag-track-comment-deleted">Questo commento è stato rimosso.</p>:editing===comment.id?<div className="drag-track-comment-edit"><textarea value={editDraft} onChange={event=>setEditDraft(event.target.value)} maxLength={4000}/><div><button type="button" onClick={()=>{setEditing(null);setEditDraft("");}}>Annulla</button><button type="button" disabled={!editDraft.trim()||busy==="edit-"+comment.id} onClick={()=>void saveEdit(comment.id)}>{busy==="edit-"+comment.id?<LoaderCircle size={14} className="spin"/>:"Salva"}</button></div></div>:<p className="drag-track-comment-body">{comment.body}</p>}
    <div className="drag-track-comment-actions">
     <button type="button" disabled={comment.deleted_at!==null||comment.author_id===userId||busy==="like-"+comment.id} className={liked(comment.id)?"is-liked":""} onClick={()=>void toggleLike(comment)}><Heart size={14}/>{likeCount(comment.id)}</button>
     {!isReply&&!comment.deleted_at&&<button type="button" onClick={()=>{setReplyTo(replyTo===comment.id?null:comment.id);setReplyDraft("");}}><Reply size={14}/> Rispondi</button>}
     {comment.author_id===userId&&!comment.deleted_at&&<><button type="button" onClick={()=>{setEditing(comment.id);setEditDraft(comment.body);}}><Pencil size={13}/> Modifica</button><button type="button" disabled={busy==="delete-"+comment.id} onClick={()=>void deleteOwnComment(comment.id)}><Trash2 size={13}/> Elimina</button></>}
     {canModerate&&!comment.deleted_at&&<button type="button" disabled={busy==="moderate-"+comment.id} onClick={()=>void moderateComment(comment.id)}><ShieldCheck size={13}/> Modera</button>}
     {comment.author_id!==userId&&!comment.deleted_at&&<button type="button" onClick={()=>openReport({type:"comment",id:comment.id})}><Flag size={13}/> Segnala</button>}
    </div>
    {replyTo===comment.id&&<div className="drag-track-reply-form"><textarea value={replyDraft} onChange={event=>setReplyDraft(event.target.value)} maxLength={4000} placeholder="Scrivi una risposta…"/><button type="button" disabled={!replyDraft.trim()||busy===comment.id} onClick={()=>void submitComment(comment.id)}>{busy===comment.id?<LoaderCircle size={14} className="spin"/>:<Send size={14}/>} Rispondi</button></div>}
    {(replyMap.get(comment.id)??[]).map(reply=>renderComment(reply,true))}
   </div>
  </article>
 );

 return <section className="drag-track-section drag-track-social" id="comments">
  <div className="drag-track-section-head"><div><span>COMMUNITY</span><h2>Commenti</h2><p>{count} {count===1?"commento":"commenti"} sulla Track Record</p></div><MessageCircle size={21}/></div>
  {ownerId!==userId&&(recordReported?<span className="drag-track-report-sent"><ShieldCheck size={14}/> Scheda già segnalata</span>:<button type="button" className="drag-track-report-record" onClick={()=>openReport({type:"record"})}><Flag size={14}/> Segnala Track Record</button>)}
  {error&&<p className="drag-track-social-error" role="alert">{error}</p>}{notice&&<p className="drag-track-social-notice" role="status">{notice}</p>}
  <form className="drag-track-comment-compose" onSubmit={event=>{event.preventDefault();void submitComment(null);}}><textarea value={draft} onChange={event=>setDraft(event.target.value)} maxLength={4000} placeholder="Condividi un commento…" aria-label="Nuovo commento"/><button type="submit" disabled={!draft.trim()||busy==="new"}>{busy==="new"?<LoaderCircle size={15} className="spin"/>:<Send size={15}/>} Pubblica</button></form>
  {loading?<p className="drag-track-social-loading"><LoaderCircle size={16} className="spin"/> Caricamento commenti…</p>:topLevel.length?topLevel.map(comment=>renderComment(comment)):<p className="drag-track-social-empty">Ancora nessun commento. Inizia tu la conversazione.</p>}
  <Dialog open={Boolean(reportTarget)} onClose={()=>{setReportTarget(null);setReportConfirming(false);}} overlayClassName="renqd-report-overlay" className="report-renq-dialog renqd-report-dialog" ariaLabel="Segnala contenuto Track Record">
   <div className="report-renq-dialog-head"><div><span>SEGNALAZIONE</span><strong>{reportTarget?.type==="record"?"Segnala questa Track Record":"Segnala questo commento"}</strong></div><button type="button" aria-label="Chiudi" onClick={()=>setReportTarget(null)}>×</button></div>
   {!reportConfirming?<><label htmlFor="track-report-reason">Motivo della segnalazione</label><select id="track-report-reason" value={reportReason} onChange={event=>setReportReason(event.target.value)}><option value="">Seleziona un motivo</option>{reasons.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><label htmlFor="track-report-details">Dettagli <span>(facoltativi)</span></label><textarea id="track-report-details" value={reportDetails} onChange={event=>setReportDetails(event.target.value)} maxLength={1000} rows={3}/><div className="report-renq-dialog-actions"><small>{reportDetails.length}/1000</small><button type="button" disabled={!reportReason} onClick={()=>setReportConfirming(true)}>Continua</button></div></>:<><p>Confermi l'invio della segnalazione? Non potrai inviarne un'altra per lo stesso contenuto.</p><div className="report-renq-dialog-actions"><button type="button" className="is-quiet" onClick={()=>setReportConfirming(false)}>Indietro</button><button type="button" disabled={reportBusy} onClick={()=>void submitReport()}>{reportBusy?<LoaderCircle size={14} className="spin"/>:<Flag size={14}/>} Conferma invio</button></div></>}
  </Dialog>
 </section>;
}
