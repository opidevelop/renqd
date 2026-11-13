import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicRenqPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  let { data: ranking } = await supabase.from("rankings").select("id,user_id,public_slug,title,mode,settings,visibility,status").eq("public_slug", slug).maybeSingle();
  if (!ranking && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(slug)) {
    const result = await supabase.from("rankings").select("id,user_id,public_slug,title,mode,settings,visibility,status").eq("id", slug).maybeSingle();
    ranking = result.data;
  }
  if (!ranking || ranking.status !== "COMPLETED" || ranking.visibility !== "LIVE" || (ranking.settings as Record<string,unknown>)?.access === "private") notFound();
  const settings = (ranking.settings ?? {}) as Record<string,unknown>;
  const snapshot = (settings.savedSnapshot ?? {}) as { items?: { id?:string; title:string; image_url?:string|null; description?:string|null; rank_position?:number|null }[] };
  const items = (snapshot.items ?? []).slice().sort((a,b)=>(a.rank_position??999)-(b.rank_position??999));
  const { data: profile } = await supabase.from("public_profiles").select("username,display_name").eq("user_id", ranking.user_id).maybeSingle();
  const cover = typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : null;
  const position = settings.coverPosition && typeof settings.coverPosition === "object" ? settings.coverPosition as {x:number;y:number} : {x:50,y:50};
  return <main className="public-profile-page public-renq-page">
    {profile && <Link href={"/u/" + profile.username} className="public-profile-back"><ArrowLeft size={15}/> {profile.display_name || profile.username}</Link>}
    <section className="profile-cover public-renq-cover" style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(15,12,10,.85),rgba(15,12,10,.12)),url(" + cover + ")", backgroundPosition: position.x + "% " + position.y + "%" } : undefined}>
      <div className="profile-cover-copy"><span>{String(ranking.mode).replaceAll("_"," ")} · RENQD</span><h1>{ranking.title}</h1><p>{items.length} elementi · Classifica pubblicata</p></div>
    </section>
    <section className="profile-renqs-section"><div className="profile-section-heading"><div><span>IL RISULTATO</span><h2>La classifica</h2></div><Trophy size={20}/></div>
      {items.length ? <div className="saved-renq-list">{items.map((item,index)=>{const rank=item.rank_position??index+1;const medal=rank<=3?["🥇","🥈","🥉"][rank-1]:null;return <article className={"saved-renq-row"+(rank<=3?" is-top-"+rank:"")} key={item.id??index}><span className="saved-renq-position">{String(rank).padStart(2,"0")}</span>{item.image_url?<img src={item.image_url} alt="" loading="lazy"/>:<span className="saved-renq-item-placeholder"><Trophy size={18}/></span>}<div className="saved-renq-item-copy"><strong>{item.title}</strong>{item.description&&<small>{item.description}</small>}</div>{medal&&<span className={"saved-renq-medal medal-"+rank}>{medal}</span>}</article>;})}</div> : <div className="profile-empty-state"><Trophy size={22}/><strong>Anteprima della classifica non disponibile</strong></div>}
    </section>
    <div className="profile-public-footer">renqd<span>.</span></div>
  </main>;
}
