import { createClient } from "@/lib/supabase/server";
import { NameEmAllExperience } from "@/components/pokemon/name-em-all";
import "../../pokemon.css";

export const dynamic = "force-dynamic";

export default async function NameEmAllPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: activeSession } = user ? await supabase.from("pokemon_name_em_all_sessions")
    .select("id,ranking_id,game_mode,status,config,catalog_species_ids,special_species_ids,duration_seconds,started_at,deadline_at,paused_at,remaining_seconds,paused_total_seconds")
    .eq("owner_id",user.id).in("status",["ACTIVE","PAUSED"])
    .order("created_at",{ascending:false}).limit(1).maybeSingle() : { data: null };
  const { data: discoveries } = user && activeSession ? await supabase.from("pokemon_name_em_all_discoveries")
    .select("species_id").eq("session_id",activeSession.id).eq("user_id",user.id) : { data: [] };
  const { data: latestResult } = user && !activeSession ? await supabase.from("pokemon_name_em_all_results")
    .select("result_snapshot").eq("user_id",user.id).is("deleted_at",null)
    .order("created_at",{ascending:false}).limit(1).maybeSingle() : { data: null };
  return (
    <main className="pokemon-page pokemon-name-em-all">
      <NameEmAllExperience
        activeSession={activeSession ?? null}
        initialDiscoveries={(discoveries ?? []).map((row) => row.species_id)}
        latestResult={(latestResult?.result_snapshot as Record<string,unknown> | undefined) ?? null}
      />
    </main>
  );
}
