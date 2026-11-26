"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, LoaderCircle, MessageCircle, Pencil, Reply, Send, ShieldAlert, ShieldBan, Trash2, X } from "lucide-react";

export type PokemonResultLiker = {userId:string;displayName:string;username:string;avatarUrl:string|null};

export type PokemonResultComment = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  authorId: string;
  authorName: string;
  username: string;
  avatarUrl: string | null;
  parentCommentId: string | null;
  likeCount: number;
  likedByMe: boolean;
};

type SocialAction = "toggle-like" | "add-comment" | "update-comment" | "delete-comment" | "toggle-comment-like" | "report-comment" | "block-user";

export function PokemonResultSocial({
  rankingId, resultOwnerId, initialLiked, initialLikeCount, initialLikers, initialComments, currentUserId, canLike, canComment, isOwner,
}: {
  rankingId: string;
  resultOwnerId:string;
  initialLiked: boolean;
  initialLikeCount: number;
  initialLikers: PokemonResultLiker[];
  initialComments: PokemonResultComment[];
  currentUserId: string;
  canLike: boolean;
  canComment: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [liked,setLiked]=useState(initialLiked);
  const [likeCount,setLikeCount]=useState(initialLikeCount);
  const [likers,setLikers]=useState(initialLikers);
  const [showLikers,setShowLikers]=useState(false);
  const [comments,setComments]=useState(initialComments);
  const [body,setBody]=useState("");
  const [replyTo,setReplyTo]=useState<PokemonResultComment|null>(null);
  const [editing,setEditing]=useState<PokemonResultComment|null>(null);
  const [editBody,setEditBody]=useState("");
  const [deleteTarget,setDeleteTarget]=useState<PokemonResultComment|null>(null);
  const [reportTarget,setReportTarget]=useState<PokemonResultComment|null>(null);
  const [blockTarget,setBlockTarget]=useState<{userId:string;displayName:string}|null>(null);
  const [reportReason,setReportReason]=useState("OTHER");
  const [reportDetails,setReportDetails]=useState("");
  const [sort,setSort]=useState<"APPRECIATION"|"RECENT">("APPRECIATION");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function post(action:SocialAction,payload:Record<string,unknown>={}) {
    const response=await fetch("/api/pokemon/name-em-all/social",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({action,rankingId,...payload}),
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Operazione non riuscita.");
    return data as Record<string,unknown>;
  }

  async function toggleLike() {
    if(busy||!canLike)return;
    setBusy(true);setError("");setMessage("");
    try {
      const result=await post("toggle-like");
      setLiked(result.liked===true);setLikeCount(Number(result.likeCount??likeCount));
      if(result.liked===true&&!likers.some(item=>item.userId===currentUserId))setLikers(items=>[{userId:currentUserId,displayName:"Tu",username:"",avatarUrl:null},...items]);
      if(result.liked!==true)setLikers(items=>items.filter(item=>item.userId!==currentUserId));
    } catch(e) {setError(e instanceof Error?e.message:"Non è stato possibile aggiornare il Mi piace.");}
    finally {setBusy(false);}
  }

  async function submitComment() {
    const clean=body.trim();
    if(!clean||busy||!canComment)return;
    setBusy(true);setError("");setMessage("");
    try {
      const result=await post("add-comment",{body:clean,parentCommentId:replyTo?.id??null});
      const row=result.comment as {id:string;body:string;created_at:string;edited_at:string|null;author_id:string;parent_comment_id:string|null};
      setComments(items=>[...items,{
        id:row.id,body:row.body,createdAt:row.created_at,editedAt:row.edited_at,authorId:row.author_id,
        authorName:"Tu",username:"",avatarUrl:null,parentCommentId:row.parent_comment_id,likeCount:0,likedByMe:false,
      }]);
      setBody("");setReplyTo(null);setMessage("Commento pubblicato.");
    } catch(e) {setError(e instanceof Error?e.message:"Non è stato possibile pubblicare il commento.");}
    finally {setBusy(false);}
  }

  async function saveEdit() {
    if(!editing||busy)return;
    const clean=editBody.trim();
    if(!clean||clean.length>4000)return;
    setBusy(true);setError("");
    try {
      const result=await post("update-comment",{commentId:editing.id,body:clean});
      const row=result.comment as {body:string;edited_at:string|null};
      setComments(items=>items.map(item=>item.id===editing.id?{...item,body:row.body,editedAt:row.edited_at}:item));
      setEditing(null);setMessage("Commento aggiornato.");
    } catch(e) {setError(e instanceof Error?e.message:"Non è stato possibile modificare il commento.");}
    finally {setBusy(false);}
  }

  async function confirmDelete() {
    if(!deleteTarget||busy)return;
    setBusy(true);setError("");
    try {
      await post("delete-comment",{commentId:deleteTarget.id});
      setComments(items=>items.map(item=>item.id===deleteTarget.id?{...item,body:"Commento eliminato.",editedAt:null,likeCount:0,likedByMe:false}:item));
      setDeleteTarget(null);setMessage("Commento eliminato.");
    } catch(e) {setError(e instanceof Error?e.message:"Non è stato possibile eliminare il commento.");}
    finally {setBusy(false);}
  }

  async function toggleCommentLike(comment:PokemonResultComment) {
    if(busy||!canComment||comment.authorId===currentUserId)return;
    setBusy(true);setError("");
    try {
      const result=await post("toggle-comment-like",{commentId:comment.id});
      setComments(items=>items.map(item=>item.id===comment.id?{...item,likedByMe:result.liked===true,likeCount:Number(result.likeCount??item.likeCount)}:item));
    } catch(e) {setError(e instanceof Error?e.message:"Non è stato possibile aggiornare il Mi piace.");}
    finally {setBusy(false);}
  }

  async function submitReport() {
    if(!reportTarget||busy)return;
    setBusy(true);setError("");
    try {
      await post("report-comment",{commentId:reportTarget.id,reason:reportReason,details:reportDetails});
      setReportTarget(null);setReportDetails("");setReportReason("OTHER");setMessage("Segnalazione inviata all’Owner.");
    } catch(e) {setError(e instanceof Error?e.message:"Non è stato possibile inviare la segnalazione.");}
    finally {setBusy(false);}
  }

  function blockUser(userId:string,displayName:string) {
    if(busy||userId===currentUserId)return;
    setBlockTarget({userId,displayName});
  }

  async function confirmBlock() {
    if(!blockTarget||busy)return;
    const target=blockTarget;
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/social/blocks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"block",targetUserId:target.userId})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Impossibile bloccare l’utente.");
      setBlockTarget(null);
      if(target.userId===resultOwnerId){
        setComments([]);setLikers([]);setLikeCount(0);setLiked(false);
      }else{
        setComments(items=>items.filter(item=>item.authorId!==target.userId));
        const wasLiker=likers.some(item=>item.userId===target.userId);
        setLikers(items=>items.filter(item=>item.userId!==target.userId));
        if(wasLiker)setLikeCount(value=>Math.max(0,value-1));
      }
      setMessage("Utente bloccato. Il blocco è reciproco e puoi revocarlo dalle impostazioni.");
      router.refresh();
    } catch(e) {setError(e instanceof Error?e.message:"Non è stato possibile bloccare l’utente.");}
    finally {setBusy(false);}
  }

  const roots=useMemo(()=>{
    const rows=comments.filter(item=>!item.parentCommentId);
    return [...rows].sort((a,b)=>sort==="APPRECIATION"
      ?b.likeCount-a.likeCount||b.createdAt.localeCompare(a.createdAt)
      :b.createdAt.localeCompare(a.createdAt));
  },[comments,sort]);
  const repliesFor=(id:string)=>comments.filter(item=>item.parentCommentId===id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));

  function commentCard(comment:PokemonResultComment,isReply=false) {
    const own=comment.authorId===currentUserId;
    const deleted=comment.body==="Commento eliminato.";
    return <article className={"pokemon-result-comment"+(isReply?" is-reply":"")} key={comment.id}>
      <span className="pokemon-result-comment-avatar">{comment.avatarUrl?<img src={comment.avatarUrl} alt=""/>:comment.authorName.slice(0,1).toUpperCase()}</span>
      <div className="pokemon-result-comment-main">
        <header>
          <strong>{own?"Tu":comment.authorName}</strong>
          <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"})}</time>
          {comment.editedAt&&<small>Modificato</small>}
        </header>
        <p>{comment.body}</p>
        {!deleted&&<div className="pokemon-result-comment-actions">
          <button type="button" onClick={()=>void toggleCommentLike(comment)} disabled={busy||own||!canComment} className={comment.likedByMe?"is-liked":""}>
            <Heart size={13} fill={comment.likedByMe?"currentColor":"none"}/> {comment.likeCount}
          </button>
          {!isReply&&canComment&&<button type="button" onClick={()=>{setReplyTo(comment);setBody("");setMessage("");}}><Reply size={13}/> Rispondi</button>}
          {own&&canComment&&<button type="button" onClick={()=>{setEditing(comment);setEditBody(comment.body);}}><Pencil size={13}/> Modifica</button>}
          {(own||isOwner)&&<button type="button" onClick={()=>setDeleteTarget(comment)}><Trash2 size={13}/> Elimina</button>}
          {!own&&canComment&&<button type="button" onClick={()=>{setReportTarget(comment);setReportDetails("");}}><ShieldAlert size={13}/> Segnala</button>}
          {!own&&<button type="button" onClick={()=>blockUser(comment.authorId,comment.authorName)} disabled={busy}><ShieldBan size={13}/> Blocca</button>}
        </div>}
        {editing?.id===comment.id&&<div className="pokemon-result-comment-editor">
          <textarea value={editBody} maxLength={4000} onChange={event=>setEditBody(event.target.value)}/>
          <div><button type="button" onClick={()=>setEditing(null)} className="pokemon-favourite-secondary">Annulla</button><button type="button" onClick={()=>void saveEdit()} disabled={busy||!editBody.trim()} className="pokemon-favourite-primary">Salva modifica</button></div>
        </div>}
        {!isReply&&repliesFor(comment.id).map(reply=>commentCard(reply,true))}
      </div>
    </article>;
  }

  return <section className="pokemon-result-social">
    <div className="pokemon-result-social-heading"><div><span className="pokemon-page-eyebrow">COMMUNITY RENQD</span><h2>La conversazione</h2></div>
      <div className="pokemon-result-like-actions">
        <button type="button" className={liked?"is-liked":""} onClick={()=>void toggleLike()} disabled={busy||!canLike}>
          {busy?<LoaderCircle size={17}/>:<Heart size={17} fill={liked?"currentColor":"none"}/>} {liked?"Ti piace":"Mi piace"}
        </button>
        <button type="button" className="pokemon-result-like-count" onClick={()=>setShowLikers(value=>!value)}>{likeCount} {likeCount===1?"Mi piace":"Mi piace"}</button>
      </div>
    </div>
    {showLikers&&<div className="pokemon-result-likers" aria-label="Persone a cui piace il risultato">
      {likers.length?likers.map(item=><span key={item.userId} title={item.displayName}>{item.avatarUrl?<img src={item.avatarUrl} alt=""/>:<i>{item.displayName.slice(0,1).toUpperCase()}</i>}{item.username?<Link href={"/u/"+item.username}>{item.displayName}</Link>:<small>{item.displayName}</small>}</span>):<p>Nessun Mi piace ancora.</p>}
    </div>}
    {error&&<p className="pokemon-social-feedback is-error" role="alert">{error}</p>}
    {message&&<p className="pokemon-social-feedback" role="status">{message}</p>}
    {canComment&&<div className="pokemon-result-comment-compose">
      {replyTo&&<div className="pokemon-result-replying">Risposta a {replyTo.authorName}<button type="button" onClick={()=>setReplyTo(null)} aria-label="Annulla risposta"><X size={14}/></button></div>}
      <textarea value={body} maxLength={4000} placeholder={replyTo?"Scrivi una risposta…":"Aggiungi un commento…"} onChange={event=>setBody(event.target.value)}/>
      <div><small>{body.length}/4000 · {replyTo?"Una sola risposta annidata":"La conversazione resta collegata al risultato"}</small><button type="button" onClick={()=>void submitComment()} disabled={busy||!body.trim()}><Send size={15}/> Pubblica</button></div>
    </div>}
    <div className="pokemon-result-comments-heading"><span><MessageCircle size={15}/> {comments.filter(item=>!item.parentCommentId).length} commenti</span>
      <div><button type="button" className={sort==="APPRECIATION"?"is-active":""} onClick={()=>setSort("APPRECIATION")}>Più apprezzati</button><button type="button" className={sort==="RECENT"?"is-active":""} onClick={()=>setSort("RECENT")}>Più recenti</button></div>
    </div>
    <div className="pokemon-result-comments">{roots.map(comment=>commentCard(comment))}{!roots.length&&<p>Ancora nessun commento. Apri tu la conversazione.</p>}</div>
    <Dialog open={Boolean(deleteTarget)} onClose={()=>setDeleteTarget(null)} overlayClassName="pokemon-nae-pause-backdrop" className="pokemon-nae-pause-card" role="alertdialog" labelledBy="pokemon-comment-delete-title">
      {deleteTarget&&<>
        <h2 id="pokemon-comment-delete-title">Eliminare questo commento?</h2><p>Il commento verrà nascosto. Le risposte collegate resteranno nella conversazione.</p>
        <div><button type="button" className="pokemon-favourite-secondary" autoFocus onClick={()=>setDeleteTarget(null)}>Annulla</button><button type="button" className="pokemon-favourite-primary" onClick={()=>void confirmDelete()} disabled={busy}>Elimina</button></div>
      </>}
    </Dialog>
    <Dialog open={Boolean(blockTarget)} onClose={()=>setBlockTarget(null)} overlayClassName="pokemon-nae-pause-backdrop" className="pokemon-nae-pause-card" role="alertdialog" labelledBy="pokemon-comment-block-title">
      {blockTarget&&<>
        <h2 id="pokemon-comment-block-title">Bloccare {blockTarget.displayName}?</h2>
        <p>Il blocco è reciproco: non potrete vedere i rispettivi profili e contenuti social né interagire. I risultati della partita restano consultabili dai partecipanti.</p>
        <div><button type="button" className="pokemon-favourite-secondary" autoFocus onClick={()=>setBlockTarget(null)} disabled={busy}>Annulla</button><button type="button" className="pokemon-favourite-primary" onClick={()=>void confirmBlock()} disabled={busy}>Conferma blocco</button></div>
      </>}
    </Dialog>
    <Dialog open={Boolean(reportTarget)} onClose={()=>setReportTarget(null)} overlayClassName="pokemon-nae-pause-backdrop" className="pokemon-nae-pause-card" labelledBy="pokemon-comment-report-title">
      {reportTarget&&<>
        <h2 id="pokemon-comment-report-title">Segnala il commento</h2><p>La segnalazione sarà inviata all’Owner senza nascondere automaticamente il contenuto.</p>
        <select autoFocus value={reportReason} onChange={event=>setReportReason(event.target.value)}><option value="INAPPROPRIATE_CONTENT">Contenuto inappropriato</option><option value="SPAM">Spam</option><option value="HARASSMENT">Molestie</option><option value="COPYRIGHT">Copyright</option><option value="FALSE_INFORMATION">Informazioni false</option><option value="OTHER">Altro</option></select>
        <textarea value={reportDetails} maxLength={2000} placeholder="Dettagli facoltativi" onChange={event=>setReportDetails(event.target.value)}/>
        <div><button type="button" className="pokemon-favourite-secondary" onClick={()=>setReportTarget(null)}>Annulla</button><button type="button" className="pokemon-favourite-primary" onClick={()=>void submitReport()} disabled={busy}>Invia segnalazione</button></div>
      </>}
    </Dialog>

  </section>;
}
