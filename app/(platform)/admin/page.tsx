import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/supabase/authorization";
import AdminUsersPanel, { type AdminAuditLog, type AdminUser } from "@/components/admin-users-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase, profile } = await requireApprovedUser();
  if (profile.role !== "OWNER" && profile.role !== "ADMIN") redirect("/home");

  const [usersResult, auditResult] = await Promise.all([
    supabase.rpc("admin_list_users", { p_status: "ALL", p_search: null }),
    supabase.rpc("admin_list_audit_logs", { p_limit: 50 }),
  ]);

  if (usersResult.error) {
    return <div className="admin-page"><div className="admin-page-heading"><span className="admin-eyebrow">RENQD CONTROL ROOM</span><h1>Amministrazione.</h1></div><div className="admin-feedback is-error">Non è stato possibile caricare gli account. Aggiorna la pagina o riprova più tardi.</div></div>;
  }

  return <div className="admin-page">
    <header className="admin-page-heading">
      <span className="admin-eyebrow">RENQD CONTROL ROOM</span>
      <h1>Gestisci gli <em>accessi.</em></h1>
      <p>Approva le registrazioni, gestisci ruoli e sospensioni e consulta lo storico delle operazioni.</p>
    </header>
    <AdminUsersPanel
      users={(usersResult.data ?? []) as AdminUser[]}
      auditLogs={auditResult.error ? [] : (auditResult.data ?? []) as AdminAuditLog[]}
      actorRole={profile.role}
      auditUnavailable={Boolean(auditResult.error)}
    />
  </div>;
}
