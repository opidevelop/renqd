"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function reviewAdminAccount(
  targetUserId: string,
  decision: "APPROVED" | "REJECTED",
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
    return { ok: false, error: "Account non valido." };
  }

  const normalizedReason = reason.trim();
  if (decision === "REJECTED" && !normalizedReason) {
    return { ok: false, error: "Inserisci una motivazione per il rifiuto." };
  }
  if (normalizedReason.length > 500) {
    return { ok: false, error: "La motivazione non può superare 500 caratteri." };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessione scaduta. Accedi di nuovo." };

  const { data: actor, error: actorError } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (actorError || !actor || actor.status !== "APPROVED" || !["OWNER", "ADMIN"].includes(actor.role)) {
    return { ok: false, error: "Non hai i permessi per gestire gli account." };
  }

  const { error } = await supabase.rpc("admin_review_user", {
    p_target_user_id: targetUserId,
    p_new_status: decision,
    p_reason: normalizedReason || null,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("email address must be verified")) {
      return { ok: false, error: "L'utente deve prima verificare il proprio indirizzo email." };
    }
    if (message.includes("only pending accounts")) {
      return { ok: false, error: "Questa richiesta è già stata gestita o non è più in attesa." };
    }
    if (message.includes("reason is required")) {
      return { ok: false, error: "Inserisci una motivazione per il rifiuto." };
    }
    if (message.includes("insufficient privileges")) {
      return { ok: false, error: "Non hai i permessi per eseguire questa operazione." };
    }
    return { ok: false, error: "Non è stato possibile aggiornare l'account. Riprova." };
  }

  revalidatePath("/admin");
  return { ok: true };
}
