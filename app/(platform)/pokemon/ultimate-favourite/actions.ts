"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FavouriteMatrix } from "@/lib/pokemon/catalog";

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function saveUltimateFavouriteAction(input: {
  rankingId: string | null; matrix: FavouriteMatrix; publish: boolean;
}) {
  if (!input || !input.matrix || typeof input.matrix !== "object" || typeof input.publish !== "boolean") {
    return { ok: false, error: "Dati della matrice non validi." };
  }
  if (Object.keys(input.matrix).length > 220) return { ok: false, error: "La matrice contiene troppe selezioni." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Devi accedere a Renqd." };
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("renqd_save_pokemon_ultimate_favourite", {
    p_ranking_id: input.rankingId, p_matrix: input.matrix, p_publish: input.publish,
  });
  if (error || !data || typeof data !== "object") return { ok: false, error: "Non è stato possibile salvare la matrice." };
  const result = data as { rankingId?: string; publicSlug?: string; published?: boolean };
  if (!result.rankingId) return { ok: false, error: "Risposta di salvataggio non valida." };
  revalidatePath("/pokemon"); revalidatePath("/pokemon/ultimate-favourite"); revalidatePath("/rankings");
  if (result.publicSlug) revalidatePath("/r/" + result.publicSlug);
  return { ok: true, rankingId: result.rankingId, publicSlug: result.publicSlug ?? null, published: Boolean(result.published) };
}
