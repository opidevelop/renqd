"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{
    data: unknown; error: { message: string } | null;
  }>;
};

async function getRpcClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, client: null as RpcClient | null };
  return { user, client: supabase as unknown as RpcClient };
}

export async function createNameEmAllSoloAction(config: Record<string, unknown>) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_create_solo", { p_config: config });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Non è stato possibile avviare la partita." };
  revalidatePath("/pokemon/name-em-all");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function submitNameEmAllAnswerAction(sessionId: string, answer: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_submit_answer", {
    p_session_id: sessionId, p_answer: answer,
  });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Risposta non registrata." };
  return { ok: true, data: data as Record<string, unknown> };
}

export async function hintNameEmAllAction(sessionId: string, speciesId: number) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_hint", {
    p_session_id: sessionId, p_species_id: speciesId,
  });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Aiuto non disponibile." };
  return { ok: true, data: data as Record<string, unknown> };
}

export async function pauseNameEmAllAction(sessionId: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_pause", { p_session_id: sessionId });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Pausa non disponibile." };
  revalidatePath("/pokemon/name-em-all");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function resumeNameEmAllAction(sessionId: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_resume", { p_session_id: sessionId });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Ripresa non disponibile." };
  revalidatePath("/pokemon/name-em-all");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function finishNameEmAllAction(sessionId: string, reason: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_finish", {
    p_session_id: sessionId, p_reason: reason,
  });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Risultato non salvato." };
  revalidatePath("/pokemon/name-em-all"); revalidatePath("/profile"); revalidatePath("/profile/pokemon"); revalidatePath("/rankings");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function setNameEmAllDefaultVisibilityAction(visibility: "PUBLIC" | "PRIVATE") {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { error } = await client.rpc("renqd_pokemon_name_em_all_set_default_visibility", { p_visibility: visibility });
  if (error) return { ok: false, error: "Impostazione privacy non aggiornata." };
  return { ok: true };
}

export async function setNameEmAllResultVisibilityAction(sessionId: string, visibility: "PUBLIC" | "PRIVATE") {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { error } = await client.rpc("renqd_pokemon_name_em_all_set_result_visibility", {
    p_session_id: sessionId, p_visibility: visibility,
  });
  if (error) return { ok: false, error: "Visibilità del risultato non aggiornata." };
  revalidatePath("/profile/pokemon");
  return { ok: true };
}


export async function createNameEmAllMultiplayerAction(config: Record<string, unknown>, gameMode: "COLLABORATIVE" | "INDIVIDUAL") {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_create_multiplayer", {
    p_config: config, p_game_mode: gameMode,
  });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Non è stato possibile creare la lobby." };
  revalidatePath("/pokemon/name-em-all");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function submitNameEmAllMultiplayerAnswerAction(sessionId: string, answer: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_submit_multiplayer_answer", {
    p_session_id: sessionId, p_answer: answer,
  });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Risposta non registrata." };
  return { ok: true, data: data as Record<string, unknown> };
}

export async function hintNameEmAllMultiplayerAction(sessionId: string, speciesId: number) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_hint_multiplayer", {
    p_session_id: sessionId, p_species_id: speciesId,
  });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Suggerimento non disponibile." };
  return { ok: true, data: data as Record<string, unknown> };
}

export async function finishNameEmAllMultiplayerAction(sessionId: string, reason: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_finish_multiplayer", {
    p_session_id: sessionId, p_reason: reason,
  });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Non è stato possibile salvare il risultato." };
  revalidatePath("/pokemon/name-em-all");
  revalidatePath("/profile/pokemon");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function inviteNameEmAllUsersAction(sessionId: string, usernames: string[]) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const clean = usernames.map(value => value.trim().replace(/^@/, "")).filter(Boolean).slice(0, 7);
  if (!clean.length) return { ok: false, error: "Inserisci almeno uno username." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_invite_users", {
    p_session_id: sessionId, p_usernames: clean,
  });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Non è stato possibile inviare gli inviti." };
  revalidatePath("/pokemon/name-em-all");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function createNameEmAllInviteLinkAction(sessionId: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await client.rpc("renqd_pokemon_name_em_all_create_invite_link", {
    p_session_id: sessionId, p_token_hash: tokenHash, p_expires_at: null,
  });
  if (error) return { ok: false, error: error.message };
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://renqd.app";
  return { ok: true, url: new URL("/pokemon/name-em-all/join?token=" + token, base).toString() };
}

export async function joinNameEmAllByTokenAction(token: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  if (!/^[a-f0-9]{64}$/i.test(token)) return { ok: false, error: "Link di invito non valido." };
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_join_by_token", { p_token_hash: tokenHash });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Non è stato possibile entrare nella partita." };
  revalidatePath("/pokemon/name-em-all");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function respondNameEmAllInviteAction(inviteId: string, accept: boolean) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_respond_invite", {
    p_invite_id: inviteId, p_accept: accept,
  });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Invito non disponibile." };
  revalidatePath("/pokemon/name-em-all");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function setNameEmAllReadyAction(sessionId: string, ready: boolean) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_set_ready", {
    p_session_id: sessionId, p_ready: ready,
  });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Non è stato possibile aggiornare la disponibilità." };
  return { ok: true, data: data as Record<string, unknown> };
}

export async function startNameEmAllMultiplayerAction(sessionId: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_start_multiplayer", { p_session_id: sessionId });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Non è stato possibile avviare la partita." };
  revalidatePath("/pokemon/name-em-all");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function heartbeatNameEmAllAction(sessionId: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_heartbeat", { p_session_id: sessionId });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Connessione alla partita interrotta." };
  return { ok: true, data: data as Record<string, unknown> };
}

export async function leaveNameEmAllAction(sessionId: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_leave", { p_session_id: sessionId });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Non è stato possibile uscire dalla partita." };
  revalidatePath("/pokemon/name-em-all");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function expelNameEmAllParticipantAction(sessionId: string, userId: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_expel", { p_session_id: sessionId, p_user_id: userId });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Non è stato possibile espellere il partecipante." };
  return { ok: true, data: data as Record<string, unknown> };
}

export async function updateNameEmAllLobbyConfigAction(sessionId: string, config: Record<string, unknown>) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_update_lobby_config", { p_session_id: sessionId, p_config: config });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Non è stato possibile aggiornare la configurazione." };
  revalidatePath("/pokemon/name-em-all");
  return { ok: true, data: data as Record<string, unknown> };
}

export async function removeNameEmAllLobbyParticipantAction(sessionId: string, userId: string) {
  const { user, client } = await getRpcClient();
  if (!user || !client) return { ok: false, error: "Devi accedere a Renqd." };
  const { data, error } = await client.rpc("renqd_pokemon_name_em_all_remove_from_lobby", { p_session_id: sessionId, p_user_id: userId });
  if (error || !data || typeof data !== "object") return { ok: false, error: error?.message ?? "Non è stato possibile rimuovere il partecipante." };
  revalidatePath("/pokemon/name-em-all");
  return { ok: true, data: data as Record<string, unknown> };
}
