import { createClient } from "@/lib/supabase/server";
import { DailyPokemonGame } from "@/components/pokemon/daily-game";
import "../../pokemon.css";

export const dynamic = "force-dynamic";

function romeDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return value.year + "-" + value.month + "-" + value.day;
}

export default async function ConnectionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user ? await supabase.from("pokemon_daily_completions")
    .select("completed_at").eq("user_id", user.id).eq("game_mode", "CONNECTIONS")
    .eq("challenge_date", romeDate()).maybeSingle() : { data: null };
  return <DailyPokemonGame title="Connections" description="La sfida quotidiana originale di Pokennection." url="https://pokennection.com/" completed={Boolean(data)} />;
}
