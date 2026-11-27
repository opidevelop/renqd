"use client";

import { useState, useTransition } from "react";
import { Flag, MoreHorizontal, LoaderCircle, CheckCircle2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { createRankingReport } from "@/app/r/[slug]/actions";

const reasons = [
  ["INAPPROPRIATE_CONTENT", "Contenuto inappropriato"],
  ["SPAM", "Spam o contenuto ingannevole"],
  ["HARASSMENT", "Molestie o contenuto offensivo"],
  ["COPYRIGHT", "Violazione del diritto d'autore"],
  ["FALSE_INFORMATION", "Informazioni false"],
  ["OTHER", "Altro"],
] as const;

export default function ReportRenqMenu({ rankingId, alreadyReported }: {
  rankingId: string; alreadyReported: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [sent, setSent] = useState(alreadyReported);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!reason || pending) return;
    startTransition(async () => {
      const result = await createRankingReport(rankingId, reason, details);
      if (!result.ok) {
        setFeedback({ type: "error", message: result.error ?? "Invio non riuscito." });
        setConfirming(false);
        return;
      }
      setSent(true);
      setFeedback({ type: "success", message: "Segnalazione inviata. Grazie per averci aiutato." });
      setDialogOpen(false);
      setMenuOpen(false);
      setReason("");
      setDetails("");
      setConfirming(false);
    });
  }

  return <div className="report-renq-wrap">
    {sent ? <span className="report-renq-sent"><CheckCircle2 size={14}/> Segnalazione inviata</span> : <>
      <button type="button" className="report-renq-trigger" aria-label="Altre opzioni" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>
        <MoreHorizontal size={19}/>
      </button>
      {menuOpen && <div className="report-renq-menu" role="menu">
        <button type="button" role="menuitem" onClick={() => { setDialogOpen(true); setMenuOpen(false); setFeedback(null); }}>
          <Flag size={14}/> Segnala questo Renq
        </button>
      </div>}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setConfirming(false); }} overlayClassName="renqd-report-overlay" className="report-renq-dialog renqd-report-dialog" ariaLabel="Segnala questo Renq">
        <div className="report-renq-dialog-head"><div><span>SEGNALAZIONE</span><strong>Aiutaci a capire cosa non va.</strong></div><button type="button" aria-label="Chiudi" onClick={() => { setDialogOpen(false); setConfirming(false); }}>×</button></div>
        {!confirming ? <>
          <label htmlFor="report-renq-reason">Motivo della segnalazione</label>
          <select id="report-renq-reason" autoFocus value={reason} onChange={event => setReason(event.target.value)}>
            <option value="">Seleziona un motivo</option>
            {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label htmlFor="report-renq-details">Dettagli <span>(facoltativi)</span></label>
          <textarea id="report-renq-details" value={details} onChange={event => setDetails(event.target.value)} maxLength={1000} rows={3} placeholder="Aggiungi informazioni utili per la revisione..."/>
          <div className="report-renq-dialog-actions"><small>{details.length}/1000</small><button type="button" disabled={!reason} onClick={() => setConfirming(true)}>Continua</button></div>
        </> : <>
          <p>Confermi l&apos;invio della segnalazione per questo Renq? La segnalazione sarà esaminata dal team di moderazione. Non potrai inviarne un&apos;altra per lo stesso contenuto.</p>
          {feedback && <div className="report-renq-feedback is-error">{feedback.message}</div>}
          <div className="report-renq-dialog-actions"><button type="button" className="is-quiet" onClick={() => setConfirming(false)}>Indietro</button><button type="button" disabled={pending} onClick={submit}>{pending ? <LoaderCircle size={14} className="report-renq-spin"/> : <Flag size={14}/>} Conferma invio</button></div>
        </>}
        {feedback && !confirming && <div className="report-renq-feedback is-error">{feedback.message}</div>}
      </Dialog>
    </>}
    {feedback?.type === "success" && <span className="report-renq-feedback is-success" role="status">{feedback.message}</span>}
  </div>;
}
