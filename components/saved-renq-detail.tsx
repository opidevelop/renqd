"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Heart, MessageCircle, Pencil, Play, RotateCcw, Send, Share2, Trophy, Trash2, X } from "lucide-react";
import { RenqCoverPicker } from "@/components/renq-cover-picker";
import { highQualityImageUrl } from "@/lib/image-quality";
import { RenqReveal } from "@/components/renq-reveal";
import { RenqSortableList, getRenqRankPositions } from "@/components/renq-ranking-ui";

type SavedItem = {
  id: string;
  title: string;
  image_url?: string | null;
  description?: string | null;
  rank_position?: number | null;
  tie_group_id?: string | null;
  metadata?: { previewUrl?: string | null };
};
type CommentItem = { id: string; body: string; created_at: string; author_id: string };
type RevisionItem = { id: string; version: number; change_summary: string | null; created_at: string };
type Props = {
  ranking: { id: string; public_slug?: string; title: string; mode: string; settings: Record<string, unknown>; created_at: string; visibility?: string; allow_ties: boolean; started_at?: string | null; completed_at?: string | null };
  items: SavedItem[];
  coverImageUrl: string | null;
  coverImagePath: string | null;
  defaultCoverImageUrl: string | null;
  coverPosition: { x: number; y: number };
  comments: CommentItem[];
  commentCount: number;
  initialLiked: boolean;
  likeCount: number;
  revisions: RevisionItem[];
};

const modeLabels: Record<string, string> = { RENQ: "Renq", BATTLE_RENQ: "Battle Renq", SPEED_RENQ: "Speed Renq" };

