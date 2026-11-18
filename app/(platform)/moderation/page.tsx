import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/supabase/authorization";
import ModerationConsole, { type ModerationAuditLog, type ModerationRanking } from "@/components/moderation-console";

export const dynamic = "force-dynamic";

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const { supabase, profile } = await requireApprovedUser();
  if (!["OWNER", "ADMIN", "MODERATOR"].includes(profile.role)) redirect("/home");

  const params = await searchParams;
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

  return (
    <ModerationConsole
      view={view as "published" | "reported" | "trash"}
      query={query}
      rankings={(rankingsResult.data ?? []) as ModerationRanking[]}
      auditLogs={(auditResult.data ?? []) as ModerationAuditLog[]}
      loadError={Boolean(rankingsResult.error)}
      auditUnavailable={Boolean(auditResult.error)}
    />
  );
}
