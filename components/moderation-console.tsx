"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Archive, Eye, EyeOff, FileText, History, LoaderCircle,
  RotateCcw, Search, ShieldCheck, Trash2,
} from "lucide-react";
import { moderateRanking } from "@/app/(platform)/moderation/actions";

type ModerationView = "published" | "reported" | "trash";
type ModerationAction = "HIDE" | "UNHIDE" | "TRASH" | "RESTORE";

type ModerationReport = {
  id: string;
  reason: string;
  details: string | null;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  created_at: string;
  reporter_username: string;
};

export type ModerationRanking = {
  ranking_id: string;
  public_slug: string;
  ranking_title: string;
  owner_id: string;
  owner_username: string;
  mode: string;
  visibility: string;
  created_at: string;
  completed_at: string | null;
  hidden_at: string | null;
  deleted_at: string | null;
  open_report_count: number;
  reports: ModerationReport[];
};

export type ModerationAuditLog = {
  log_id: string;
  ranking_id: string | null;
  ranking_title: string;
  actor_username: string;
  owner_username: string;
  action: string;
  previous_state: Record<string, unknown>;
  new_state: Record<string, unknown>;
  reason: string | null;
  resolved_reports_count: number;
  created_at: string;
};

const viewLabels: Record<ModerationView, string> = {
  published: "Pubblicati",
  reported: "Segnalati",
  trash: "Cestino",
};

const actionLabels: Record<ModerationAction, string> = {
  HIDE: "Nascondi",
  UNHIDE: "Rendi visibile",
  TRASH: "Sposta nel cestino",
  RESTORE: "Ripristina dal cestino",
};

function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(parsed);
}

function dateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(parsed);
}

function modeLabel(value: string) {
  return value.replaceAll("_", " ");
}

function actionMessage(action: ModerationAction) {
  if (action === "HIDE") return "Il Renq non sarà più visibile agli utenti, compreso il suo autore.";
  if (action === "UNHIDE") return "Il Renq tornerà visibile secondo le impostazioni di pubblicazione originali.";
  if (action === "TRASH") return "Il Renq passerà nel cestino e potrà essere ripristinato.";
  return "Il Renq uscirà dal cestino. Se era già nascosto, resterà nascosto.";
}

function auditLabel(action: string) {
  return actionLabels[action as ModerationAction] ?? action;
}