export function SavedRenqDetail({ ranking, items, coverImageUrl, coverImagePath, defaultCoverImageUrl, coverPosition: initialCoverPosition, comments: initialComments, commentCount: initialCommentCount, initialLiked, likeCount: initialLikeCount, revisions }: Props) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [comment, setComment] = useState("");
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikeCount);
  const [currentCoverUrl, setCurrentCoverUrl] = useState(coverImageUrl);
  const [currentCoverPath, setCurrentCoverPath] = useState(coverImagePath);
  const [currentCoverPosition, setCurrentCoverPosition] = useState(initialCoverPosition);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [currentTitle, setCurrentTitle] = useState(ranking.title);
  const [currentVisibility,setCurrentVisibility]=useState(ranking.visibility??"LIVE");
  const [currentAccess,setCurrentAccess]=useState(String(ranking.settings.access??"public"));
  const [editVisibility,setEditVisibility]=useState(ranking.visibility??"LIVE");
  const [editAccess,setEditAccess]=useState(String(ranking.settings.access??"public"));
  const [displayItems, setDisplayItems] = useState(items);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(ranking.title);
  const [editItems, setEditItems] = useState(items);
  const [editTieMap, setEditTieMap] = useState<Record<string,string>>(() => Object.fromEntries(items.filter(item => item.tie_group_id).map(item => [item.id, item.tie_group_id as string])));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedIds, setDraggedIds] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number|null>(null);
  const latestEditItemsRef = useRef(items);
  const dragStartRef = useRef<number|null>(null);
  const draggedIdsRef = useRef<string[]>([]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/rankings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Operazione non riuscita.");
    return result;
  }

  async function toggleFavorite() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await post({ action: "toggle-like", rankingId: ranking.id });
      setLiked(Boolean(result.liked));
      setLikes(Number(result.likeCount ?? likes));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non è stato possibile aggiornare i preferiti.");
    } finally { setBusy(false); }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = comment.trim();
    if (!body || busy) return;
    setBusy(true); setError("");
    try {
      const result = await post({ action: "add-comment", rankingId: ranking.id, body });
      setComments(current => [...current, result.comment]);
      setCommentCount(current => current + 1);
      setComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non è stato possibile pubblicare il commento.");
    } finally { setBusy(false); }
  }

  function startEditing() {
    setEditTitle(currentTitle);
    setEditVisibility(currentVisibility);
    setEditAccess(currentAccess);
    setEditItems(displayItems);
    latestEditItemsRef.current = displayItems;
    setEditTieMap(Object.fromEntries(displayItems.filter(item => item.tie_group_id).map(item => [item.id, item.tie_group_id as string])));
    setSelectedIds([]);
    setEditing(true);
    setError("");
    setMessage("");
  }

  function cancelEditing() {
    setEditing(false);
    setSelectedIds([]);
    setDraggedIds([]);
    setDragIndex(null);
    dragStartRef.current = null;
    draggedIdsRef.current = [];
  }

  function moveEdit(index:number,direction:-1|1) {
    const next=[...latestEditItemsRef.current];
    const target=index+direction;
    if(target<0||target>=next.length)return;
    [next[index],next[target]]=[next[target],next[index]];
    latestEditItemsRef.current=next;
    setEditItems(next);
  }

  function shiftSelectedEdit(targetId:string) {
    const current=latestEditItemsRef.current;
    const movingIds=draggedIdsRef.current;
    if(!movingIds.length||movingIds.includes(targetId))return;
    const movingSet=new Set(movingIds);
    const moving=current.filter(item=>movingSet.has(item.id));
    const rest=current.filter(item=>!movingSet.has(item.id));
    const target=rest.findIndex(item=>item.id===targetId);
    if(target<0)return;
    const next=[...rest.slice(0,target),...moving,...rest.slice(target)];
    if(next.every((item,index)=>item.id===current[index]?.id))return;
    latestEditItemsRef.current=next;
    setEditItems(next);
    setDragIndex(target);
  }

  function finishEditDrag() {
    dragStartRef.current=null;
    draggedIdsRef.current=[];
    setDraggedIds([]);
    setDragIndex(null);
  }

  function toggleEditTie(index:number) {
    if(!ranking.allow_ties||index===0)return;
    const current=editItems[index],previous=editItems[index-1],next={...editTieMap};
    const currentGroup=next[current.id],previousGroup=next[previous.id];
    if(currentGroup&&currentGroup===previousGroup){
      delete next[current.id];
      const remaining=Object.entries(next).filter(([,group])=>group===currentGroup);
      if(remaining.length===1)delete next[remaining[0][0]];
    }else{
      const group=currentGroup??previousGroup??crypto.randomUUID();
      for(const [id,value] of Object.entries(next))if(value===currentGroup||value===previousGroup)next[id]=group;
      next[current.id]=group;next[previous.id]=group;
    }
    setEditTieMap(next);
  }

  async function repeatBattle() {
    if(busy||!window.confirm("Avviare una nuova Battle? La classifica attuale resterà nella cronologia e potrai costruirne una nuova da zero."))return;
    setBusy(true);setError("");setMessage("");
    try{
      await post({action:"repeat-battle",rankingId:ranking.id});
      router.push("/renq/"+(ranking.public_slug??ranking.id));
      router.refresh();
    }catch(e){
      setError(e instanceof Error?e.message:"Non è stato possibile ripetere la Battle.");
      setBusy(false);
    }
  }

  async function savePublishedChanges() {
    if(busy)return;
    const cleanTitle=editTitle.trim();
    if(!cleanTitle||cleanTitle.length>80){setError("Il titolo deve contenere da 1 a 80 caratteri.");return;}
    setBusy(true);setError("");setMessage("");
    try{
      const result=await post({action:"update-published-renq",rankingId:ranking.id,title:cleanTitle,orderedIds:editItems.map(item=>item.id),tieMap:editTieMap,visibility:editVisibility,access:editAccess});
      const sortable=editItems.map((item,index)=>({...item,title_snapshot:item.title,sort_order:index,image_url:item.image_url??null,description:item.description??null,rank_position:item.rank_position??null,preview_url:item.metadata?.previewUrl??null}));const positions=getRenqRankPositions(sortable,editTieMap);
      const nextItems=editItems.map(item=>({...item,rank_position:positions[item.id]??null,tie_group_id:editTieMap[item.id]??null}));
      setDisplayItems(nextItems);
      setCurrentTitle(result.title??cleanTitle);
      setCurrentVisibility(result.visibility??editVisibility);
      setCurrentAccess(result.access??editAccess);
      setEditing(false);
      setSelectedIds([]);
      setMessage("Modifiche salvate nella cronologia.");
      router.refresh();
    }catch(e){
      setError(e instanceof Error?e.message:"Non è stato possibile salvare le modifiche.");
    }finally{setBusy(false);}
  }

  async function deleteRanking() {
    if (busy || !window.confirm("Spostare questo Renq nel cestino? Potrai ripristinarlo in seguito.")) return;
    setBusy(true); setError("");
    try {
      await post({ action: "delete-renq", rankingId: ranking.id });
      router.push("/rankings");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non è stato possibile eliminare il Renq.");
      setBusy(false);
    }
  }

  async function shareRanking() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: currentTitle, text: "La mia classifica su Renqd", url });
      else { await navigator.clipboard.writeText(url); setError("Link copiato negli appunti."); }
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") setError("Non è stato possibile condividere il Renq.");
    }
  }
  async function saveCover(path: string | null, previewUrl: string | null, position = currentCoverPosition) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await post({ action: "update-cover", rankingId: ranking.id, coverImagePath: path, coverImageUrl: path ? null : (previewUrl && previewUrl !== defaultCoverImageUrl ? previewUrl : null), coverPosition: position });
      setCurrentCoverPath(path);
      setCurrentCoverPosition(position);
      setCurrentCoverUrl(previewUrl ?? defaultCoverImageUrl);
      setMessage("Copertina aggiornata e registrata nella cronologia.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non è stato possibile aggiornare la copertina.");
    } finally { setBusy(false); }
  }


  const settings = ranking.settings ?? {};
  const category = String(settings.category ?? "custom").replaceAll("_", " ");
  const contentType = String(settings.contentType ?? "Lista personalizzata");
  const rawCover = currentCoverUrl || defaultCoverImageUrl || displayItems.find(item => item.image_url)?.image_url || null;
  const cover = highQualityImageUrl(rawCover);
  const sortableEditItems=editItems.map((item,index)=>({...item,title_snapshot:item.title,sort_order:index,image_url:item.image_url??null,description:item.description??null,rank_position:item.rank_position??null,preview_url:item.metadata?.previewUrl??null}));
  const editPositions=getRenqRankPositions(sortableEditItems,editTieMap);

  if (showReveal) return <div className="saved-renq-page saved-renq-reveal-page"><button className="saved-renq-back" type="button" onClick={() => setShowReveal(false)}><ArrowLeft size={17}/> Torna alla classifica</button><RenqReveal title={currentTitle} mode={ranking.mode} category={String(settings.category ?? "custom")} contentType={contentType} coverImageUrl={rawCover} coverPosition={currentCoverPosition} allowTies={displayItems.some(item => Boolean(item.tie_group_id))} items={displayItems.map(item => ({id:item.id,title:item.title,image_url:item.image_url ?? null,description:item.description ?? null,rank_position:item.rank_position ?? null,tie_group_id:item.tie_group_id ?? null,preview_url:item.metadata?.previewUrl ?? null}))} actions={<button type="button" className="renq-save-button" onClick={() => setShowReveal(false)}>Torna alla classifica</button>} /></div>;

  return (
    <main className="saved-renq-page">
      <button className="saved-renq-back" type="button" onClick={() => router.push("/rankings")}><ArrowLeft size={17} /> I miei Renq</button>
      <section className="saved-renq-hero">
        {cover ? <img className="saved-renq-cover" src={cover} alt="" style={{ objectPosition: `${currentCoverPosition.x}% ${currentCoverPosition.y}%` }} /> : <div className="saved-renq-cover saved-renq-cover-empty"><Trophy size={58} /></div>}
        <div className="saved-renq-cover-shade" />
        <div className="saved-renq-cover-controls">
          <button type="button" className="saved-renq-cover-edit" onClick={() => setCoverEditorOpen(value => !value)} aria-label="Modifica copertina" aria-expanded={coverEditorOpen}><Pencil size={17} /></button>
          {coverEditorOpen && <div className="saved-renq-cover-editor"><RenqCoverPicker value={currentCoverUrl ?? defaultCoverImageUrl ?? displayItems.find(item => item.image_url)?.image_url ?? null} onChange={(path,url) => void saveCover(path,url)} onFocusPreview={position => setCurrentCoverPosition(position)} onFocusChange={position => void saveCover(currentCoverPath,currentCoverUrl,position)} focusPosition={currentCoverPosition} onReset={() => void saveCover(null,null,{x:50,y:50})} canReset={Boolean(currentCoverPath)||(Boolean(currentCoverUrl)&&currentCoverUrl!==defaultCoverImageUrl)||currentCoverPosition.x!==50||currentCoverPosition.y!==50} variant="overlay"/></div>}
        </div>
        <div className="saved-renq-hero-copy">
          <span>{modeLabels[ranking.mode] ?? "Renq"} · {category} · {contentType}</span>
          <h1>{currentTitle}</h1>
          <p>{displayItems.length} elementi{ranking.mode === "SPEED_RENQ" && ranking.started_at && ranking.completed_at ? " · Tempo impiegato " + Math.floor(Math.max(0,new Date(ranking.completed_at).getTime()-new Date(ranking.started_at).getTime())/60000) + "m " + String(Math.floor(Math.max(0,new Date(ranking.completed_at).getTime()-new Date(ranking.started_at).getTime())/1000)%60).padStart(2,"0") + "s" : ""} · Salvato il {new Date(String(settings.savedAt ?? ranking.created_at)).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="saved-renq-toolbar">
        {editing ? <>
          <button type="button" onClick={cancelEditing} disabled={busy}><X size={16}/><span>Annulla</span></button>
          <button type="button" onClick={() => void savePublishedChanges()} disabled={busy || !editTitle.trim()}><Check size={16}/><span>{busy ? "Salvataggio…" : "Salva modifiche"}</span></button>
        </> : <button type="button" onClick={startEditing} disabled={busy}><Pencil size={17} /><span>Modifica</span></button>}
        {!editing && ranking.mode === "BATTLE_RENQ" && <button type="button" onClick={() => void repeatBattle()} disabled={busy}><RotateCcw size={16}/><span>Ripeti Battle</span></button>}
        {currentVisibility === "REVEAL" && <button type="button" onClick={() => setShowReveal(true)}><Play size={17} /><span>Rivedi reveal</span></button>}
        <button type="button" onClick={() => void shareRanking()}><Share2 size={17} /><span>Condividi</span></button>
        <button type="button" onClick={() => void toggleFavorite()} disabled={busy} className={liked ? "is-liked" : ""}><Heart size={17} fill={liked ? "currentColor" : "none"} /><span>{liked ? "Nei preferiti" : "Preferiti"}</span><small>{likes}</small></button>
        <button type="button" className="saved-renq-delete" onClick={() => void deleteRanking()} disabled={busy}><Trash2 size={16}/><span>Elimina</span></button>

        </div>
      </section>

      <section className="saved-renq-ranking">
        <div className="saved-renq-section-heading"><div><span>IL RISULTATO</span><h2>La tua classifica</h2></div><Trophy size={21} /></div>
        {editing ? <div className="saved-renq-editor">
          <label className="saved-renq-edit-title">Titolo del Renq<input value={editTitle} onChange={event=>setEditTitle(event.target.value)} maxLength={80}/></label>
          <div className="saved-renq-edit-settings">
            <label>Pubblicazione<select value={editVisibility} onChange={event=>setEditVisibility(event.target.value)}><option value="LIVE">Live</option><option value="REVEAL">Reveal</option></select></label>
            <label>Accesso<select value={editAccess} onChange={event=>setEditAccess(event.target.value)}><option value="public">Pubblico</option><option value="private">Privato</option></select></label>
          </div>
          <p>Riordina gli elementi trascinandoli, usando le frecce o selezionandone più di uno con Ctrl (Windows) o Command (Mac).</p>
          <RenqSortableList items={sortableEditItems} positions={editPositions} allowTies={ranking.allow_ties} tieMap={editTieMap} onToggleTie={toggleEditTie} onMove={moveEdit} showDragHandle dragIndex={dragIndex} draggedIds={draggedIds} selectedIds={selectedIds} onToggleSelect={id=>setSelectedIds(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id])} onDragStart={(index,event)=>{event.preventDefault();const id=latestEditItemsRef.current[index]?.id;if(!id)return;const group=selectedIds.includes(id)?selectedIds:[id];draggedIdsRef.current=group;setDraggedIds(group);setSelectedIds(group);dragStartRef.current=index;setDragIndex(index);event.currentTarget.parentElement?.setPointerCapture(event.pointerId);}} onDragMove={(index,event)=>{if(dragStartRef.current===null||event.buttons===0)return;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest("[data-renq-index]");const targetIndex=Number(target?.getAttribute("data-renq-index"));const targetId=latestEditItemsRef.current[targetIndex]?.id;if(targetId){shiftSelectedEdit(targetId);dragStartRef.current=targetIndex;}}} onDragEnd={finishEditDrag}/>
        </div> : <div className="saved-renq-list">
          {displayItems.map((item, index) => {
            const position = item.rank_position ?? index + 1;
            const medal = position <= 3 ? ["🥇", "🥈", "🥉"][position - 1] : null;
            return <article className={"saved-renq-row" + (position <= 3 ? " is-top-" + position : "")} key={item.id}>
              <span className="saved-renq-position">{String(position).padStart(2, "0")}</span>
              {item.image_url ? <img src={highQualityImageUrl(item.image_url) ?? item.image_url} alt="" loading="lazy" /> : <span className="saved-renq-item-placeholder"><Trophy size={19} /></span>}
              <div className="saved-renq-item-copy"><strong>{item.title}</strong>{item.description && <small>{item.description}</small>}</div>
              {medal && <span className={"saved-renq-medal medal-" + position} aria-label={"Posizione " + position}>{medal}</span>}
            </article>;
          })}
        </div>}
      </section>

      <section className="saved-renq-comments saved-renq-history">
        <div className="saved-renq-section-heading"><div><span>TRACCIABILITÀ</span><h2>Cronologia <small>{revisions.length}</small></h2></div><Trophy size={21} /></div>
        {revisions.length ? <ol className="saved-renq-revision-list">{revisions.map(revision => <li key={revision.id}><strong>Versione {revision.version}</strong><span>{revision.change_summary || "Modifica classifica"}</span><time dateTime={revision.created_at}>{new Date(revision.created_at).toLocaleString("it-IT", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</time></li>)}</ol> : <p className="saved-renq-no-comments">La cronologia verrà popolata automaticamente con le prossime modifiche.</p>}
      </section>

      <section className="saved-renq-comments">
        <div className="saved-renq-section-heading"><div><span>LA CONVERSAZIONE</span><h2>Commenti <small>{commentCount}</small></h2></div><MessageCircle size={21} /></div>
        <form className="saved-renq-comment-form" onSubmit={addComment}>
          <textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={4000} rows={2} placeholder="Aggiungi un commento…" />
          <button type="submit" disabled={!comment.trim() || busy} aria-label="Pubblica commento"><Send size={17} /></button>
        </form>
        {comments.length ? <div className="saved-renq-comment-list">{comments.map(item => <article key={item.id}><div className="saved-renq-comment-avatar">R</div><div><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div></article>)}</div> : <p className="saved-renq-no-comments">Ancora nessun commento. Apri tu la conversazione.</p>}
      </section>
      {(error || message) && <p className={"saved-renq-feedback" + (error ? " is-error" : " is-success")} role="status">{error || message}</p>}
      <div className="saved-renq-footer-mark">renqd<span>.</span></div>
    </main>
  );
}
