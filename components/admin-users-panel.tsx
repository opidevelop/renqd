"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check, X, Search, ShieldCheck, Clock3, Users, MailCheck, LoaderCircle,
  PauseCircle, PlayCircle, History, Shield, UserCog, Save, ArrowUpRight,
} from "lucide-react";
import {
  reviewAdminAccount,
  manageAdminAccount,
  changeAdminUserRole,
} from "@/app/(platform)/admin/actions";
import DeleteAccountButton from "@/components/delete-account-button";

type AccountStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
type StatusFilter = "ALL" | AccountStatus;
type AccountRole = "USER" | "MODERATOR" | "ADMIN" | "OWNER";
type AdminAction = "reject" | "suspend" | "role";

export type AdminUser = {
  user_id: string;
  email: string;
  username: string;
  account_role: AccountRole;
  account_status: AccountStatus;
  created_at: string;
  email_confirmed_at: string | null;
};

export type AdminAuditLog = {
  log_id: string;
  actor_id: string;
  actor_username: string;
  target_user_id: string;
  target_username: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
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

const roleLabels: Record<AccountRole, string> = {
  USER: "Utente",
  MODERATOR: "Moderatore",
  ADMIN: "Admin",
  OWNER: "Owner",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function auditActionLabel(action: string) {
  if (action === "STATUS_CHANGED") return "Stato account";
  if (action === "ROLE_CHANGED") return "Ruolo account";
  return action.replaceAll("_", " ").toLowerCase();
}

export default function AdminUsersPanel({
  users,
  auditLogs,
  actorRole,
  actorUserId,
  auditUnavailable = false,
}: {
  users: AdminUser[];
  auditLogs: AdminAuditLog[];
  actorRole: "OWNER" | "ADMIN";
  actorUserId: string;
  auditUnavailable?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [activeAction, setActiveAction] = useState<{ userId: string; type: AdminAction } | null>(null);
  const [reason, setReason] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Record<string, AccountRole>>({});
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

  function finishAction(message: string) {
    setFeedback({ type: "success", message });
    setActiveAction(null);
    setReason("");
    router.refresh();
  }

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
      finishAction(decision === "APPROVED"
        ? result.emailSent
          ? "Account @" + user.username + " approvato. Email di conferma inviata."
          : "Account @" + user.username + " approvato, ma l'email non è stata inviata. Verifica RESEND_API_KEY e RENQD_EMAIL_FROM su Vercel."
        : "Richiesta di @" + user.username + " rifiutata.");
    });
  }

  function manageStatus(user: AdminUser, status: "APPROVED" | "SUSPENDED") {
    const why = reason.trim();
    if (status === "SUSPENDED" && !why) {
      setFeedback({ type: "error", message: "Inserisci una motivazione per la sospensione." });
      return;
    }
    setFeedback(null);
    setBusyId(user.user_id);
    startTransition(async () => {
      const result = await manageAdminAccount(user.user_id, status, why);
      setBusyId(null);
      if (!result.ok) {
        setFeedback({ type: "error", message: result.error ?? "Operazione non riuscita." });
        return;
      }
      finishAction(status === "SUSPENDED"
        ? "Account @" + user.username + " sospeso."
        : "Account @" + user.username + " riattivato.");
    });
  }

  function saveRole(user: AdminUser) {
    const role = selectedRoles[user.user_id] ?? user.account_role;
    if (role === user.account_role) return;
    setFeedback(null);
    setBusyId(user.user_id);
    startTransition(async () => {
      const result = await changeAdminUserRole(user.user_id, role as "USER" | "MODERATOR" | "ADMIN", reason.trim());
      setBusyId(null);
      if (!result.ok) {
        setFeedback({ type: "error", message: result.error ?? "Operazione non riuscita." });
        return;
      }
      setSelectedRoles(current => ({ ...current, [user.user_id]: role }));
      finishAction("Ruolo di @" + user.username + " aggiornato: " + roleLabels[role] + ".");
    });
  }

  return <div className="admin-dashboard">
    <section className="admin-stats-grid" aria-label="Riepilogo account">
      <article className="admin-stat-card admin-stat-pending"><span><Clock3 size={17}/> In attesa</span><strong>{counts.PENDING}</strong><small>Richieste da esaminare</small></article>
      <article className="admin-stat-card"><span><Users size={17}/> Utenti approvati</span><strong>{counts.APPROVED}</strong><small>Account abilitati</small></article>
      <article className="admin-stat-card"><span><PauseCircle size={17}/> Sospesi</span><strong>{counts.SUSPENDED}</strong><small>Account non abilitati</small></article>
      <article className="admin-stat-card"><span><ShieldCheck size={17}/> Totale account</span><strong>{counts.ALL}</strong><small>Profili registrati</small></article>
    </section>

    {feedback && <div className={"admin-feedback is-" + feedback.type} role="status">{feedback.message}</div>}

    <section className="admin-users-section">
      <div className="admin-section-heading">
        <div><span className="admin-eyebrow">GESTIONE UTENTI</span><h2>Account <em>registrati.</em></h2><p>Controlla le richieste e gestisci accessi e ruoli della piattaforma.</p></div>
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
          const isOwner = user.account_role === "OWNER";
          const isProtectedTarget = isOwner || (actorRole === "ADMIN" && user.account_role === "ADMIN");
          const action = activeAction?.userId === user.user_id ? activeAction.type : null;
          const canManageRole = !isProtectedTarget && (user.account_status === "APPROVED" || user.account_status === "SUSPENDED")
            && (actorRole === "OWNER" || user.account_role !== "ADMIN");
          const roleOptions: AccountRole[] = actorRole === "OWNER" ? ["USER", "MODERATOR", "ADMIN"] : ["USER", "MODERATOR"];
          const selectedRole = selectedRoles[user.user_id] ?? user.account_role;

          return <article className="admin-user-card" key={user.user_id}>
            <div className="admin-user-main">
              <div className="admin-user-avatar">{initials}</div>
              <div className="admin-user-identity">
                <div className="admin-user-title">
                  <strong>@{user.username}</strong>
                  <span className={"admin-status status-" + user.account_status.toLowerCase()}>{statusLabels[user.account_status]}</span>
                  <Link href={"/admin/users/" + user.user_id} className="admin-user-detail-link">Scheda <ArrowUpRight size={12}/></Link>
                </div>
                <span>{user.email}</span>
                <small>Registrato il {formatDate(user.created_at)} · {roleLabels[user.account_role]}</small>
              </div>
              <div className={"admin-email-state " + (user.email_confirmed_at ? "is-verified" : "is-unverified")}>
                {user.email_confirmed_at ? <><MailCheck size={15}/> Email verificata</> : <><Clock3 size={15}/> Email da verificare</>}
              </div>
            </div>

            {user.account_status === "PENDING" && <div className="admin-review-actions">
              {action === "reject" ? <div className="admin-reject-box">
                <label htmlFor={"reason-" + user.user_id}>Motivazione del rifiuto</label>
                <textarea id={"reason-" + user.user_id} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={2} placeholder="Spiega brevemente perché la richiesta non viene approvata."/>
                <div className="admin-reject-footer"><small>{reason.length}/500 caratteri</small><button type="button" className="admin-button admin-button-quiet" onClick={() => { setActiveAction(null); setReason(""); }}>Annulla</button><button type="button" className="admin-button admin-button-danger" disabled={isBusy || !reason.trim()} onClick={() => review(user, "REJECTED")}>{isBusy ? <LoaderCircle size={15} className="admin-spin"/> : <X size={15}/>} Rifiuta account</button></div>
              </div> : <div className="admin-action-buttons">
                <button type="button" className="admin-button admin-button-approve" disabled={isBusy || !user.email_confirmed_at || isProtectedTarget} title={!user.email_confirmed_at ? "L'utente deve prima verificare l'email" : undefined} onClick={() => review(user, "APPROVED")}>{isBusy ? <LoaderCircle size={15} className="admin-spin"/> : <Check size={15}/>} Approva</button>
                <button type="button" className="admin-button admin-button-quiet" disabled={isBusy || isProtectedTarget} onClick={() => { setActiveAction({ userId: user.user_id, type: "reject" }); setReason(""); setFeedback(null); }}><X size={15}/> Rifiuta</button>
              </div>}
            </div>}

            {(user.account_status === "APPROVED" || user.account_status === "SUSPENDED") && !isOwner && <div className="admin-management-actions">
              <div className="admin-management-row">
                {user.account_status === "APPROVED"
                  ? <button type="button" className="admin-button admin-button-danger" disabled={isBusy || isProtectedTarget} onClick={() => { setActiveAction({ userId: user.user_id, type: "suspend" }); setReason(""); setFeedback(null); }}><PauseCircle size={15}/> Sospendi account</button>
                  : <button type="button" className="admin-button admin-button-approve" disabled={isBusy || isProtectedTarget} onClick={() => manageStatus(user, "APPROVED")}>{isBusy ? <LoaderCircle size={15} className="admin-spin"/> : <PlayCircle size={15}/>} Riattiva account</button>}
                {canManageRole && <div className="admin-role-editor">
                  <label htmlFor={"role-" + user.user_id}><UserCog size={14}/> Ruolo</label>
                  <select id={"role-" + user.user_id} value={selectedRole} disabled={isBusy} onChange={event => setSelectedRoles(current => ({ ...current, [user.user_id]: event.target.value as AccountRole }))}>
                    {roleOptions.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  </select>
                  <button type="button" className="admin-button admin-button-quiet" disabled={isBusy || selectedRole === user.account_role} onClick={() => { setActiveAction({ userId: user.user_id, type: "role" }); setReason(""); setFeedback(null); }}><Save size={14}/> Salva ruolo</button>
                </div>}
              </div>
              {action === "suspend" && <div className="admin-management-reason">
                <label htmlFor={"suspend-reason-" + user.user_id}>Motivazione della sospensione</label>
                <textarea id={"suspend-reason-" + user.user_id} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={2} placeholder="Indica il motivo della sospensione."/>
                <div className="admin-reject-footer"><small>{reason.length}/500 caratteri</small><button type="button" className="admin-button admin-button-quiet" onClick={() => { setActiveAction(null); setReason(""); }}>Annulla</button><button type="button" className="admin-button admin-button-danger" disabled={isBusy || !reason.trim()} onClick={() => manageStatus(user, "SUSPENDED")}>{isBusy ? <LoaderCircle size={15} className="admin-spin"/> : <PauseCircle size={15}/>} Conferma sospensione</button></div>
              </div>}
              {action === "role" && <div className="admin-management-reason">
                <label htmlFor={"role-reason-" + user.user_id}>Motivazione (facoltativa)</label>
                <textarea id={"role-reason-" + user.user_id} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={2} placeholder="Aggiungi una nota allo storico, se necessario."/>
                <div className="admin-reject-footer"><small>{reason.length}/500 caratteri</small><button type="button" className="admin-button admin-button-quiet" onClick={() => { setActiveAction(null); setReason(""); }}>Annulla</button><button type="button" className="admin-button admin-button-approve" disabled={isBusy || selectedRole === user.account_role} onClick={() => saveRole(user)}>{isBusy ? <LoaderCircle size={15} className="admin-spin"/> : <Save size={15}/>} Conferma ruolo</button></div>
              </div>}
            </div>}
            {isOwner && <div className="admin-protected-note"><Shield size={14}/> Ruolo e stato degli account OWNER non sono modificabili.</div>}
            {actorRole === "OWNER" && user.user_id !== actorUserId && <DeleteAccountButton targetUserId={user.user_id} username={user.username} location="list" />}
            {!isOwner && isProtectedTarget && <div className="admin-protected-note"><Shield size={14}/> Gli account ADMIN possono essere gestiti soltanto dall’OWNER.</div>}
          </article>;
        })}
      </div>
    </section>

    <section className="admin-audit-section">
      <div className="admin-section-heading">
        <div><span className="admin-eyebrow">TRACCIABILITÀ</span><h2>Registro <em>attività.</em></h2><p>Ultime 50 modifiche a ruoli e stati degli account.</p></div>
        <span className="admin-total-pill">{auditLogs.length} operazioni</span>
      </div>
      {auditUnavailable
        ? <div className="admin-feedback is-error">Lo storico non è al momento disponibile.</div>
        : auditLogs.length === 0
          ? <div className="admin-empty"><History size={24}/><strong>Nessuna operazione registrata</strong><span>Le prossime modifiche saranno mostrate qui.</span></div>
          : <div className="admin-audit-list">{auditLogs.map(log => <article className="admin-audit-item" key={log.log_id}>
              <div className="admin-audit-icon"><History size={16}/></div>
              <div className="admin-audit-content">
                <div className="admin-audit-heading"><strong>{auditActionLabel(log.action)}</strong><time dateTime={log.created_at}>{formatDateTime(log.created_at)}</time></div>
                <p><b>@{log.actor_username}</b> ha modificato <b>@{log.target_username}</b>: <span>{log.old_value ?? "—"} → {log.new_value ?? "—"}</span></p>
                {log.reason && <small>{log.reason}</small>}
              </div>
            </article>)}</div>}
    </section>
  </div>;
}
