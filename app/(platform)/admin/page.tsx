import Link from "next/link";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/supabase/authorization";
import AdminUsersPanel, { type AdminAuditLog, type AdminUser } from "@/components/admin-users-panel";
import ModerationConsole, { type ModerationAuditLog, type ModerationRanking } from "@/components/moderation-console";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; view?: string; q?: string }>;
}) {
  const { supabase, user, profile } = await requireApprovedUser();
  const isAdmin = profile.role === "OWNER" || profile.role === "ADMIN";
  const isModerator = profile.role === "MODERATOR";
  if (!isAdmin && !isModerator) redirect("/home");

  const params = await searchParams;
  const section = isAdmin && params.section === "users" ? "users" : "moderation";

  if (section === "users") {
    const [usersResult, auditResult] = await Promise.all([
      supabase.rpc("admin_list_users", { p_status: "ALL", p_search: null }),
      supabase.rpc("admin_list_audit_logs", { p_limit: 50 }),
    ]);
    return <div className="admin-page">
      <header className="admin-page-heading">
        <span className="admin-eyebrow">RENQD CONTROL ROOM</span>
        <h1>Dashboard <em>Amministrazione.</em></h1>
        <p>Gestisci gli account, le autorizzazioni e lo storico delle operazioni.</p>
      </header>
      <nav className="admin-dashboard-tabs" aria-label="Sezioni amministrazione">
        <Link href="/admin?section=moderation">Moderazione</Link>
        <Link href="/admin?section=users" className="is-active" aria-current="page">Utenti e accessi</Link>
      </nav>
      {usersResult.error
        ? <div className="admin-feedback is-error">Non è stato possibile caricare gli account. Aggiorna la pagina o riprova più tardi.</div>
        : <AdminUsersPanel
            users={(usersResult.data ?? []) as AdminUser[]}
            auditLogs={auditResult.error ? [] : (auditResult.data ?? []) as AdminAuditLog[]}
            actorRole={profile.role as "OWNER" | "ADMIN"}
            actorUserId={user.id}
            auditUnavailable={Boolean(auditResult.error)}
          />}
    </div>;
  }

  const requestedView = (params.view ?? "published").toLowerCase();
  const view = ["published", "reported", "trash"].includes(requestedView) ? requestedView : "published";
  const query = (params.q ?? "").trim().slice(0, 100);
  const [rankingsResult, auditResult] = await Promise.all([
    supabase.rpc("moderation_list_rankings", {
      p_view: view.toUpperCase(),
      p_search: query || null,
    }),
    supabase.rpc("moderation_list_audit_logs", { p_limit: 30 }),
  ]);
  return <div className="admin-page">
    <header className="admin-page-heading">
      <span className="admin-eyebrow">RENQD CONTROL ROOM</span>
      <h1>Dashboard <em>Amministrazione.</em></h1>
      <p>{isAdmin
        ? "Un unico spazio per moderare i Renq e amministrare gli account."
        : "Gestisci i contenuti pubblicati e le segnalazioni della community."}</p>
    </header>
    {isAdmin && <nav className="admin-dashboard-tabs" aria-label="Sezioni amministrazione">
      <Link href="/admin?section=moderation" className="is-active" aria-current="page">Moderazione</Link>
      <Link href="/admin?section=users">Utenti e accessi</Link>
    </nav>}
    <ModerationConsole
      basePath="/admin"
      view={view as "published" | "reported" | "trash"}
      query={query}
      rankings={(rankingsResult.data ?? []) as ModerationRanking[]}
      auditLogs={(auditResult.data ?? []) as ModerationAuditLog[]}
      loadError={Boolean(rankingsResult.error)}
      auditUnavailable={Boolean(auditResult.error)}
    />
  </div>;
}
