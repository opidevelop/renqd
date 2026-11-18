"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ModerationAction = "HIDE" | "UNHIDE" | "TRASH" | "RESTORE";
type ModerationActionResult = { ok: boolean; error?: string; resolvedReportsCount?: number };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function moderateRanking(
  rankingId: string,
  action: ModerationAction,
  reason: string,
): Promise<ModerationActionResult> {
  if (!UUID_PATTERN.test(rankingId)) return { ok: false, error: "Renq non valido." };
  if (!["HIDE", "UNHIDE", "TRASH", "RESTORE"].includes(action)) return { ok: false, error: "Operazione non valida." };
  if (reason.trim().length > 500) return { ok: false, error: "La motivazione non può superare 500 caratteri." };

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessione scaduta. Accedi di nuovo." };

  const { data: actor, error: actorError } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (actorError || !actor || actor.status !== "APPROVED" || !["OWNER", "ADMIN", "MODERATOR"].includes(actor.role)) {
    return { ok: false, error: "Non hai i permessi per moderare i Renq." };
  }

  const { data, error } = await supabase.rpc("moderation_set_ranking_state", {
    p_ranking_id: rankingId,
    p_action: action,
    p_reason: reason.trim() || null,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("insufficient privileges")) return { ok: false, error: "Non hai i permessi per eseguire questa operazione." };
    if (message.includes("published renq not found")) return { ok: false, error: "Renq pubblicato non trovato." };
    if (message.includes("already hidden")) return { ok: false, error: "Il Renq è già nascosto." };
    if (message.includes("already in trash")) return { ok: false, error: "Il Renq è già nel cestino." };
    if (message.includes("not in trash")) return { ok: false, error: "Il Renq non si trova nel cestino." };
    if (message.includes("not in the hidden state")) return { ok: false, error: "Il Renq non risulta nascosto." };
    return { ok: false, error: "Non è stato possibile aggiornare il Renq. Riprova." };
  }

  const result = data as { resolved_reports_count?: number } | null;
  revalidatePath("/moderation");
  revalidatePath("/admin");
  revalidatePath("/rankings");
  revalidatePath("/rankings/trash");
  revalidatePath("/r/[slug]", "page");
  return { ok: true, resolvedReportsCount: result?.resolved_reports_count ?? 0 };
}
