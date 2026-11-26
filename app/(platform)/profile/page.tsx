import { createClient } from "@/lib/supabase/server";
import { ProfileDashboard } from "@/components/profile-dashboard";
import { getProfileMediaUrl } from "@/lib/supabase/profile-media";
import { PokemonProfileArchive } from "@/components/pokemon/profile-archive";
import { PokemonNameEmAllPreferences } from "@/components/pokemon/preferences";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: account } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  if (!account?.username) return null;
  let { data: profile } = await supabase.from("public_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    const { data: created } = await supabase.from("public_profiles").insert({ user_id: user.id, username: account.username, display_name: account.username }).select("*").single();
    profile = created;
  }
  if (!profile) return <div className="profile-page"><h1>Profilo non disponibile</h1><p>Riprova tra qualche istante.</p></div>;
  const [{ data: pokemonRankings }, { data: pokemonPreferences }, { data: blockedRows }] = await Promise.all([
    supabase.from("rankings").select("id,title,public_slug,mode,status,updated_at,settings")
      .eq("user_id",user.id).in("mode",["POKEMON_ULTIMATE_FAVOURITE","POKEMON_NAME_EM_ALL"])
      .is("deleted_at",null).order("updated_at",{ascending:false}).limit(500),
    supabase.from("pokemon_name_em_all_preferences").select("default_visibility,notify_likes,notify_comments,highest_level,maestro_achieved_at").eq("user_id",user.id).maybeSingle(),
    supabase.rpc("renqd_list_blocked_users"),
  ]);
  const blockedUsers = await Promise.all((blockedRows??[]).map(async (row:{user_id:string;username:string;display_name:string;avatar_url:string|null})=>({
    userId:row.user_id,username:row.username,displayName:row.display_name||row.username,
    avatarUrl:await getProfileMediaUrl(supabase,row.avatar_url),
  })));
  const pokemonSection = <>
    <PokemonProfileArchive items={(pokemonRankings??[]) as Array<{id:string;title:string;public_slug:string|null;mode:string;status:string;updated_at:string;settings:Record<string,unknown>|null}>}
      referenceNow={0} persistentHighestLevel={pokemonPreferences?.highest_level??null} maestroAchievedAt={pokemonPreferences?.maestro_achieved_at??null}/>
    <PokemonNameEmAllPreferences defaultVisibility={(pokemonPreferences?.default_visibility??"PUBLIC") as "PUBLIC"|"PRIVATE"}
      notifyLikes={pokemonPreferences?.notify_likes??true} notifyComments={pokemonPreferences?.notify_comments??true} blockedUsers={blockedUsers}/>
  </>;
  const profileForUi = {
    ...profile,
    avatar_display_url: await getProfileMediaUrl(supabase, profile.avatar_url),
    banner_display_url: await getProfileMediaUrl(supabase, profile.banner_url),
  };
  const { data: rows } = await supabase.from("rankings").select("id,title,public_slug,mode,settings,status,completed_at").eq("user_id", user.id).eq("status", "COMPLETED").is("deleted_at",null).order("completed_at", { ascending: false });
  const rankings = (rows ?? []).filter(item => item.mode !== "POKEMON_ULTIMATE_FAVOURITE" && item.mode !== "POKEMON_NAME_EM_ALL" && Boolean((item.settings as Record<string, unknown> | null)?.savedAt));
  const { data: collections } = await supabase.from("profile_collections").select("id,title,slug,description,banner_url,visibility,is_featured,sort_order").eq("owner_id", user.id).order("is_featured", { ascending: false }).order("sort_order").order("created_at", { ascending: false });
  const collectionIds = (collections ?? []).map(item => item.id);
  const { data: collectionItems } = collectionIds.length ? await supabase.from("profile_collection_items").select("collection_id,ranking_id,position,rankings!inner(deleted_at)").in("collection_id", collectionIds).is("rankings.deleted_at",null).order("position", { ascending: true }) : { data: [] };
  const collectionRankingIds = [...new Set((collectionItems ?? []).map(row => row.ranking_id))];
  const { data: collectionRankings } = collectionRankingIds.length
    ? await supabase.from("rankings").select("id,title,public_slug").in("id", collectionRankingIds)
    : { data: [] };
  const enrichedCollections = await Promise.all((collections ?? []).map(async item => {
    const links = (collectionItems ?? []).filter(row => row.collection_id === item.id).sort((a,b) => a.position - b.position);
    return {
      ...item,
      banner_display_url: await getProfileMediaUrl(supabase, item.banner_url),
      item_count: links.length,
      item_ids: links.map(row => row.ranking_id),
      item_titles: links.map(row => {
        const ranking = (collectionRankings ?? []).find(value => value.id === row.ranking_id);
        return { id: row.ranking_id, title: ranking?.title ?? "Renq", public_slug: ranking?.public_slug ?? row.ranking_id };
      }),
    };
  }));
  const { count: followerCount } = await supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", user.id).eq("status", "ACCEPTED");
  const { count: followingCount } = await supabase.from("user_follows").select("followed_id", { count: "exact", head: true }).eq("follower_id", user.id).eq("status", "ACCEPTED");
  const [{ data: followerRelations }, { data: followingRelations }] = await Promise.all([
    supabase.from("user_follows").select("follower_id,created_at").eq("followed_id", user.id).eq("status", "ACCEPTED").order("created_at", { ascending: false }).limit(100),
    supabase.from("user_follows").select("followed_id,created_at").eq("follower_id", user.id).eq("status", "ACCEPTED").order("created_at", { ascending: false }).limit(100),
  ]);
  const followProfileIds = [...new Set([...(followerRelations ?? []).map(row => row.follower_id), ...(followingRelations ?? []).map(row => row.followed_id)])];
  const { data: followProfiles } = followProfileIds.length
    ? await supabase.from("public_profiles").select("user_id,username,display_name,avatar_url").in("user_id", followProfileIds)
    : { data: [] };
  const followProfileEntries = await Promise.all((followProfiles ?? []).map(async item => ({
    userId: item.user_id,
    username: item.username,
    displayName: item.display_name || item.username,
    avatarUrl: await getProfileMediaUrl(supabase, item.avatar_url),
  })));
  const mapFollowEntries = (ids: string[]) => ids.map(id => followProfileEntries.find(item => item.userId === id) ?? ({
    userId: id, username: null, displayName: "Profilo privato", avatarUrl: null,
  }));
  const { data: likedRows } = await supabase.from("ranking_likes").select("ranking_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(24);
  const likedIds = (likedRows ?? []).map(item => item.ranking_id);
  const { data: likedRankings } = likedIds.length ? await supabase.from("rankings").select("id,title,public_slug,mode,settings").in("id", likedIds).eq("status", "COMPLETED").eq("visibility", "LIVE").is("deleted_at",null).not("mode","in","(POKEMON_ULTIMATE_FAVOURITE,POKEMON_NAME_EM_ALL)").filter("settings->>access", "eq", "public") : { data: [] };
  const favorites = likedIds.flatMap(id => { const match = (likedRankings ?? []).find(item => item.id === id); return match ? [match] : []; });
  const rankingIds = rankings.map(item => item.id);
  const { count: likeCount } = rankingIds.length ? await supabase.from("ranking_likes").select("ranking_id", { count: "exact", head: true }).in("ranking_id", rankingIds) : { count: 0 };
  const followerProfiles = mapFollowEntries((followerRelations ?? []).map(row => row.follower_id));
  const followingProfiles = mapFollowEntries((followingRelations ?? []).map(row => row.followed_id));
  return <div className="profile-page">
    <ProfileDashboard profile={profileForUi} collections={enrichedCollections} rankings={rankings} favorites={favorites} followerCount={followerCount ?? 0} followingCount={followingCount ?? 0} followerProfiles={followerProfiles} followingProfiles={followingProfiles} likeCount={likeCount ?? 0} pokemonSection={pokemonSection}/>
  </div>;
}
