"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, MessageCircle, Pencil, Send, Share2, Trophy } from "lucide-react";
import { RenqCoverPicker } from "@/components/renq-cover-picker";\nimport { highQualityImageUrl } from "@/lib/image-quality";

type SavedItem = {
  id: string;
  title: string;
  image_url?: string | null;
  description?: string | null;
  rank_position?: number | null;
  tie_group_id?: string | null;
};
type CommentItem = { id: string; body: string; created_at: string; author_id: string };
type Props = {
  ranking: { id: string; public_slug?: string; title: string; mode: string; settings: Record<string, unknown>; created_at: string };
  items: SavedItem[];
  coverImageUrl: string | null;
  coverImagePath: string | null;
  defaultCoverImageUrl: string | null;\n  coverPosition: { x: number; y: number };
  comments: CommentItem[];
  commentCount: number;
  initialLiked: boolean;
  likeCount: number;
};

const modeLabels: Record<string, string> = { RENQ: "Renq", BATTLE_RENQ: "Battle Renq", SPEED_RENQ: "Speed Renq" };

export function SavedRenqDetail({ ranking, items, coverImageUrl, coverImagePath, defaultCoverImageUrl, coverPosition: initialCoverPosition, comments: initialComments, commentCount: initialCommentCount, initialLiked, likeCount: initialLikeCount }: Props) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [comment, setComment] = useState("");
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikeCount);
  const [currentCoverUrl, setCurrentCoverUrl] = useState(coverImageUrl);
  const [currentCoverPath, setCurrentCoverPath] = useState(coverImagePath);\n  const [currentCoverPosition, setCurrentCoverPosition] = useState(initialCoverPosition);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  async function editRanking() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await post({ action: "edit-saved-renq", rankingId: ranking.id });
      router.push("/renq/" + (ranking.public_slug ?? ranking.id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non è stato possibile modificare il Renq.");
      setBusy(false);
    }
  }

  async function shareRanking() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: ranking.title, text: "La mia classifica su Renqd", url });
      else { await navigator.clipboard.writeText(url); setError("Link copiato negli appunti."); }
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") setError("Non è stato possibile condividere il Renq.");
    }
  }
  async function saveCover(path: string | null, previewUrl: string | null, position = currentCoverPosition) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await post({ action: "update-cover", rankingId: ranking.id, coverImagePath: path });
      setCurrentCoverPath(path);
      setCurrentCoverUrl(previewUrl ?? defaultCoverImageUrl);
      setError("Copertina aggiornata.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non è stato possibile aggiornare la copertina.");
    } finally { setBusy(false); }
  }


  const settings = ranking.settings ?? {};
  const category = String(settings.category ?? "custom").replaceAll("_", " ");
  const contentType = String(settings.contentType ?? "Lista personalizzata");
  const rawCover = currentCoverUrl || defaultCoverImageUrl || items.find(item => item.image_url)?.image_url || null;
  const cover = rawCover ? rawCover.replace(/\/(?:100|150|300|400|600)x(?:100|150|300|400|600)bb\.(jpg|jpeg|png|webp)/i, "/1200x1200bb.$1").replace(/\/t\/p\/w500\//i, "/t/p/original/").replace(/ab67616d0000b273/gi, "ab67616d00001e02") : null;

  return (
    <main className="saved-renq-page">
      <button className="saved-renq-back" type="button" onClick={() => router.push("/rankings")}><ArrowLeft size={17} /> I miei Renq</button>
      <section className="saved-renq-hero">
        {cover ? <img className="saved-renq-cover" src={cover} alt="" style={{ objectPosition: `${currentCoverPosition.x}% ${currentCoverPosition.y}%` }} /> : <div className="saved-renq-cover saved-renq-cover-empty"><Trophy size={58} /></div>}
        <div className="saved-renq-cover-shade" />
        <div className="saved-renq-hero-copy">
          <span>{modeLabels[ranking.mode] ?? "Renq"} · {category} · {contentType}</span>
          <h1>{ranking.title}</h1>
          <p>{items.length} elementi · Salvato il {new Date(String(settings.savedAt ?? ranking.created_at)).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="saved-renq-toolbar">
        <button type="button" onClick={() => void editRanking()} disabled={busy}><Pencil size={17} /><span>Modifica</span></button>
        <button type="button" onClick={() => void shareRanking()}><Share2 size={17} /><span>Condividi</span></button>
        <button type="button" onClick={() => void toggleFavorite()} disabled={busy} className={liked ? "is-liked" : ""}><Heart size={17} fill={liked ? "currentColor" : "none"} /><span>{liked ? "Nei preferiti" : "Preferiti"}</span><small>{likes}</small></button>
        <RenqCoverPicker key={currentCoverPosition.x+"-"+currentCoverPosition.y} value={currentCoverUrl ?? defaultCoverImageUrl ?? items.find(item => item.image_url)?.image_url ?? null} onChange={(path,url) => void saveCover(path,url)} onFocusChange={position => void saveCover(currentCoverPath,currentCoverUrl,position)} focusPosition={currentCoverPosition} onReset={() => void saveCover(null,null,{x:50,y:50})} canReset={Boolean(currentCoverPath)||currentCoverPosition.x!==50||currentCoverPosition.y!==50} variant="overlay"/>
        </div>
      </section>

      <section className="saved-renq-ranking">
        <div className="saved-renq-section-heading"><div><span>IL RISULTATO</span><h2>La tua classifica</h2></div><Trophy size={21} /></div>
        <div className="saved-renq-list">
          {items.map((item, index) => {
            const position = item.rank_position ?? index + 1;
            const medal = position <= 3 ? ["🥇", "🥈", "🥉"][position - 1] : null;
            return <article className={"saved-renq-row" + (position <= 3 ? " is-top-" + position : "")} key={item.id}>
              <span className="saved-renq-position">{String(position).padStart(2, "0")}</span>
              {item.image_url ? <img src={highQualityImageUrl(item.image_url) ?? item.image_url} alt="" loading="lazy" /> : <span className="saved-renq-item-placeholder"><Trophy size={19} /></span>}
              <div className="saved-renq-item-copy"><strong>{item.title}</strong>{item.description && <small>{item.description}</small>}</div>
              {medal && <span className={"saved-renq-medal medal-" + position} aria-label={"Posizione " + position}>{medal}</span>}
            </article>;
          })}
        </div>
      </section>

      <section className="saved-renq-comments">
        <div className="saved-renq-section-heading"><div><span>LA CONVERSAZIONE</span><h2>Commenti <small>{commentCount}</small></h2></div><MessageCircle size={21} /></div>
        <form className="saved-renq-comment-form" onSubmit={addComment}>
          <textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={4000} rows={2} placeholder="Aggiungi un commento…" />
          <button type="submit" disabled={!comment.trim() || busy} aria-label="Pubblica commento"><Send size={17} /></button>
        </form>
        {comments.length ? <div className="saved-renq-comment-list">{comments.map(item => <article key={item.id}><div className="saved-renq-comment-avatar">R</div><div><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div></article>)}</div> : <p className="saved-renq-no-comments">Ancora nessun commento. Apri tu la conversazione.</p>}
      </section>
      {error && <p className="saved-renq-feedback" role="status">{error}</p>}
      <div className="saved-renq-footer-mark">renqd<span>.</span></div>
    </main>
  );
}
