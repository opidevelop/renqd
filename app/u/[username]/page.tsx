import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedUser } from "@/lib/supabase/authorization";
import { ProfileFollowButton } from "@/components/profile-follow-button";
import { MessageRequestButton } from "@/components/message-request-button";
import { UserBlockButton } from "@/components/user-block-button";
import { PublicProfileTabs } from "@/components/public-profile-tabs";
import { PokemonProfileArchive } from "@/components/pokemon/profile-archive";
import { getProfileMediaUrl } from "@/lib/supabase/profile-media";
import { ArrowLeft, ArrowUpRight, BadgeCheck, Folder, Globe2, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { supabase, user } = await requireApprovedUser();
  const { data: profile } = await supabase.from("public_profiles").select("*").eq("username", username).maybeSingle();
  if (!profile) notFound();
  const isOwner = profile.user_id === user?.id;
  if(!isOwner){
    const {data:isBlocked}=await supabase.rpc("renqd_is_user_blocked",{p_other_user_id:profile.user_id});
    if(isBlocked===true)notFound();
  }
  const sortedPair = [user.id, profile.user_id].sort();
  const { data: existingConversation } = !isOwner ? await supabase.from("direct_conversations").select("id").eq("participant_one_id", sortedPair[0]).eq("participant_two_id", sortedPair[1]).maybeSingle() : { data: null };
  if (profile.is_private && !isOwner) {
    const { data: acceptedFollow } = await supabase
      .from("user_follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("followed_id", profile.user_id)
      .eq("status", "ACCEPTED")
      .maybeSingle();
    if (!acceptedFollow) notFound();
  }
  const mediaSettings=(profile as unknown as {media_settings?:{avatar?:{x?:number;y?:number;zoom?:number};banner?:{x?:number;y?:number;zoom?:number}}}).media_settings??{};
  const avatarCrop={x:Math.max(0,Math.min(100,Number(mediaSettings.avatar?.x??50))),y:Math.max(0,Math.min(100,Number(mediaSettings.avatar?.y??50))),zoom:Math.max(100,Math.min(200,Number(mediaSettings.avatar?.zoom??100)))};
  const bannerCrop={x:Math.max(0,Math.min(100,Number(mediaSettings.banner?.x??50))),y:Math.max(0,Math.min(100,Number(mediaSettings.banner?.y??50))),zoom:Math.max(100,Math.min(200,Number(mediaSettings.banner?.zoom??100)))};
  const [profileAvatarUrl, profileBannerUrl] = await Promise.all([
    getProfileMediaUrl(supabase, profile.avatar_url),
    getProfileMediaUrl(supabase, profile.banner_url),
  ]);
  const { data: collections } = await supabase.from("profile_collections").select("id,title,slug,description,banner_url,visibility,is_featured").eq("owner_id", profile.user_id).eq("visibility", "PUBLIC").order("is_featured", { ascending: false }).order("sort_order");
  const { data: rows } = await supabase.from("rankings").select("id,title,public_slug,mode,settings,completed_at,visibility,status,updated_at").eq("user_id", profile.user_id).eq("status", "COMPLETED").is("deleted_at",null).order("completed_at", { ascending: false });
  const rankings = (rows ?? []).filter(item => {
    const settings=(item.settings as Record<string,unknown>|null)??{};
    return Boolean(settings.savedAt) && (isOwner || (item.visibility==="LIVE" && settings.access!=="private"));
  });
  const pokemonRows=(rows??[]).filter(item=>["POKEMON_ULTIMATE_FAVOURITE","POKEMON_NAME_EM_ALL"].includes(item.mode));
  const pokemonItems=await Promise.all(pokemonRows.map(async item=>{
    const settings=(item.settings as Record<string,unknown>|null)??{};
    const visible=isOwner||(item.visibility==="LIVE"&&settings.access!=="private"&&Boolean(settings.savedAt));
    if(!visible)return null;
    if(item.mode==="POKEMON_NAME_EM_ALL"){
      const {data:canView}=await supabase.rpc("renqd_pokemon_name_em_all_can_view",{p_ranking_id:item.id});
      if(!canView)return null;
    }
    return item;
  }));
  const visiblePokemonItems=pokemonItems.filter(Boolean) as NonNullable<typeof pokemonItems[number]>[];
  const visibleCollections = await Promise.all((collections ?? []).map(async collection => ({
    ...collection,
    banner_display_url: await getProfileMediaUrl(supabase, collection.banner_url),
  })));
  const { count: followerCount } = isOwner ? await supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", profile.user_id).eq("status", "ACCEPTED") : { count: null };
  return <main className="public-profile-page">
    <Link href="/home" className="public-profile-back"><ArrowLeft size={15}/> Renqd</Link>
    <section className="profile-cover public-profile-cover" style={profileBannerUrl ? { backgroundImage: "linear-gradient(90deg,rgba(18,14,11,.8),rgba(18,14,11,.2)),url(" + profileBannerUrl + ")", backgroundPosition: bannerCrop.x + "% " + bannerCrop.y + "%", backgroundSize: bannerCrop.zoom === 100 ? "cover" : bannerCrop.zoom + "% auto" } : undefined}>
      <div className="profile-cover-copy"><span>PROFILO RENQD</span><h1>{profile.display_name || profile.username}</h1><p>@{profile.username}</p></div>
    </section>
    <section className="profile-overview public-profile-overview">
      <div className="profile-avatar-wrap">{profileAvatarUrl ? <img src={profileAvatarUrl} alt="" style={{objectPosition:avatarCrop.x+"% "+avatarCrop.y+"%",transform:"scale("+avatarCrop.zoom/100+")"}}/> : <span>{(profile.display_name || profile.username).slice(0,1).toUpperCase()}</span>}</div>
      <div className="profile-overview-copy"><h2>{profile.display_name || profile.username}</h2><p>@{profile.username}{profile.location ? " · " + profile.location : ""}</p>{profile.is_private && <span className="public-profile-private-note">Profilo privato · visibile ai follower</span>}{profile.bio && <div className="profile-bio">{profile.bio}</div>}{profile.website_url && <a href={profile.website_url} target="_blank" rel="noreferrer">{profile.website_url}</a>}</div>
      <div className="public-profile-action">{isOwner ? <Link href="/profile">Modifica profilo <ArrowUpRight size={15}/></Link> : <><ProfileFollowButton targetUserId={profile.user_id}/><MessageRequestButton targetUserId={profile.user_id} conversationId={existingConversation?.id??null}/><UserBlockButton userId={profile.user_id} displayName={profile.display_name||profile.username}/></>}</div>
    </section>
    <div className="public-profile-stats"><span><strong>{rankings.length}</strong> Renq</span><span><strong>{visibleCollections.length}</strong> Collezioni</span>{followerCount !== null && <span><strong>{followerCount ?? 0}</strong> Follower</span>}</div>
    <PublicProfileTabs
      collections={<>{/* public collections */}
<section className="profile-collections-section"><div className="profile-section-heading"><div><span>RACCOLTE PERSONALI</span><h2>Collezioni</h2></div><Folder size={20}/></div>
      {visibleCollections.length ? <div className="profile-collection-grid">{visibleCollections.map(collection => <Link href={"/collections/" + collection.slug} key={collection.id} className="profile-collection-card"><div className="profile-collection-art" style={collection.banner_display_url ? { backgroundImage: "linear-gradient(0deg,rgba(16,13,11,.72),rgba(16,13,11,.05)),url(" + collection.banner_display_url + ")" } : undefined}><span><Globe2 size={13}/> PUBBLICA</span><strong>{collection.title}</strong><small>{collection.description}</small></div></Link>)}</div> : <div className="profile-empty-state"><Folder size={23}/><strong>Nessuna collezione pubblica</strong></div>}
    </section>
      </>}
      renqs={<>
<section className="profile-renqs-section"><div className="profile-section-heading"><div><span>CLASSIFICHE PUBBLICATE</span><h2>I Renq di {profile.display_name || profile.username}</h2></div><Trophy size={20}/></div>
      {rankings.length ? <div className="profile-renq-grid">{rankings.map(ranking => { const settings = ranking.settings as Record<string, unknown>; const cover = typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : null; return <Link key={ranking.id} href={"/r/" + (ranking.public_slug || ranking.id)} className="profile-renq-card"><div style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(15,12,10,.75),rgba(15,12,10,.05)),url(" + cover + ")" } : undefined}><span>{String(ranking.mode).replaceAll("_"," ")}</span><ArrowUpRight size={17}/></div><strong>{ranking.title}</strong></Link>; })}</div> : <div className="profile-empty-state"><Trophy size={23}/><strong>Nessun Renq pubblico disponibile</strong></div>}
    </section>
      </>}
      pokemon={<PokemonProfileArchive items={visiblePokemonItems as Array<{id:string;title:string;public_slug:string|null;mode:string;status:string;updated_at:string;settings:Record<string,unknown>|null}>} referenceNow={Date.now()} persistentHighestLevel={null} maestroAchievedAt={null} readOnly/>}
    />
    <div className="profile-public-footer"><BadgeCheck size={15}/> Creato con Renqd</div>
  </main>;
}
