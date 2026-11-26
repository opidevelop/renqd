import Link from "next/link";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/supabase/authorization";
import AdminUsersPanel, { type AdminAuditLog, type AdminUser } from "@/components/admin-users-panel";
import ModerationConsole, { type ModerationAuditLog, type ModerationRanking } from "@/components/moderation-console";
import {CatalogReportsConsole, type CatalogReport} from "@/components/drag-race/catalog-reports-console";

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
  const section = isAdmin && params.section === "users" ? "users" : params.section === "drag-race-reports" ? "drag-race-reports" : "moderation";

  if (section === "drag-race-reports") {
    const reportsResult = await supabase.from("drag_race_catalog_reports").select("*").order("created_at", { ascending: false }).limit(100);
    return <div className="admin-page">
      <header className="admin-page-heading">
        <span className="admin-eyebrow">RENQD CONTROL ROOM</span>
        <h1>Dashboard <em>Amministrazione.</em></h1>
        <p>Esamina le segnalazioni ¶»§q«^