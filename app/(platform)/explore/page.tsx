import {Compass} from "lucide-react";
import Image from "next/image";
import {createClient} from "@/lib/supabase/server";
import {getProfileMediaUrl} from "@/lib/supabase/profile-media";
import {SocialDiscover} from "@/components/social-discover";
import {SocialFeed,type SocialFeedItem} from "@/components/social-feed";
export const dynamic="force-dynamic";
export default async function ExplorePage(){
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("renqd_get_social_feed",{p_event_types:null,p_before:null,p_limit:50});
 const rows=error?[]:(((data??{}) as {items?:SocialFeedItem[]}).items??[]);
 const feedItems=await Promise.all(rows.map(async item=>({...item,actor:{...item.actor,avatarUrl:await getProfileMediaUrl(supabase,item.actor.avatarUrl)}})));
 return <div className="explore-page">
  <header className="explore-page-heading"><div><div className="page-eyebrow"><Compass size={14}/> IL MONDO RENQD</div><h1>Segui la curiosità.</h1><p>Persone, classifiche e attività dalla community.</p></div><span className="explore-heading-mark" aria-hidden="true"><Image className="explore-heading-serpentina" src="/brand/serpentina-podio.svg" width={112} height={112} alt=""/><Image className="explore-heading-stellina" src="/brand/stellina.svg" width={27} height={27} alt=""/></span></header>
  <div className="explore-mosaic">
   <section className="explore-mosaic-discover"><SocialDiscover/></section>
   <section className="explore-mosaic-feed"><SocialFeed items={feedItems}/></section>
  </div>
 </div>;
}
