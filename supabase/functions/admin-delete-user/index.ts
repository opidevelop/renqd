/* eslint-disable @typescript-eslint/no-explicit-any */
import { withSupabase } from "npm:@supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

async function listUserObjectPaths(
  supabaseAdmin: any,
  bucketId: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseAdmin.storage.from(bucketId).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error("Impossibile leggere i file personali dal bucket " + bucketId + ".");

    const entries = data ?? [];
    for (const entry of entries) {
      const path = prefix + "/" + entry.name;
      if (entry.id || entry.metadata) {
        paths.push(path);
      } else {
        paths.push(...await listUserObjectPaths(supabaseAdmin, bucketId, path));
      }
    }

    if (entries.length < 1000) break;
    offset += entries.length;
  }

  return paths;
}

async function removeUserStorageObjects(supabaseAdmin: any, userId: string) {
  const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
  if (bucketsError) throw new Error("Impossibile verificare i file associati all'account.");

  for (const bucket of buckets ?? []) {
    const paths = await listUserObjectPaths(supabaseAdmin, bucket.id, userId);
    for (let index = 0; index < paths.length; index += 1000) {
      const batch = paths.slice(index, index + 1000);
      const { error } = await supabaseAdmin.storage.from(bucket.id).remove(batch);
      if (error) throw new Error("Non è stato possibile eliminare tutti i file personali. Riprova l'operazione.");
    }
  }
}

async function getRankingIds(supabaseAdmin: any, userId: string): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("rankings")
      .select("id")
      .eq("user_id", userId)
      .range(offset, offset + 999);
    if (error) throw new Error("Impossibile verificare le classifiche associate all'account.");
    const rows = data ?? [];
    ids.push(...rows.map((row: { id: string }) => row.id));
    if (rows.length < 1000) break;
    offset += rows.length;
  }
  return ids;
}

async function detachOwnedCustomItems(supabaseAdmin: any, userId: string) {
  const ids: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("custom_items")
      .select("id")
      .eq("owner_id", userId)
      .range(offset, offset + 999);
    if (error) throw new Error("Impossibile verificare gli elementi personalizzati dell'account.");

    const rows = data ?? [];
    ids.push(...rows.map((row: { id: string }) => row.id));
    if (rows.length < 1000) break;
    offset += rows.length;
  }

  // ranking_items keeps title_snapshot, so detach references before the owner's custom_items cascade.
  // This avoids the RESTRICT foreign key blocking deletion when another user's Renq reuses the item.
  for (let index = 0; index < ids.length; index += 500) {
    const batch = ids.slice(index, index + 500);
    const { error } = await supabaseAdmin
      .from("ranking_items")
      .update({ custom_item_id: null })
      .in("custom_item_id", batch);
    if (error) throw new Error("Non è stato possibile preservare gli elementi riutilizzati da altri Renq.");
  }
}

