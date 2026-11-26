"use client";

import { useState, type FormEvent } from "react";
import { Flag, LoaderCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./catalog-report-button.module.css";

type EntityType = "QUEEN" | "LIPSYNC";
type Reason = "WRONG_NAME" | "WRONG_ALIAS" | "WRONG_ORIGIN" | "WRONG_APPEARANCE" | "WRONG_CHALLENGE" | "WRONG_LIPSYNC_SONG" | "WRONG_ARTIST" | "BROKEN_PREVIEW" | "DUPLICATE" | "OTHER";

const labels: Record<Reason, string> = {
  WRONG_NAME: "Nome errato",
  WRONG_ALIAS: "Alias errato o mancante",
  WRONG_ORIGIN: "Origine o franchise errato",
  WRONG_APPEARANCE: "Partecipazione o posizione errata",
  WRONG_CHALLENGE: "Challenge o risultato catalogato male",
  WRONG_LIPSYNC_SONG: "Brano del lipsync errato",
  WRONG_ARTIST: "Artista errato",
  BROKEN_PREVIEW: "Anteprima audio non funzionante",
  DUPLICATE: "Record duplicato",
  OTHER: "Altro problema",
};

export function CatalogReportButton({
  entityType,
  entityId,
  entityName,
  sourceUrl,
  sourceVersion,
}: {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  sourceUrl?: string | null;
  sourceVersion?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>(entityType === "QUEEN" ? "WRONG_NAME" : "WRONG_LIPSYNC_SONG");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const availableReasons: Reason[] = entityType === "QUEEN"
    ? ["WRONG_NAME", "WRONG_ALIAS", "WRONG_ORIGIN", "WRONG_APPEARANCE", "WRONG_CHALLENGE", "DUPLICATE", "OTHER"]
    : ["WRONG_LIPSYNC_SONG", "WRONG_ARTIST", "BROKEN_PREVIEW", "DUPLICATE", "OTHER"];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const db = createClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) {
      setError("Accedi nuovamente per inviare una segnalazione.");
      setBusy(false);
      return;
    }
    const { error: insertError } = await db.from("drag_race_catalog_reports").insert({
      reporter_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName.slice(0, 180),
      reason,
      details: details.trim() || null,
      source_url: sourceUrl ?? null,
      source_version: sourceVersion ?? null,
    });
    if (insertError) {
      setError(insertError.message.includes("row-level security")
        ? "Il tuo account non è ancora abilitato a inviare segnalazioni."
        : "Non è stato possibile inviare la segnalazione. Riprova.");
      setBusy(false);
      return;
    }
    setMessage("Segnalazione inviata. Grazie per aver contribuito a migliorare il catalogo.");
    setDetails("");
    setBusy(false);
  }

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => { setOpen(true); setMessage(""); setError(""); }}>
        <Flag size={14} /> Segnala un dato errato
      </button>
      {open && (
        <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="catalog-report-title">
            <button type="button" className={styles.close} aria-label="Chiudi" onClick={() => setOpen(false)} disabled={busy}><X size={17}/></button>
            <span className={styles.eyebrow}>CONTRIBUISCI AL CATALOGO</span>
            <h2 id="catalog-report-title">Segnala un dato errato</h2>
            <p className={styles.entity}>{entityName}</p>
            {message ? (
              <div className={styles.success} role="status">{message}<button type="button" onClick={() => setOpen(false)}>Chiudi</button></div>
            ) : (
              <form onSubmit={submit} className={styles.form}>
                <label>Tipo di problema
                  <select value={reason} onChange={event => setReason(event.target.value as Reason)} disabled={busy}>
                    {availableReasons.map(value => <option key={value} value={value}>{labels[value]}</option>)}
                  </select>
                </label>
                <label>Dettagli (facoltativi)
                  <textarea value={details} onChange={event => setDetails(event.target.value)} maxLength={2000} rows={4} placeholder="Indica cosa andrebbe corretto e, se possibile, la fonte…" disabled={busy}/>
                </label>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <div className={styles.actions}>
                  <button type="button" className={styles.cancel} onClick={() => setOpen(false)} disabled={busy}>Annulla</button>
                  <button type="submit" className={styles.submit} disabled={busy}>{busy ? <LoaderCircle size={15} className={styles.spin}/> : <Flag size={14}/>} Invia segnalazione</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
