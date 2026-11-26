import { createClient } from "@/lib/supabase/server";
import { PokemonHub } from "@/components/pokemon/hub";
import "../pokemon.css";

export const dynamic = "force-dynamic";

function romeDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return value.year + "-" + value.month + "-" + value.day;
}

export default async function PokemonHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user ? await supabase.from("pokemon_daily_completions")
    .select("game_mode").eq("user_id", user.id).eq("challenge_date", romeDate())
    .in("game_mode", ["DOKU", "CONNECTIONS", "DAILY_RED"]) : { data: [] };
  const completed = new Set((data ?? []).map((row) => row.game_mode));
  return <PokemonHub dokuCompleted={completed.has("DOKU")} connectionsCompleted={completed.has("CONNECTIONS")} dailyRedCompleted={completed.has("DAILY_RED")} />;
}
