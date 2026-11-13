import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileFollowButton } from "@/components/profile-follow-button";
import { ArrowLeft, ArrowUpRight, BadgeCheck, Folder, Globe2, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("public_profiles").select("*").eq("username", username).maybeSingle();
  if (!profile || (profile.is_private && profile.user_id !== user?.id)) notFound();
  const isOwner = profile.user_id === user?.id;
  const { data: collections } = await supabase.from("profile_collections").select("id,title,slug,description,banner_url,visibility,is_featured").eq("owner_id", profile.user_id).eq("visibility", "PUBLIC").order("is_featured", { ascending: false }).order("sort_order");
  const { data: rows } = await supabase.from("rankings").select("id,title,public_slug,mode,settings,completed_at").eq("user_id", profile.user_id).eq("status", "COMPLETED").order("completed_at", { ascending: false });
  const rankings = (rows ?? []).filter(item => Boolean((item.settings as Record<string, unknown> | null)?.savedAt));
  const { count: followerCount } = isOwner ? await supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", profile.user_id).eq("status", "ACCEPTED") : { count: null };
  return <main className="public-profile-page">
    <Link href="/home" className="public-profile-back"><ArrowLeft size={15}/> Renqd</Link>
    <section className="profile-cover public-profile-cover" style={profile.banner_url ? { backgroundImage: "linear-gradient(90deg,rgba(18,14,11,.8),rgba(18,14,11,.2)),url(" + profile.banner_url + ")" } : undefined}>
      <div className="profile-cover-copy"><span>PROFILO RENQD</span><h1>{profile.display_name || profile.username}</h1><p>@{profile.username}</p></div>
    </section>
    <section className="profile-overview public-profile-overview">
      <div className="profile-avatar-wrap">{profile.avatar_url ? <img src={profile.avatar_url} alt=""/> : <span>{(profile.display_name || profile.username).slice(0,1).toUpperCase()}</span>}</div>
      <div className="profile-overview-copy"><h2>{profile.display_name || profile.username}</h2><p>@{profile.username}{profile.location ? " · " + profile.location : ""}</p>{profile.bio && <div className="profile-bio">{profile.bio}</div>}{profile.website_url && <a href={profile.website_url} target="_blank" rel="noreferrer">{profile.website_url}</a>}</div>
      <div className="public-profile-action">{isOwner ? <Link href="/profile">Modifica profilo <ArrowUpRight size={15}/></Link> : <ProfileFollowButton targetUserId={profile.user_id} isPrivate={profile.is_private}/>}</div>
    </section>
    <div className="public-profile-stats"><span><strong>{rankings.length}</strong> Renq</span><span><strong>{(collections ?? []).length}</strong> Collezioni</span>{followerCount !== null && <span><strong>{followerCount ?? 0}</strong> Follower</span>}</div>
    <section className="profile-collections-section"><div className="profile-section-heading"><div><span>RACCOLTE PERSONALI</span><h2>Collezioni</h2></div><Folder size={20}/></div>
      {(collections ?? []).length ? <div className="profile-collection-grid">{(collections ?? []).map(collection => <Link href={"/collections/" + collection.slug} key={collection.id} className="profile-collection-card"><div className="profile-collection-art" style={collection.banner_url ? { backgroundImage: "linear-gradient(0deg,rgba(16,13,11,.72),rgba(16,13,11,.05)),url(" + collection.banner_url + ")" } : undefined}><span><Globe2 size={13}/> PUBBLICA</span><strong>{collection.title}</strong><small>{collection.description}</small></div></Link>)}</div> : <div className="profile-empty-state"><Folder size={23}/><strong>Nessuna collezione pubblica</strong></div>}
    </section>
    <section className="profile-renqs-section"><div className="profile-section-heading"><div><span>CLASSIFICHE PUBBLICATE</span><h2>I Renq di {profile.display_name || profile.username}</h2></div><Trophy size={20}/></div>
      {rankings.length ? <div className="profile-renq-grid">{rankings.map(ranking => { const settings = ranking.settings as Record<string, unknown>; const cover = typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : null; return <Link key={ranking.id} href={"/r/" + (ranking.public_slug || ranking.id)} className="profile-renq-card"><div style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(15,12,10,.75),rgba(15,12,10,.05)),url(" + cover + ")" } : undefined}><span>{String(ranking.mode).replaceAll("_"," ")}</span><ArrowUpRight size={17}/></div><strong>{ranking.title}</strong></Link>; })}</div> : <div className="profile-empty-state"><Trophy size={23}/><strong>Nessun Renq pubblico disponibile</strong></div>}
    </section>
    <div className="profile-public-footer"><BadgeCheck size={15}/> Creato con Renqd</div>
  </main>;
}
