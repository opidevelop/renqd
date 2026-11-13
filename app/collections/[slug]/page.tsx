import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, ArrowUpRight, Globe2, LockKeyhole, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: collection } = await supabase.from("profile_collections").select("*").eq("slug", slug).maybeSingle();
  if (!collection) notFound();
  const isOwner = collection.owner_id === user?.id;
  if (collection.visibility === "PRIVATE" && !isOwner) notFound();
  const { data: profile } = await supabase.from("public_profiles").select("username,display_name,is_private").eq("user_id", collection.owner_id).maybeSingle();
  if (!profile || (profile.is_private && !isOwner)) notFound();
  const { data: links } = await supabase.from("profile_collection_items").select("ranking_id,position").eq("collection_id", collection.id).order("position");
  const ids = (links ?? []).map(item => item.ranking_id);
  const { data: rankings } = ids.length ? await supabase.from("rankings").select("id,title,public_slug,mode,settings").in("id", ids) : { data: [] };
  const ordered = (links ?? []).map(link => (rankings ?? []).find(ranking => ranking.id === link.ranking_id)).filter(Boolean);
  return <main className="public-profile-page collection-detail-page">
    <Link href={"/u/" + profile.username} className="public-profile-back"><ArrowLeft size={15}/> {profile.display_name || profile.username}</Link>
    <section className="profile-cover collection-detail-cover" style={collection.banner_url ? { backgroundImage: "linear-gradient(90deg,rgba(18,14,11,.82),rgba(18,14,11,.15)),url(" + collection.banner_url + ")" } : undefined}>
      <div className="profile-cover-copy"><span>COLLEZIONE DI @{profile.username}</span><h1>{collection.title}</h1><p>{collection.description || "Una raccolta personale di Renq."}</p></div>
      <div className="collection-visibility">{collection.visibility === "PRIVATE" ? <><LockKeyhole size={13}/> PRIVATA</> : <><Globe2 size={13}/> PUBBLICA</>}</div>
    </section>
    <section className="profile-renqs-section"><div className="profile-section-heading"><div><span>LA RACCOLTA</span><h2>{ordered.length} Renq</h2></div><Trophy size={20}/></div>
      {ordered.length ? <div className="profile-renq-grid">{ordered.map(ranking => { const settings = ranking!.settings as Record<string, unknown>; const cover = typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : null; return <Link key={ranking!.id} href={(isOwner ? "/renq/" : "/r/") + (ranking!.public_slug || ranking!.id)} className="profile-renq-card"><div style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(15,12,10,.75),rgba(15,12,10,.05)),url(" + cover + ")" } : undefined}><span>{String(ranking!.mode).replaceAll("_"," ")}</span><ArrowUpRight size={17}/></div><strong>{ranking!.title}</strong></Link>; })}</div> : <div className="profile-empty-state"><Trophy size={23}/><strong>Questa collezione è ancora vuota</strong></div>}
    </section>
  </main>;
}
