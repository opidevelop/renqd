import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/supabase/authorization";
import AdminUsersPanel, { type AdminUser } from "@/components/admin-users-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase, profile } = await requireApprovedUser();
  if (profile.role !== "OWNER" && profile.role !== "ADMIN") redirect("/home");

  const { data, error } = await supabase.rpc("admin_list_users", {
    p_status: "ALL",
    p_search: null,
  });

  if (error) {
    return <div className="admin-page"><div className="admin-page-heading"><span className="admin-eyebrow">RENQD CONTROL ROOM</span><h1>Amministrazione.</h1></div><div className="admin-feedback is-error">Non è stato possibile caricare gli account. Aggiorna la pagina o riprova più tardi.</div></div>;
  }

  return <div className="admin-page">
    <header className="admin-page-heading">
      <span className="admin-eyebrow">RENQD CONTROL ROOM</span>
      <h1>Gestisci gli <em>accessi.</em></h1>
      <p>Approva le nuove registrazioni e controlla lo stato degli account della piattaforma.</p>
    </header>
    <AdminUsersPanel users={(data ?? []) as AdminUser[]}/>
  </div>;
}