export default function ModerationConsole({
  view,
  query,
  rankings,
  auditLogs,
  loadError,
  auditUnavailable,
}: {
  view: ModerationView;
  query: string;
  rankings: ModerationRanking[];
  auditLogs: ModerationAuditLog[];
  loadError: boolean;
  auditUnavailable: boolean;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<{ rankingId: string; action: ModerationAction } | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function requestAction(ranking: ModerationRanking, action: ModerationAction) {
    setPendingAction({ rankingId: ranking.ranking_id, action });
    setReason("");
    setFeedback(null);
  }

  function confirmAction(ranking: ModerationRanking) {
    if (!pendingAction || pendingAction.rankingId !== ranking.ranking_id) return;
    const action = pendingAction.action;
    setBusyId(ranking.ranking_id);
    setFeedback(null);
    startTransition(async () => {
      const result = await moderateRanking(ranking.ranking_id, action, reason);
      setBusyId(null);
      if (!result.ok) {
        setFeedback({ type: "error", message: result.error ?? "Operazione non riuscita." });
        return;
      }
      const resolved = result.resolvedReportsCount ?? 0;
      const suffix = resolved > 0 ? " " + resolved + (resolved === 1 ? " segnalazione chiusa automaticamente." : " segnalazioni chiuse automaticamente.") : "";
      setFeedback({ type: "success", message: actionLabels[action] + " completato." + suffix });
      setPendingAction(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="moderation-page">
      <header className="moderation-heading">
        <span className="moderation-eyebrow">RENQD TRUST & SAFETY</span>
        <h1>Centro <em>moderazione.</em></h1>
        <p>Gestisci i Renq pubblicati, le segnalazioni ricevute e i contenuti nel cestino.</p>
      </header>

      <nav className="moderation-tabs" aria-label="Sezioni moderazione">
        {(["published", "reported", "trash"] as ModerationView[]).map(item => (
          <Link
            key={item}
            href={"/moderation?view=" + item + (query ? "&q=" + encodeURIComponent(query) : "")}
            className={view === item ? "is-active" : ""}
            aria-current={view === item ? "page" : undefined}
          >
            {item === "published" ? <FileText size={16}/> : item === "reported" ? <AlertTriangle size={16}/> : <Archive size={16}/>}
            {viewLabels[item]}
          </Link>
        ))}
      </nav>

      <form className="moderation-search" action="/moderation" method="get">
        <input type="hidden" name="view" value={view}/>
        <Search size={17}/>
        <input type="search" name="q" defaultValue={query} placeholder="Cerca per titolo o username..." aria-label="Cerca Renq"/>
        <button type="submit">Cerca</button>
      </form>

      {feedback && <div className={"moderation-feedback " + (feedback.type === "error" ? "is-error" : "is-success")} role="status">{feedback.message}</div>}

      <section className="moderation-list-section">
        <div className="moderation-section-heading">
          <div>
            <span className="moderation-eyebrow">{view === "trash" ? "CONTENUTI RECUPERABILI" : view === "reported" ? "ATTENZIONE RICHIESTA" : "PANORAMICA CONTENUTI"}</span>
            <h2>{viewLabels[view]} <em>Renq.</em></h2>
            <p>{view === "published" ? "Tutti i Renq completati, inclusi quelli nascosti." : view === "reported" ? "Renq pubblicati con segnalazioni ancora aperte o in revisione." : "Renq spostati nel cestino dalla moderazione o dai proprietari."}</p>
          </div>
          <span className="moderation-count">{rankings.length} contenuti</span>
        </div>

        {loadError ? (
          <div className="moderation-empty"><AlertTriangle size={24}/><strong>Elenco non disponibile</strong><span>Non è stato possibile caricare i Renq. Riprova più tardi.</span></div>
        ) : rankings.length === 0 ? (
          <div className="moderation-empty"><ShieldCheck size={25}/><strong>Nessun contenuto in questa sezione</strong><span>{view === "reported" ? "Non risultano segnalazioni aperte sui Renq pubblicati." : "Quando saranno presenti contenuti, li troverai qui."}</span></div>
        ) : (
          <div className="moderation-ranking-list">
            {rankings.map(ranking => {
              const action = pendingAction?.rankingId === ranking.ranking_id ? pendingAction.action : null;
              const busy = isPending && busyId === ranking.ranking_id;
              return (
                <article className="moderation-ranking-card" key={ranking.ranking_id}>
                  <div className="moderation-ranking-top">
                    <div className="moderation-ranking-copy">
                      <span className="moderation-ranking-overline">{modeLabel(ranking.mode)} · @{ranking.owner_username}</span>
                      <h3>{ranking.ranking_title}</h3>
                      <p>Completato il {date(ranking.completed_at)} · Visibilità: {ranking.visibility === "LIVE" ? "Live" : "Reveal"}</p>
                    </div>
                    <div className="moderation-badges">
                      {ranking.hidden_at && <span className="moderation-badge is-hidden"><EyeOff size={12}/> Nascosto</span>}
                      {ranking.deleted_at && <span className="moderation-badge is-trash"><Trash2 size={12}/> Nel cestino</span>}
                      {ranking.open_report_count > 0 && <span className="moderation-badge is-reported"><AlertTriangle size={12}/> {ranking.open_report_count} segnalazioni</span>}
                    </div>
                  </div>

                  {ranking.reports?.length > 0 && (
                    <details className="moderation-reports">
                      <summary><AlertTriangle size={14}/> Dettaglio segnalazioni ({ranking.reports.length})</summary>
                      <div className="moderation-report-list">
                        {ranking.reports.map(report => (
                          <article key={report.id}>
                            <div><strong>{report.reason}</strong><span>@{report.reporter_username} · {dateTime(report.created_at)} · {report.status === "IN_REVIEW" ? "In revisione" : "Aperta"}</span></div>
                            {report.details && <p>{report.details}</p>}
                          </article>
                        ))}
                      </div>
                    </details>
                  )}

                  <div className="moderation-card-actions">
                    {ranking.public_slug && <Link href={"/r/" + ranking.public_slug} target="_blank">Apri Renq</Link>}
                    {view === "trash" ? (
                      <button type="button" onClick={() => requestAction(ranking, "RESTORE")} disabled={busy}><RotateCcw size={14}/> Ripristina</button>
                    ) : (
                      <>
                        {ranking.hidden_at
                          ? <button type="button" onClick={() => requestAction(ranking, "UNHIDE")} disabled={busy}><Eye size={14}/> Rendi visibile</button>
                          : <button type="button" onClick={() => requestAction(ranking, "HIDE")} disabled={busy}><EyeOff size={14}/> Nascondi</button>}
                        <button type="button" className="is-danger" onClick={() => requestAction(ranking, "TRASH")} disabled={busy}><Trash2 size={14}/> Sposta nel cestino</button>
                      </>
                    )}
                  </div>

                  {action && (
                    <div className="moderation-confirm">
                      <strong>{actionLabels[action]} «{ranking.ranking_title}»?</strong>
                      <p>{actionMessage(action)}</p>
                      <label htmlFor={"moderation-reason-" + ranking.ranking_id}>Nota interna (facoltativa)</label>
                      <textarea
                        id={"moderation-reason-" + ranking.ranking_id}
                        value={reason}
                        onChange={event => setReason(event.target.value)}
                        maxLength={500}
                        rows={2}
                        placeholder="Aggiungi una nota per lo storico..."
                      />
                      <div><small>{reason.length}/500</small><button type="button" onClick={() => { setPendingAction(null); setReason(""); }}>Annulla</button><button type="button" className="is-confirm" onClick={() => confirmAction(ranking)} disabled={busy}>{busy ? <LoaderCircle size={14} className="moderation-spin"/> : <ShieldCheck size={14}/>} Conferma</button></div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="moderation-audit-section">
        <div className="moderation-section-heading">
          <div><span className="moderation-eyebrow">TRACCIABILITÀ</span><h2>Registro <em>moderazione.</em></h2><p>Ultime operazioni eseguite da OWNER, ADMIN e MODERATOR.</p></div>
          <span className="moderation-count">{auditLogs.length} operazioni</span>
        </div>
        {auditUnavailable ? (
          <div className="moderation-empty compact"><AlertTriangle size={20}/><strong>Registro non disponibile</strong></div>
        ) : auditLogs.length === 0 ? (
          <div className="moderation-empty compact"><History size={20}/><strong>Nessuna operazione registrata</strong></div>
        ) : (
          <div className="moderation-audit-list">
            {auditLogs.map(log => (
              <article key={log.log_id}>
                <span className="moderation-audit-icon"><History size={15}/></span>
                <div><strong>{auditLabel(log.action)} · {log.ranking_title}</strong><p>@{log.actor_username} · proprietario @{log.owner_username} · {dateTime(log.created_at)}</p>
                  {log.resolved_reports_count > 0 && <small>{log.resolved_reports_count} segnalazioni risolte automaticamente</small>}
                  {log.reason && <small>Nota: {log.reason}</small>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
