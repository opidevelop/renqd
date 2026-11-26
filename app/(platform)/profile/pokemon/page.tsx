import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Gamepad2, Sparkles, ShieldCheck, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PokemonProfileArchive } from "@/components/pokemon/profile-archive";
import { PokemonNameEmAllPreferences } from "@/components/pokemon/preferences";
import { getProfileMediaUrl } from "@/lib/supabase/profile-media";
import "../../pokemon.css";

export const dynamic = "force-dynamic";

export default async function PokemonProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: rankings }, { data: preferences }, { data: blockedRows }] = await Promise.all([
    supabase.from("public_profiles").select("username,display_name").eq("user_id",user.id).maybeSingle(),
    supabase.from("rankings").select("id,title,public_slug,mode,status,updated_at,settings")
      .eq("user_id",user.id).in("mode",["POKEMON_ULTIMATE_FAVOURITE","POKEMON_NAME_EM_ALL"])
      .is("deleted_at",null).order("updated_at",{ascending:false}).limit(500),
    supabase.from("pokemon_name_em_all_preferences").select("default_visibility,notify_likes,notify_comments,highest_level,highest_level_rank,best_performance_index,maestro_achieved_at").eq("user_id",user.id).maybeSingle(),
    supabase.rpc("renqd_list_blocked_users"),
  ]);
  const blockedUsers=await Promise.all((blockedRows??[]).map(async (row:{user_id:string;username:string;display_name:string;avatar_url:string|null})=>({
    userId:row.user_id,username:row.username,displayName:row.display_name||row.username,
    avatarUrl:await getProfileMediaUrl(supabase,row.avatar_url),
  })));
  const displayName = profile?.display_name || profile?.username || "Allenatore";
  const username = profile?.username || "allenatore";
  const referenceNow = new Date().getTime();
  return (
    <main className="pokemon-page pokemon-profile-page">
      <Link href="/profile" className="pokemon-back-link"><ArrowLeft size={15}/> Profilo Renqd</Link>
      <header className="pokemon-profile-hero">
        <div className="pokemon-profile-hero-copy">
          <span className="pokemon-profile-kicker"><Sparkles size={13}/> RENQD × POKÉMON · TRAINER PROFILE</span>
          <h1>Il tuo viaggio<br/><em>Pokémon.</em></h1>
          <p>Il tuo spazio personale, {displayName}. Raccogli i tuoi traguardi, ritrova le partite e gestisci la tua esperienza Pokémon su Renqd.</p>
          <div className="pokemon-profile-hero-meta">
            <span><ShieldCheck size={14}/> Profilo collegato</span>
            <span>@{username}</span>
          </div>
        </div>
        <div className="pokemon-profile-hero-art" aria-hidden="true">
          <span className="pokemon-profile-art-orbit"/>
          <img className="pokemon-profile-art-main" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png" alt=""/>
          <img className="pokemon-profile-art-secondary" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/700.png" alt=""/>
        </div>
      </header>
      <nav className="pokemon-profile-actions" aria-label="Azioni Pokémon">
        <Link href="/pokemon/ultimate-favourite"><span className="pokemon-profile-action-icon"><Gamepad2 size={20}/></span><span className="pokemon-profile-action-copy"><strong>Ultimate Favourite</strong><small>Modifica la tua matrice Pokémon</small></span><ArrowUpRight size={17}/></Link>
        <Link href="/pokemon/name-em-all"><span className="pokemon-profile-action-icon"><Trophy size={20}/></span><span className="pokemon-profile-action-copy"><strong>Name ’Em All</strong><small>Continua a scoprire il Pokédex</small></span><ArrowUpRight size={17}/></Link>
      </nav>
      <PokemonProfileArchive items={(rankings??[]) as Array<{id:string;title:string;public_slug:string|null;mode:string;status:string;updated_at:string;settings:Record<string,unknown>|null}>}
        referenceNow={referenceNow} persistentHighestLevel={preferences?.highest_level??null} maestroAchievedAt={preferences?.maestro_achieved_at??null}/>
      <PokemonNameEmAllPreferences defaultVisibility={(preferences?.default_visibility??"PUBLIC") as "PUBLIC"|"PRIVATE"}
        notifyLikes={preferences?.notify_likes??true} notifyComments={preferences?.notify_comments??true} blockedUsers={blockedUsers}/>
    </main>
  );
}
