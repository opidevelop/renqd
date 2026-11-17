"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendAccountApprovedEmail } from "@/lib/email";

type AdminActionResult = { ok: boolean; error?: string; emailSent?: boolean };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getAuthorizedAdmin(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { error: string }
> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Sessione scaduta. Accedi di nuovo." };

  const { data: actor, error: actorError } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (actorError || !actor || actor.status !== "APPROVED" || !["OWNER", "ADMIN"].includes(actor.role)) {
    return { error: "Non hai i permessi per gestire gli account." };
  }

  return { supabase, userId: user.id };
}

function validateTarget(targetUserId: string, reason: string): string | null {
  if (!UUID_PATTERN.test(targetUserId)) return "Account non valido.";
  if (reason.trim().length > 500) return "La motivazione non può superare 500 caratteri.";
  return null;
}

function mapAdminError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("insufficient privileges") || normalized.includes("only owner")) return "Non hai i permessi per eseguire questa operazione.";
  if (normalized.includes("owner") && normalized.includes("protected")) return "L'account OWNER è protetto.";
  if (normalized.includes("invalid target")) return "Non puoi modificare il tuo stesso account.";
  if (normalized.includes("reason is required")) return "Inserisci una motivazione.";
  if (normalized.includes("already has the requested")) return "L'account ha già questo valore.";
  if (normalized.includes("only approved or suspended") || normalized.includes("roles can only be changed")) return "Questa operazione non è disponibile per lo stato attuale dell'account.";
  if (normalized.includes("target account not found")) return "Account non trovato.";
  return "Non è stato possibile aggiornare l'account. Riprova.";
}

export async function reviewAdminAccount(
  targetUserId: string,
  decision: "APPROVED" | "REJECTED",
  reason: string,
): Promise<AdminActionResult> {
  const validationError = validateTarget(targetUserId, reason);
  if (validationError) return { ok: false, error: validationError };

  const auth = await getAuthorizedAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };

  const normalizedReason = reason.trim();
  if (decision === "REJECTED" && !normalizedReason) {
    return { ok: false, error: "Inserisci una motivazione per il rifiuto." };
  }

  const { error } = await auth.supabase.rpc("admin_review_user", {
    p_target_user_id: targetUserId,
    p_new_status: decision,
    p_reason: normalizedReason || null,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email address must be verified")) {
      return { ok: false, error: "L'utente deve prima verificare il proprio indirizzo email." };
    }
    if (error.message.toLowerCase().includes("only pending accounts")) {
      return { ok: false, error: "Questa richiesta è già stata gestita o non è più in attesa." };
    }
    return { ok: false, error: mapAdminError(error.message) };
  }

  let emailSent = false;
  if (decision === "APPROVED") {
    const { data: detail, error: detailError } = await auth.supabase.rpc(
      "admin_get_user_detail",
      { p_target_user_id: targetUserId },
    );
    const account = (detail as { account?: { email?: string; username?: string } } | null)?.account;
    if (!detailError && account?.email && account.username) {
      const delivery = await sendAccountApprovedEmail({
        to: account.email,
        username: account.username,
      });
      emailSent = delivery.sent;
    }
  }

  revalidatePath("/admin");
  return { ok: true, ...(decision === "APPROVED" ? { emailSent } : {}) };
}

export async function manageAdminAccount(
  targetUserId: string,
  status: "APPROVED" | "SUSPENDED",
  reason: string,
): Promise<AdminActionResult> {
  const validationError = validateTarget(targetUserId, reason);
  if (validationError) return { ok: false, error: validationError };
  if (status === "SUSPENDED" && !reason.trim()) return { ok: false, error: "Inserisci una motivazione per la sospensione." };

  const auth = await getAuthorizedAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };

  const { error } = await auth.supabase.rpc("admin_manage_user", {
    p_target_user_id: targetUserId,
    p_new_status: status,
    p_reason: reason.trim() || null,
  });

  if (error) return { ok: false, error: mapAdminError(error.message) };
  revalidatePath("/admin");
  return { ok: true };
}

export async function changeAdminUserRole(
  targetUserId: string,
  role: "USER" | "MODERATOR" | "ADMIN",
  reason: string,
): Promise<AdminActionResult> {
  const validationError = validateTarget(targetUserId, reason);
  if (validationError) return { ok: false, error: validationError };

  const auth = await getAuthorizedAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };

  const { error } = await auth.supabase.rpc("admin_change_user_role", {
    p_target_user_id: targetUserId,
    p_new_role: role,
    p_reason: reason.trim() || null,
  });

  if (error) return { ok: false, error: mapAdminError(error.message) };
  revalidatePath("/admin");
  return { ok: true };
}