async function anonymizeUserAuditData(supabaseAdmin: any, userId: string) {
  const operations = [
    supabaseAdmin.from("role_audit_logs")
      .update({ reason: null })
      .or("actor_id.eq." + userId + ",target_user_id.eq." + userId),
    supabaseAdmin.from("ranking_activity")
      .update({ payload: {} })
      .eq("actor_id", userId),
    supabaseAdmin.from("ranking_revisions")
      .update({ change_summary: null })
      .eq("actor_id", userId),
    supabaseAdmin.from("user_notifications")
      .update({ payload: {} })
      .eq("actor_id", userId),
    supabaseAdmin.from("ranking_moderation_audit_logs")
      .update({
        ranking_owner_id: null,
        ranking_id: null,
        ranking_title: "Renq eliminato",
        previous_state: {},
        new_state: {},
        reason: null,
      })
      .eq("ranking_owner_id", userId),
    supabaseAdmin.from("ranking_moderation_audit_logs")
      .update({ actor_id: null, reason: null })
      .eq("actor_id", userId),
  ];

  for (const operation of operations) {
    const { error } = await operation;
    if (error) throw new Error("Non è stato possibile anonimizzare lo storico amministrativo dell'account.");
  }
}

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return fail("Metodo non consentito.", 405);

    const actorId = ctx.userClaims?.id;
    if (!actorId) return fail("Sessione non valida. Accedi di nuovo.", 401);

    let body: { targetUserId?: unknown; confirmation?: unknown };
    try {
      body = await req.json();
    } catch {
      return fail("Richiesta non valida.");
    }

    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
    const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
    if (!UUID_PATTERN.test(targetUserId)) return fail("Account non valido.");
    if (!confirmation || confirmation.length > 30) return fail("Conferma non valida.");
    if (targetUserId === actorId) return fail("Non puoi eliminare il tuo stesso account.", 403);

    const supabaseAdmin = ctx.supabaseAdmin;
    const { data: actor, error: actorError } = await supabaseAdmin
      .from("profiles")
      .select("role,status")
      .eq("id", actorId)
      .maybeSingle();

    if (actorError || !actor || actor.role !== "OWNER" || actor.status !== "APPROVED") {
      return fail("Solo un OWNER approvato può eliminare definitivamente gli account.", 403);
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id,email,username,role,status")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetError) return fail("Impossibile verificare l'account da eliminare.", 500);
    if (!target) return fail("Account non trovato.", 404);
    if (confirmation.toLocaleLowerCase("it-IT") !== String(target.username).trim().toLocaleLowerCase("it-IT")) {
      return fail("Il nome utente digitato non corrisponde. Controlla e riprova.");
    }

    const lockToken = crypto.randomUUID();
    const { data: claimData, error: claimError } = await supabaseAdmin.rpc(
      "renqd_claim_admin_account_deletion",
      {
        p_actor_id: actorId,
        p_target_user_id: targetUserId,
        p_lock_token: lockToken,
      },
    );

    if (claimError) {
      return fail("Impossibile verificare la protezione dell'ultimo OWNER.", 500);
    }

    const claim = claimData as { ok?: boolean; error_code?: string } | null;
    if (!claim?.ok) {
      const errorCode = claim?.error_code;
      const message =
        errorCode === "last_owner"
          ? "Non è possibile eliminare l'ultimo OWNER attivo."
          : errorCode === "deletion_in_progress"
            ? "È già in corso un'altra eliminazione account. Riprova tra poco."
            : errorCode === "forbidden"
              ? "Solo un OWNER approvato può eliminare definitivamente gli account."
              : errorCode === "self_delete"
                ? "Non puoi eliminare il tuo stesso account."
                : errorCode === "target_not_found"
                  ? "Account non trovato."
                  : "Non è stato possibile autorizzare l'eliminazione.";
      const status =
        errorCode === "deletion_in_progress" ? 409
          : errorCode === "target_not_found" ? 404
            : errorCode === "forbidden" || errorCode === "self_delete" || errorCode === "last_owner" ? 403
              : 400;
      return fail(message, status);
    }

    try {
      const rankingIds = await getRankingIds(supabaseAdmin, targetUserId);

      // Storage objects are removed through the Storage API, never by deleting storage.objects rows.
      await removeUserStorageObjects(supabaseAdmin, targetUserId);
      await detachOwnedCustomItems(supabaseAdmin, targetUserId);

      // Remove reports whose target is one of the deleted user's Renq.
      for (let index = 0; index < rankingIds.length; index += 500) {
        const batch = rankingIds.slice(index, index + 500);
        const { error } = await supabaseAdmin
          .from("content_reports")
          .delete()
          .eq("target_type", "RANKING")
          .in("target_id", batch);
        if (error) throw new Error("Non è stato possibile rimuovere le segnalazioni associate ai Renq dell'account.");
      }

      // Invitations sent to this email are personal data even before an account is linked.
      if (target.email) {
        const { error } = await supabaseAdmin
          .from("ranking_participants")
          .delete()
          .eq("invited_email", target.email);
        if (error) throw new Error("Non è stato possibile rimuovere gli inviti associati all'account.");
      }

      await anonymizeUserAuditData(supabaseAdmin, targetUserId);

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      if (deleteError) throw new Error("Supabase Auth non ha completato l'eliminazione dell'account. I file rimossi e l'anonimizzazione possono essere ripetuti in sicurezza.");

      const { error: auditInsertError } = await supabaseAdmin.from("role_audit_logs").insert({
        actor_id: actorId,
        target_user_id: null,
        action: "ACCOUNT_DELETED",
        old_value: target.role,
        new_value: null,
        reason: null,
      });

      return Response.json({ ok: true, auditLogged: !auditInsertError });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Eliminazione non completata. Riprova.";
      return fail(message, 500);
    } finally {
      const { error: releaseError } = await supabaseAdmin.rpc(
        "renqd_release_admin_account_deletion",
        { p_lock_token: lockToken },
      );
      if (releaseError) {
        console.error("Renqd account deletion lock could not be released; the lease will expire automatically.");
      }
    }
  });

export default { fetch: handler };
