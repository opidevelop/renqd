import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Gamepad2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PokemonProfileArchive } from "@/components/pokemon/profile-archive";
import "../../pokemon.css";

export const dynamic = "force-dynamic";

export default async function PokemonProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: rankings }] = await Promise.all([
    supabase.from("public_profiles").select("username,display_name").eq("user_id",user.id).maybeSingle(),
    supabase.from("rankings").select("id,title,public_slug,mode,status,updated_at,settings")
      .eq("user_id",user.id).in("mode",["POKEMON_ULTIMATE_FAVOURITE","POKEMON_NAME_EM_ALL"])
      .is("deleted_at",null).order("updated_at",{ascending:false}).limit(100),
  ]);
  const displayName = profile?.display_name || profile?.username || "Allenatore";
  const referenceNow = new Date().getTime();
  return (
    <main className="pokemon-page pokemon-profile-page">
      <Link href="/profile" className="pokemon-back-link"><ArrowLeft size={15}/> Profilo Renqd</Link>
      <header className="pokemon-favourite-heading">
        <div><span className="pokemon-page-eyebrow">RENQD × POKÉMON · PROFILO</span><h1>Il mio spazio Pokémon</h1>
          <p>Le tue attività Pokémon sono collegate al profilo Renqd di {displayName}. Non esiste un account separato.</p></div>
        <Gamepad2 size={28}/>
      </header>
      <div className="pokemon-profile-actions">
        <Link href="/pokemon/ultimate-favourite"><span>Ultimate Favourite</span><small>Modifica la tua matrice</small><ArrowUpRight size={17}/></Link>
        <Link href="/pokemon/name-em-all"><span>Name ’Em All</span><small>Apri la modalità di gioco</small><ArrowUpRight size={17}/></Link>
      </div>
      <PokemonProfileArchive items={(rankings??[]) as Array<{id:string;title:string;public_slug:string|null;mode:string;status:string;updated_at:string;settings:Record<string,unknown>|null}>} referenceNow={referenceNow}/>

    </main>
  );
}
