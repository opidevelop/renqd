import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedUser } from "@/lib/supabase/authorization";
import { getProfileMediaUrl } from "@/lib/supabase/profile-media";
import { ArrowLeft, ArrowUpRight, Globe2, LockKeyhole, Trophy } from "lucide-react";
import { CollectionDetailManager } from "@/components/collection-detail-manager";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { slug } = await params;
  const { edit } = await searchParams;
  const { supabase, user } = await requireApprovedUser();
  const { data: collection } = await supabase.from("profile_collections").select("*").eq("slug", slug).maybeSingle();
  if (!collection) notFound();
  const isOwner = collection.owner_id === user?.id;
  const collectionBannerUrl = await getProfileMediaUrl(supabase, collection.banner_url);
  if (collection.visibility === "PRIVATE" && !isOwner) notFound();
  const { data: profile } = await supabase.from("public_profiles").select("username,display_name,is_private").eq("user_id", collection.owner_id).maybeSingle();
  if (!profile || (profile.is_private && !isOwner)) notFound();
  const { data: links } = await supabase.from("profile_collection_items").select("ranking_id,position").eq("collection_id", collection.id).order("position");
  const ids = (links ?? []).map(item => item.ranking_id);
  const { data: rankings } = ids.length ? await supabase.from("rankings").select("id,title,public_slug,mode,settings,status,visibility").in("id", ids).is("deleted_at",null) : { data: [] };
  const visibleRankings=(rankings??[]).filter(ranking=>{
    if(isOwner)return true;
    const settings=(ranking.settings as Record<string,unknown>|null)??{};
    return ranking.status==="COMPLETED"&&ranking.visibility==="LIVE"&&settings.access!=="private"&&Boolean(settings.savedAt);
  });
  const ordered = (links ?? []).map(link => visibleRankings.find(ranking => ranking.id === link.ranking_id)).filter(Boolean);
  const firstSettings = ordered[0]?.settings as Record<string, unknown> | undefined;
  const firstSnapshot = firstSettings?.savedSnapshot as { items?: { image_url?: string | null }[] } | undefined;
  const collectionCover = collectionBannerUrl || (typeof firstSettings?.coverImageUrl === "string" ? firstSettings.coverImageUrl : null) || firstSnapshot?.items?.find(item => item.image_url)?.image_url || null;
  return <main className="public-profile-page collection-detail-page">
    <Link href={isOwner ? "/profile" : "/u/" + profile.username} className="public-profile-back"><ArrowLeft size={15}/> {isOwner ? "Il tuo profilo" : (profile.display_name || profile.username)}</Link>
    <section className="profile-cover collection-detail-cover" style={collectionCover ? { backgroundImage: "linear-gradient(90deg,rgba(18,14,11,.82),rgba(18,14,11,.15)),url(" + collectionCover + ")" } : undefined}>
      <div className="profile-cover-copy"><span>COLLEZIONE DI @{profile.username}</span><h1>{collection.title}</h1><p>{collection.description || "Una raccolta personale di Renq."}</p></div>
      <div className="collection-visibility">{collection.visibility === "PRIVATE" ? <><LockKeyhole size={13}/> PRIVATA</> : <><Globe2 size={13}/> PUBBLICA</>}</div>
    </section>
    {isOwner && <CollectionDetailManager collection={{id:collection.id,title:collection.title,description:collection.description??"",visibility:collection.visibility,banner_url:collection.banner_url}} initialItems={ordered.map(ranking=>({id:ranking!.id,title:ranking!.title,public_slug:ranking!.public_slug,mode:ranking!.mode}))} initialEditing={edit==="1"}/>}
    <section className="profile-renqs-section"><div className="profile-section-heading"><div><span>LA RACCOLTA</span><h2>{ordered.length} Renq</h2></div><Trophy size={20}/></div>
      {ordered.length ? <div className="profile-renq-grid">{ordered.map(ranking => { const settings = ranking!.settings as Record<string, unknown>; const snapshot = settings.savedSnapshot as { items?: { image_url?: string | null }[] } | undefined; const cover = (typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : null) || snapshot?.items?.find(item => item.image_url)?.image_url || null; return <Link key={ranking!.id} href={(isOwner ? "/renq/" : "/r/") + (ranking!.public_slug || ranking!.id)} className="profile-renq-card"><div style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(15,12,10,.75),rgba(15,12,10,.05)),url(" + cover + ")" } : undefined}><span>{String(ranking!.mode).replaceAll("_"," ")}</span><ArrowUpRight size={17}/></div><strong>{ranking!.title}</strong></Link>; })}</div> : <div className="profile-empty-state"><Trophy size={23}/><strong>Questa collezione è ancora vuota</strong></div>}
    </section>
  </main>;
}
