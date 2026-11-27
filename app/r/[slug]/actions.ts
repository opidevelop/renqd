"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ReportResult = { ok: boolean; error?: string };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPORT_REASONS = ["INAPPROPRIATE_CONTENT", "SPAM", "HARASSMENT", "COPYRIGHT", "FALSE_INFORMATION", "OTHER"];

export async function createRankingReport(
  rankingId: string,
  reason: string,
  details: string,
): Promise<ReportResult> {
  if (typeof rankingId !== "string" || !UUID_PATTERN.test(rankingId)) return { ok: false, error: "Renq non valido." };
  if (typeof reason !== "string" || !REPORT_REASONS.includes(reason)) return { ok: false, error: "Seleziona un motivo valido." };
  if (typeof details !== "string" || details.trim().length > 1000) return { ok: false, error: "I dettagli non possono superare 1.000 caratteri." };

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessione scaduta. Accedi di nuovo." };

  const { data: actor, error: actorError } = await supabase
    .from("profiles").select("status").eq("id", user.id).maybeSingle();
  if (actorError || actor?.status !== "APPROVED") {
    return { ok: false, error: "Solo gli utenti approvati possono segnalare un Renq." };
  }

  const { error } = await supabase.rpc("create_ranking_report", {
    p_ranking_id: rankingId, p_reason: reason, p_details: details.trim() || null,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already reported")) return { ok: false, error: "Hai già inviato una segnalazione per questo Renq." };
    if (message.includes("cannot report own")) return { ok: false, error: "Non puoi segnalare un tuo Renq." };
    if (message.includes("not reportable")) return { ok: false, error: "Questo Renq non è più segnalabile." };
    if (message.includes("insufficient privileges")) return { ok: false, error: "Non hai i permessi per inviare una segnalazione." };
    return { ok: false, error: "Non è stato possibile inviare la segnalazione. Riprova." };
  }
  revalidatePath("/r/[slug]", "page");
  revalidatePath("/admin");
  return { ok: true };
}
