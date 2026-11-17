"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Clapperboard, Gamepad2, Music2, Plus, Search, SlidersHorizontal, Trophy, X, Trash2 } from "lucide-react";

type RenqCard = {
  id: string; public_slug: string; title: string; mode: string; created_at: string;
  rows: { title: string; image_url?: string | null; rank_position?: number | null }[]; elapsedSeconds?: number | null;
  category: string; coverImage: string | null; coverPosition: { x: number; y: number };
};
const categoryLabels: Record<string,string> = { music:"Musica", games:"Videogiochi", film:"Film e serie", books:"Libri", sport:"Sport", food:"Cibo", travel:"Viaggi", custom:"Personalizzato" };
const modeLabels: Record<string,string> = { RENQ:"Renq classico", BATTLE_RENQ:"Battle Renq", SPEED_RENQ:"Speed Renq" };
const categoryIcons: Record<string,typeof Music2> = { music:Music2, games:Gamepad2, film:Clapperboard, books:BookOpen, sport:Trophy };

export function MyRenqsBrowser({ initialItems }: { initialItems: RenqCard[] }) {
  const [items,setItems] = useState(initialItems);
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("");
  const [mode,setMode] = useState("");
  const [sortOrder,setSortOrder] = useState("newest");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");

  useEffect(() => {
    if (!query.trim() && !category && !mode) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q",query.trim());
        if (category) params.set("category",category);
        if (mode) params.set("mode",mode);
        const response = await fetch("/api/my-renqs?" + params.toString(), { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Ricerca non disponibile.");
        setItems(result.items ?? []);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Ricerca non disponibile.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 280);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query,category,mode,initialItems]);

  const filteredItems = !query.trim() && !category && !mode ? initialItems : items;
  const visibleItems = [...filteredItems].sort((a,b) => {
    if (sortOrder === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortOrder === "title_asc") return a.title.localeCompare(b.title, "it", { sensitivity: "base" });
    if (sortOrder === "title_desc") return b.title.localeCompare(a.title, "it", { sensitivity: "base" });
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const reset = () => { setQuery(""); setCategory(""); setMode(""); setSortOrder("newest"); };
  return <div className="my-renqs-page">
    <header className="my-renqs-header"><div><span className="page-eyebrow"><Trophy size={14}/> LA TUA COLLEZIONE</span><h1>Renq</h1><p>Le classifiche che hai deciso di conservare, tutte in un unico posto.</p></div><div className="my-renqs-header-actions"><Link href="/rankings/trash" className="my-renqs-trash-link"><Trash2 size={16}/> Cestino</Link><Link href="/create" className="my-renqs-create"><Plus size={17}/> Crea un Renq</Link></div></header>
    <div className="my-renqs-summary" aria-live="polite"><div className="my-renqs-results-count"><strong>{visibleItems.length.toLocaleString("it-IT")}</strong><span>{visibleItems.length === 1 ? "classifica" : "classifiche"}</span></div><p>{loading ? "Aggiornamento dei risultati…" : query || category || mode ? "Risultati aggiornati in base alla tua ricerca." : "Le tue classifiche, raccolte in un unico spazio."}</p></div>
    <section className="my-renqs-filters">
      <label className="my-renqs-search"><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cerca un Renq per titolo…"/>{query && <button type="button" onClick={()=>setQuery("")} aria-label="Cancella ricerca"><X size={15}/></button>}</label>
      <label><SlidersHorizontal size={15}/><select value={category} onChange={event=>setCategory(event.target.value)}><option value="">Tutte le categorie</option>{Object.entries(categoryLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label><select value={mode} onChange={event=>setMode(event.target.value)}><option value="">Tutte le tipologie</option><option value="RENQ">Renq classico</option><option value="BATTLE_RENQ">Battle Renq</option><option value="SPEED_RENQ">Speed Renq</option></select></label>
      <label className="my-renqs-sort"><select value={sortOrder} onChange={event=>setSortOrder(event.target.value)} aria-label="Ordina i Renq"><option value="newest">Più recenti</option><option value="oldest">Meno recenti</option><option value="title_asc">Titolo A–Z</option><option value="title_desc">Titolo Z–A</option></select></label>
      {(query||category||mode||sortOrder!=="newest") && <button type="button" className="my-renqs-reset" onClick={reset}>Azzera filtri</button>}
    </section>
    {loading && <p className="my-renqs-loading">Aggiornamento risultati…</p>}
    {error && <p className="my-renqs-error" role="alert">{error}</p>}
    {!visibleItems.length ? <div className="my-renqs-empty"><span className="my-renqs-empty-icon"><Trophy size={25}/></span><h2>{query||category||mode ? "Nessun Renq trovato." : "La tua collezione inizia da qui."}</h2><p>{query||category||mode ? "Prova a cambiare i termini di ricerca o i filtri." : "Quando completi un Renq e scegli “Conferma e salva”, lo troverai in questa pagina."}</p>{!(query||category||mode) && <Link href="/create">Crea il tuo primo Renq <ArrowUpRight size={16}/></Link>}</div> : <div className="my-renqs-grid">{visibleItems.map(item=>{
      const Icon = categoryIcons[item.category] ?? Trophy;
      return <Link href={"/renq/" + (item.public_slug || item.id)} className="my-renq-card" key={item.id}><div className="my-renq-card-art">{item.coverImage ? <img src={item.coverImage} alt="" loading="lazy" style={{objectPosition:item.coverPosition.x+"% "+item.coverPosition.y+"%"}}/> : <span><Icon size={25}/></span>}<div className="my-renq-card-art-shade"/><div className="my-renq-card-top"><span className="my-renq-category"><Icon size={14}/>{categoryLabels[item.category] ?? "Renq"}</span><span className="my-renq-mode">{modeLabels[item.mode] ?? "Renq"}</span></div></div><h2>{item.title}</h2><p className="my-renq-card-meta">{item.rows.length} elementi{item.mode==="SPEED_RENQ"&&item.elapsedSeconds!=null?" · Tempo: "+Math.floor(item.elapsedSeconds/60)+"m "+String(item.elapsedSeconds%60).padStart(2,"0")+"s":""} <i>·</i> Salvato il {new Date(item.created_at).toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"})}</p><div className="my-renq-preview">{item.rows.slice(0,3).map((row,index)=><div key={index}><span>{String(row.rank_position??index+1).padStart(2,"0")}</span><strong>{row.title}</strong></div>)}</div><div className="my-renq-card-bottom"><span>Apri classifica</span><ArrowUpRight size={17}/></div></Link>;
    })}</div>}
  </div>;
}
