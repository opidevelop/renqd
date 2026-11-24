import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Gamepad2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
      <section className="pokemon-profile-results">
        <div className="pokemon-section-heading"><div><span className="pokemon-page-eyebrow">IL TUO ARCHIVIO</span><h2>Le tue attività.</h2></div></div>
        {rankings?.length ? <div className="pokemon-profile-list">{rankings.map((item) => {
          const isUltimate = item.mode === "POKEMON_ULTIMATE_FAVOURITE";
          const completed = item.status === "COMPLETED";
          const href = completed ? "/r/" + (item.public_slug || item.id) : (isUltimate ? "/pokemon/ultimate-favourite" : "/pokemon/name-em-all");
          return <Link key={item.id} href={href} className="pokemon-profile-result">
            <span className="pokemon-profile-result-icon"><Gamepad2 size={17}/></span>
            <span><strong>{isUltimate ? "Ultimate Favourite" : "Name ’Em All"}</strong><small>{completed ? "Pubblicato" : "Bozza"} · Aggiornato il {new Date(item.updated_at).toLocaleDateString("it-IT")}</small></span>
            <ArrowUpRight size={16}/>
          </Link>;
        })}</div> : <div className="pokemon-profile-empty"><Gamepad2 size={22}/><strong>Il tuo spazio Pokémon è pronto</strong><p>Quando salverai la prima attività, la ritroverai qui insieme al tuo profilo Renqd.</p></div>}
      </section>
    </main>
  );
}
