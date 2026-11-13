import { createClient } from "@/lib/supabase/server";
import { ProfileDashboard } from "@/components/profile-dashboard";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";

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
  const { data: rows } = await supabase.from("rankings").select("id,title,public_slug,mode,settings,status,completed_at").eq("user_id", user.id).eq("status", "COMPLETED").order("completed_at", { ascending: false });
  const rankings = (rows ?? []).filter(item => Boolean((item.settings as Record<string, unknown> | null)?.savedAt));
  const { data: collections } = await supabase.from("profile_collections").select("id,title,slug,description,banner_url,visibility,is_featured").eq("owner_id", user.id).order("is_featured", { ascending: false }).order("sort_order").order("created_at", { ascending: false });
  const collectionIds = (collections ?? []).map(item => item.id);
  const { data: collectionItems } = collectionIds.length ? await supabase.from("profile_collection_items").select("collection_id,ranking_id").in("collection_id", collectionIds) : { data: [] };
  const enrichedCollections = (collections ?? []).map(item => ({ ...item, item_count: (collectionItems ?? []).filter(row => row.collection_id === item.id).length, item_ids: (collectionItems ?? []).filter(row => row.collection_id === item.id).map(row => row.ranking_id) }));
  const { count: followerCount } = await supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", user.id).eq("status", "ACCEPTED");
  const { count: followingCount } = await supabase.from("user_follows").select("followed_id", { count: "exact", head: true }).eq("follower_id", user.id).eq("status", "ACCEPTED");
  const { data: likedRows } = await supabase.from("ranking_likes").select("ranking_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(24);
  const likedIds = (likedRows ?? []).map(item => item.ranking_id);
  const { data: likedRankings } = likedIds.length ? await supabase.from("rankings").select("id,title,public_slug,mode,settings").in("id", likedIds).eq("status", "COMPLETED").eq("visibility", "LIVE").filter("settings->>access", "eq", "public") : { data: [] };
  const favorites = likedIds.flatMap(id => { const match = (likedRankings ?? []).find(item => item.id === id); return match ? [match] : []; });
  const rankingIds = rankings.map(item => item.id);
  const { count: likeCount } = rankingIds.length ? await supabase.from("ranking_likes").select("ranking_id", { count: "exact", head: true }).in("ranking_id", rankingIds) : { count: 0 };
  return <div className="profile-page">
    <div className="platform-page-heading"><div><span className="page-eyebrow">IL TUO SPAZIO</span><h1>Profilo</h1></div><form action={signOut}><button type="submit" className="profile-signout"><LogOut size={16}/> Esci</button></form></div>
    <ProfileDashboard profile={profile} collections={enrichedCollections} rankings={rankings} favorites={favorites} followerCount={followerCount ?? 0} followingCount={followingCount ?? 0} likeCount={likeCount ?? 0}/>
  </div>;
}
