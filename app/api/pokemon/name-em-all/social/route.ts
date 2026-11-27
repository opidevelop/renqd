import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountAccess } from "@/lib/supabase/authorization";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, status } = await getAccountAccess(supabase);
  if (!user) return fail("Sessione scaduta. Accedi di nuovo.", 401);
  if (status !== "APPROVED") return fail("Account non ancora abilitato.", 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== "string") return fail("Richiesta non valida.");

  if (body.action === "block-user" || body.action === "unblock-user") {
    const targetId = body.targetUserId;
    if (typeof targetId !== "string" || !uuid.test(targetId) || targetId === user.id) return fail("Utente non valido.");
    if (body.action === "block-user") {
      const { error } = await supabase.from("user_blocks").upsert({ blocker_id: user.id, blocked_id: targetId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
      if (error) return fail(error.message, 500);
    } else {
      const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", targetId);
      if (error) return fail(error.message, 500);
    }
    return NextResponse.json({ ok: true });
  }

  const rankingId = body.rankingId;
  if (typeof rankingId !== "string" || !uuid.test(rankingId)) return fail("Risultato non valido.");
  if (body.action === "delete-comment") {
    const commentId = body.commentId;
    if (typeof commentId !== "string" || !uuid.test(commentId)) return fail("Commento non valido.");
    const { data: canView } = await supabase.rpc("renqd_pokemon_name_em_all_can_view", { p_ranking_id: rankingId });
    if (canView !== true) return fail("Risultato non disponibile.", 403);
    const { data: ranking } = await supabase.from("rankings").select("user_id").eq("id", rankingId).maybeSingle();
    let query = supabase.from("ranking_comments").update({ deleted_at: new Date().toISOString() })
      .eq("id", commentId).eq("ranking_id", rankingId).is("deleted_at", null);
    if (ranking?.user_id !== user.id) query = query.eq("author_id", user.id);
    const { data: comment, error } = await query.select("id").maybeSingle();
    if (error || !comment) return fail(error?.message ?? "Commento non eliminabile.", 403);
    return NextResponse.json({ ok: true });
  }

  const { data: canSocial, error: accessError } = await supabase.rpc("renqd_pokemon_name_em_all_can_social", { p_ranking_id: rankingId });
  if (accessError || canSocial !== true) return fail("Non hai i permessi per interagire con questo risultato.", 403);

  if (body.action === "toggle-like") {
    const { data: ranking } = await supabase.from("rankings").select("user_id").eq("id", rankingId).maybeSingle();
    if (ranking?.user_id === user.id) return fail("Non puoi mettere Mi piace al tuo risultato.", 403);
    const { data: existing, error: lookupError } = await supabase.from("ranking_likes").select("user_id").eq("ranking_id", rankingId).eq("user_id", user.id).maybeSingle();
    if (lookupError) return fail(lookupError.message, 500);
    if (existing) {
      const { error } = await supabase.from("ranking_likes").delete().eq("ranking_id", rankingId).eq("user_id", user.id);
      if (error) return fail(error.message, 500);
    } else {
      const { error } = await supabase.from("ranking_likes").insert({ ranking_id: rankingId, user_id: user.id });
      if (error) return fail(error.message, 500);
    }
    const { count, error } = await supabase.from("ranking_likes").select("user_id", { count: "exact", head: true }).eq("ranking_id", rankingId);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ liked: !existing, likeCount: count ?? 0 });
  }

  if (body.action === "add-comment") {
    const clean = typeof body.body === "string" ? body.body.trim() : "";
    if (!clean || clean.length > 4000) return fail("Il commento deve contenere da 1 a 4000 caratteri.");
    const parentId = body.parentCommentId ?? null;
    if (parentId !== null) {
      if (typeof parentId !== "string" || !uuid.test(parentId)) return fail("Risposta non valida.");
      const { data: parent, error } = await supabase.from("ranking_comments").select("id,parent_comment_id,ranking_id,deleted_at").eq("id", parentId).eq("ranking_id", rankingId).maybeSingle();
      if (error || !parent || parent.deleted_at || parent.parent_comment_id) return fail("Puoi rispondere soltanto a un commento principale.", 400);
    }
    const { data: comment, error } = await supabase.from("ranking_comments")
      .insert({ ranking_id: rankingId, author_id: user.id, parent_comment_id: parentId, body: clean })
      .select("id,body,created_at,edited_at,author_id,parent_comment_id").single();
    if (error || !comment) return fail(error?.message ?? "Impossibile pubblicare il commento.", 500);
    return NextResponse.json({ comment });
  }

  if (body.action === "update-comment") {
    const commentId = body.commentId;
    const clean = typeof body.body === "string" ? body.body.trim() : "";
    if (typeof commentId !== "string" || !uuid.test(commentId) || !clean || clean.length > 4000) return fail("Commento non valido.");
    const { data: comment, error } = await supabase.from("ranking_comments").update({ body: clean, edited_at: new Date().toISOString() })
      .eq("id", commentId).eq("ranking_id", rankingId).eq("author_id", user.id).is("deleted_at", null)
      .select("id,body,created_at,edited_at,author_id,parent_comment_id").maybeSingle();
    if (error || !comment) return fail(error?.message ?? "Commento non modificabile.", 403);
    return NextResponse.json({ comment });
  }

  if (body.action === "toggle-comment-like") {
    const commentId = body.commentId;
    if (typeof commentId !== "string" || !uuid.test(commentId)) return fail("Commento non valido.");
    const { data: existing, error: lookupError } = await supabase.from("ranking_comment_likes").select("user_id").eq("comment_id", commentId).eq("user_id", user.id).maybeSingle();
    if (lookupError) return fail(lookupError.message, 500);
    if (existing) {
      const { error } = await supabase.from("ranking_comment_likes").delete().eq("comment_id", commentId).eq("user_id", user.id);
      if (error) return fail(error.message, 500);
    } else {
      const { error } = await supabase.from("ranking_comment_likes").insert({ comment_id: commentId, user_id: user.id });
      if (error) return fail(error.message, 500);
    }
    const { count, error } = await supabase.from("ranking_comment_likes").select("user_id", { count: "exact", head: true }).eq("comment_id", commentId);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ liked: !existing, likeCount: count ?? 0 });
  }

  if (body.action === "report-comment") {
    const commentId = body.commentId;
    if (typeof commentId !== "string" || !uuid.test(commentId)) return fail("Commento non valido.");
    const reason = typeof body.reason === "string" ? body.reason : "OTHER";
    const details = typeof body.details === "string" ? body.details.slice(0, 2000) : null;
    const { data, error } = await supabase.rpc("renqd_pokemon_name_em_all_report_comment", {
      p_comment_id: commentId, p_reason: reason, p_details: details,
    });
    if (error) return fail(error.message, 400);
    return NextResponse.json({ reportId: data });
  }

  return fail("Azione non riconosciuta.");
}
