"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Trash2, Trash } from "lucide-react";
import { useConfirmDialog } from "@/components/confirm-dialog";

type TrashItem = { id: string; public_slug: string; title: string; mode: string; deleted_at: string | null; count: number };
type TrashAction = "restore-renq" | "permanently-delete-renq";

export function RenqTrashBrowser({ initialItems }: { initialItems: TrashItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { confirm, dialog } = useConfirmDialog();

  async function runAction(item: TrashItem, actionName: TrashAction) {
    const response = await fetch("/api/rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionName, rankingId: item.id })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Operazione non riuscita.");
    return typeof result.warning === "string" ? result.warning : null;
  }

  async function action(item: TrashItem, actionName: TrashAction) {
    if (busyId || busyAll) return;
    if (actionName === "permanently-delete-renq" && !(await confirm({title:"Eliminare definitivamente il Renq?",description:"Il Renq e tutti i dati collegati verranno eliminati. Questa operazione non può essere annullata.",confirmLabel:"Elimina definitivamente",tone:"danger"}))) return;
    setBusyId(item.id); setError(""); setMessage("");
    try {
      const warning = await runAction(item, actionName);
      setItems(current => current.filter(row => row.id !== item.id));
      setMessage(warning ?? (actionName === "restore-renq" ? "Renq ripristinato." : "Renq eliminato definitivamente."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setBusyId(null); }
  }

  async function bulkAction(actionName: TrashAction) {
    if (busyId || busyAll || !items.length) return;
    if (actionName === "permanently-delete-renq" && !(await confirm({title:"Svuotare il cestino?",description:"Tutti i Renq presenti nel cestino e i relativi dati verranno eliminati definitivamente. Questa operazione non può essere annullata.",confirmLabel:"Svuota cestino",tone:"danger"}))) return;
    setBusyAll(true); setError(""); setMessage("");
    const completed = new Set<string>();
    const failures: string[] = [];
    const warnings: string[] = [];
    for (const item of items) {
      try {
        const warning = await runAction(item, actionName);
        if (warning) warnings.push(item.title + ": " + warning);
        completed.add(item.id);
      } catch (cause) {
        failures.push(item.title + ": " + (cause instanceof Error ? cause.message : "operazione non riuscita"));
      }
    }
    setItems(current => current.filter(item => !completed.has(item.id)));
    if (failures.length) {
      setError("Operazione completata solo in parte. " + failures.slice(0, 3).join(" · ") + (failures.length > 3 ? " · e altri " + (failures.length - 3) : ""));
    } else if (warnings.length) {
      setMessage(warnings.slice(0, 2).join(" · ") + (warnings.length > 2 ? " · e altri " + (warnings.length - 2) : ""));
    } else {
      setMessage(actionName === "restore-renq" ? "Tutti i Renq sono stati ripristinati." : "Cestino svuotato.");
    }
    setBusyAll(false);
  }

  return <main className="my-renqs-page renq-trash-page">
    <Link href="/rankings" className="saved-renq-back"><ArrowLeft size={17}/> I miei Renq</Link>
    <header className="my-renqs-header">
      <div><span className="page-eyebrow"><Trash2 size={14}/> ELEMENTI ELIMINATI</span><h1>Cestino</h1><p>I Renq eliminati restano qui finché non li ripristini o li elimini definitivamente.</p></div>
      {!!items.length && <div className="renq-trash-bulk-actions">
        <button type="button" onClick={() => void bulkAction("restore-renq")} disabled={busyAll || Boolean(busyId)}><RotateCcw size={15}/> Ripristina tutto</button>
        <button type="button" className="is-danger" onClick={() => void bulkAction("permanently-delete-renq")} disabled={busyAll || Boolean(busyId)}><Trash2 size={15}/> {busyAll ? "Operazione…" : "Svuota cestino"}</button>
      </div>}
    </header>
    {error && <p className="my-renqs-error" role="alert">{error}</p>}
    {message && <p className="renq-trash-feedback" role="status">{message}</p>}
    {!items.length ? <div className="my-renqs-empty"><span className="my-renqs-empty-icon"><Trash size={25}/></span><h2>Il cestino è vuoto.</h2><p>Quando sposti un Renq nel cestino, lo troverai qui.</p></div> :
      <div className="renq-trash-list">{items.map(item => <article className="renq-trash-item" key={item.id}>
        <div><strong>{item.title}</strong><p>{item.count} elementi · Eliminato il {item.deleted_at ? new Date(item.deleted_at).toLocaleDateString("it-IT") : "—"}</p></div>
        <div className="renq-trash-actions">
          <button type="button" onClick={() => void action(item,"restore-renq")} disabled={Boolean(busyId) || busyAll}><RotateCcw size={16}/> Ripristina</button>
          <button type="button" className="renq-trash-delete" onClick={() => void action(item,"permanently-delete-renq")} disabled={Boolean(busyId) || busyAll}><Trash2 size={16}/> Elimina definitivamente</button>
        </div>
      </article>)}</div>}
    {dialog}
  </main>;
}
