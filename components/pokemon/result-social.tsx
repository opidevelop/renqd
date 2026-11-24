"use client";

import { useState } from "react";
import { Heart, LoaderCircle, MessageCircle, Send } from "lucide-react";

export type PokemonResultComment = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  username: string;
  avatarUrl: string | null;
};

export function PokemonResultSocial({
  rankingId, initialLiked, initialLikeCount, initialComments, currentUserId, canLike,
}: {
  rankingId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  initialComments: PokemonResultComment[];
  currentUserId: string;
  canLike: boolean;
}) {
  const [liked,setLiked]=useState(initialLiked);
  const [likeCount,setLikeCount]=useState(initialLikeCount);
  const [comments,setComments]=useState(initialComments);
  const [body,setBody]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function post(action:string,payload:Record<string,unknown>) {
    const response=await fetch("/api/rankings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,rankingId,...payload})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Operazione non riuscita.");
    return data as Record<string,unknown>;
  }

  async function toggleLike() {
    if(busy||!canLike)return;
    setBusy(true);setError("");setMessage("");
    try{
      const result=await post("public-toggle-like",{});
      setLiked(result.liked===true);setLikeCount(Number(result.likeCount??likeCount));
    }catch(e){setError(e instanceof Error?e.message:"Non è stato possibile aggiornare il Mi piace.");}
    finally{setBusy(false);}
  }

  async function addComment() {
    const clean=body.trim();
    if(!clean||busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      const result=await post("public-add-comment",{body:clean});
      const row=result.comment as {id:string;body:string;created_at:string;author_id:string};
      setComments(current=>[...current,{id:row.id,body:row.body,createdAt:row.created_at,authorId:row.author_id,authorName:"Tu",username:"",avatarUrl:null}]);
      setBody("");setMessage("Commento pubblicato.");
    }catch(e){setError(e instanceof Error?e.message:"Non è stato possibile pubblicare il commento.");}
    finally{setBusy(false);}
  }

  return <section className="pokemon-result-social">
    <header><div><span className="pokemon-page-eyebrow">COMMUNITY RENQD</span><h2>La conversazione.</h2></div><MessageCircle size={21}/></header>
    <div className="pokemon-result-social-actions">
      <button type="button" className={liked?"is-liked":""} onClick={()=>void toggleLike()} disabled={busy||!canLike}>
        {busy?<LoaderCircle size={17}/>:<Heart size={17} fill={liked?"currentColor":"none"}/>}
        {liked?"Ti piace":"Mi piace"} <strong>{likeCount}</strong>
      </button>
      {!canLike&&<small>Non puoi mettere Mi piace al tuo risultato.</small>}
    </div>
    <div className="pokemon-result-comments">
      {comments.map(comment=><article key={comment.id}>
        <span className="pokemon-result-comment-avatar">{comment.avatarUrl?<img src={comment.avatarUrl} alt=""/>:comment.authorName.slice(0,1).toUpperCase()}</span>
        <div><header><strong>{comment.authorId===currentUserId?"Tu":comment.authorName}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"})}</time></header><p>{comment.body}</p></div>
      </article>)}
      {!comments.length&&<p className="pokemon-result-comments-empty">Ancora nessun commento. Inizia tu la conversazione.</p>}
    </div>
    <div className="pokemon-result-comment-compose">
      <textarea value={body} maxLength={4000} rows={3} onChange={event=>setBody(event.target.value)} placeholder="Scrivi un commento…" />
      <div><small>{body.length}/4000</small><button type="button" onClick={()=>void addComment()} disabled={busy||!body.trim()}>{busy?<LoaderCircle size={15}/>:<Send size={15}/>} Pubblica</button></div>
    </div>
    {error&&<p className="pokemon-nae-error" role="alert">{error}</p>}
    {message&&<p className="pokemon-catalog-sync is-ready" role="status">{message}</p>}
  </section>;
}
