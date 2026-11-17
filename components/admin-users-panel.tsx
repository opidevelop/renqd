"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Search, ShieldCheck, Clock3, Users, MailCheck, LoaderCircle } from "lucide-react";
import { reviewAdminAccount } from "@/app/(platform)/admin/actions";

type AccountStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
type StatusFilter = "ALL" | AccountStatus;

export type AdminUser = {
  user_id: string;
  email: string;
  username: string;
  account_role: string;
  account_status: AccountStatus;
  created_at: string;
  email_confirmed_at: string | null;
};

const filters: { id: StatusFilter; label: string }[] = [
  { id: "ALL", label: "Tutti" },
  { id: "PENDING", label: "In attesa" },
  { id: "APPROVED", label: "Approvati" },
  { id: "REJECTED", label: "Rifiutati" },
  { id: "SUSPENDED", label: "Sospesi" },
];

const statusLabels: Record<AccountStatus, string> = {
  PENDING: "In attesa",
  APPROVED: "Approvato",
  REJECTED: "Rifiutato",
  SUSPENDED: "Sospeso",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return day + "/" + month + "/" + year;
}

export default function AdminUsersPanel({ users }: { users: AdminUser[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => ({
    ALL: users.length,
    PENDING: users.filter(user => user.account_status === "PENDING").length,
    APPROVED: users.filter(user => user.account_status === "APPROVED").length,
    REJECTED: users.filter(user => user.account_status === "REJECTED").length,
    SUSPENDED: users.filter(user => user.account_status === "SUSPENDED").length,
  }), [users]);

  const visibleUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return users.filter(user => {
      const matchesStatus = filter === "ALL" || user.account_status === filter;
      const matchesSearch = !normalized || user.username.toLowerCase().includes(normalized) || user.email.toLowerCase().includes(normalized);
      return matchesStatus && matchesSearch;
    });
  }, [users, filter, search]);

  function review(user: AdminUser, decision: "APPROVED" | "REJECTED") {
    const why = decision === "REJECTED" ? reason.trim() : "";
    if (decision === "REJECTED" && !why) {
      setFeedback({ type: "error", message: "Inserisci una motivazione per il rifiuto." });
      return;
    }
    setFeedback(null);
    setBusyId(user.user_id);
    startTransition(async () => {
      const result = await reviewAdminAccount(user.user_id, decision, why);
      setBusyId(null);
      if (!result.ok) {
        setFeedback({ type: "error", message: result.error ?? "Operazione non riuscita." });
        return;
      }
      setFeedback({
        type: "success",
        message: decision === "APPROVED" ? "Account @" + user.username + " approvato." : "Richiesta di @" + user.username + " rifiutata.",
      });
      setRejectingId(null);
      setReason("");
      router.refresh();
    });
  }

  return <div className="admin-dashboard">
    <section className="admin-stats-grid" aria-label="Riepilogo account">
      <article className="admin-stat-card admin-stat-pending"><span><Clock3 size={17}/> In attesa</span><strong>{counts.PENDING}</strong><small>Richieste da esaminare</small></article>
      <article className="admin-stat-card"><span><Users size={17}/> Utenti approvati</span><strong>{counts.APPROVED}</strong><small>Account abilitati</small></article>
      <article className="admin-stat-card"><span><X size={17}/> Rifiutati</span><strong>{counts.REJECTED}</strong><small>Richieste non accolte</small></article>
      <article className="admin-stat-card"><span><ShieldCheck size={17}/> Totale account</span><strong>{counts.ALL}</strong><small>Profili registrati</small></article>
    </section>

    {feedback && <div className={"admin-feedback is-" + feedback.type} role="status">{feedback.message}</div>}

    <section className="admin-users-section">
      <div className="admin-section-heading">
        <div><span className="admin-eyebrow">GESTIONE UTENTI</span><h2>Account <em>registrati.</em></h2><p>Controlla le richieste e gestisci l'accesso alla piattaforma.</p></div>
        <span className="admin-total-pill">{visibleUsers.length} risultati</span>
      </div>

      <label className="admin-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cerca per username o email..." aria-label="Cerca utenti"/></label>

      <div className="admin-filter-tabs" role="tablist" aria-label="Filtra account per stato">
        {filters.map(item => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? "is-active" : ""} onClick={() => setFilter(item.id)}>{item.label}<span>{counts[item.id]}</span></button>)}
      </div>

      <div className="admin-user-list">
        {visibleUsers.length === 0 ? <div className="admin-empty"><Users size={24}/><strong>Nessun account trovato</strong><span>Prova a cambiare filtro o termine di ricerca.</span></div> : visibleUsers.map(user => {
          const initials = (user.username || user.email || "R").slice(0, 1).toUpperCase();
          const isBusy = isPending && busyId === user.user_id;
          return <article className="admin-user-card" key={user.user_id}>
            <div className="admin-user-main">
              <div className="admin-user-avatar">{initials}</div>
              <div className="admin-user-identity"><div className="admin-user-title"><strong>@{user.username}</strong><span className={"admin-status status-" + user.account_status.toLowerCase()}>{statusLabels[user.account_status]}</span></div><span>{user.email}</span><small>Registrato il {formatDate(user.created_at)} · {user.account_role}</small></div>
              <div className={"admin-email-state " + (user.email_confirmed_at ? "is-verified" : "is-unverified")}>{user.email_confirmed_at ? <><MailCheck size={15}/> Email verificata</> : <><Clock3 size={15}/> Email da verificare</>}</div>
            </div>

            {user.account_status === "PENDING" && <div className="admin-review-actions">
              {rejectingId === user.user_id ? <div className="admin-reject-box"><label htmlFor={"reason-" + user.user_id}>Motivazione del rifiuto</label><textarea id={"reason-" + user.user_id} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={2} placeholder="Spiega brevemente perché la richiesta non viene approvata."/><div className="admin-reject-footer"><small>{reason.length}/500 caratteri</small><button type="button" className="admin-button admin-button-quiet" onClick={() => { setRejectingId(null); setReason(""); }}>Annulla</button><button type="button" className="admin-button admin-button-danger" disabled={isBusy || !reason.trim()} onClick={() => review(user, "REJECTED")}>{isBusy ? <LoaderCircle size={15} className="admin-spin"/> : <X size={15}/>} Rifiuta account</button></div></div> : <div className="admin-action-buttons">
                <button type="button" className="admin-button admin-button-approve" disabled={isBusy || !user.email_confirmed_at} title={!user.email_confirmed_at ? "L'utente deve prima verificare l'email" : undefined} onClick={() => review(user, "APPROVED")}>{isBusy ? <LoaderCircle size={15} className="admin-spin"/> : <Check size={15}/>} Approva</button>
                <button type="button" className="admin-button admin-button-quiet" disabled={isBusy} onClick={() => { setRejectingId(user.user_id); setReason(""); setFeedback(null); }}><X size={15}/> Rifiuta</button>
              </div>}
            </div>}
          </article>;
        })}
      </div>
    </section>
  </div>;
}
