"use server";

import { revalidatePath } from "next/cache";
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
