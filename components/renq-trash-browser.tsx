"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Trash2, Trash } from "lucide-react";

type TrashItem = { id: string; public_slug: string; title: string; mode: string; deleted_at: string | null; count: number };

export function RenqTrashBrowser({ initialItems }: { initialItems: TrashItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function action(item: TrashItem, actionName: "restore-renq" | "permanently-delete-renq") {
    if (busyId) return;
    if (actionName === "permanently-delete-renq" && !window.confirm("Eliminare definitivamente questo Renq e tutti i dati collegati? Questa operazione non può essere annullata.")) return;
    setBusyId(item.id); setError("");
    try {
      const response = await fetch("/api/rankings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, rankingId: item.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Operazione non riuscita.");
      setItems(current => current.filter(row => row.id !== item.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setBusyId(null); }
  }

  return <main className="my-renqs-page renq-trash-page">
    <Link href="/rankings" className="saved-renq-back"><ArrowLeft size={17}/> I miei Renq</Link>
    <header className="my-renqs-header"><div><span className="page-eyebrow"><Trash2 size={14}/> ELEMENTI ELIMINATI</span><h1>Cestino</h1><p>I Renq eliminati restano qui finché non li ripristini o li elimini definitivamente.</p></div></header>
    {error && <p className="my-renqs-error" role="alert">{error}</p>}
    {!items.length ? <div className="my-renqs-empty"><span className="my-renqs-empty-icon"><Trash size={25}/></span><h2>Il cestino è vuoto.</h2><p>Quando sposti un Renq nel cestino, lo troverai qui.</p></div> :
      <div className="renq-trash-list">{items.map(item => <article className="renq-trash-item" key={item.id}>
        <div><strong>{item.title}</strong><p>{item.count} elementi · Eliminato il {item.deleted_at ? new Date(item.deleted_at).toLocaleDateString("it-IT") : "—"}</p></div>
        <div className="renq-trash-actions">
          <button type="button" onClick={() => void action(item,"restore-renq")} disabled={Boolean(busyId)}><RotateCcw size={16}/> Ripristina</button>
          <button type="button" className="renq-trash-delete" onClick={() => void action(item,"permanently-delete-renq")} disabled={Boolean(busyId)}><Trash2 size={16}/> Elimina definitivamente</button>
        </div>
      </article>)}</div>}
  </main>;
}
