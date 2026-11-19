import {BookOpen,Clapperboard,Compass,Gamepad2,Music2,Plane,Utensils} from "lucide-react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {getProfileMediaUrl} from "@/lib/supabase/profile-media";
import {SocialDiscover} from "@/components/social-discover";
import {SocialFeed,type SocialFeedItem} from "@/components/social-feed";
export const dynamic="force-dynamic";
const categories=[{title:"Musica",description:"Album, artisti, discografie e canzoni.",icon:Music2,tone:"music"},{title:"Videogiochi",description:"Titoli, saghe, franchise e personaggi.",icon:Gamepad2,tone:"games"},{title:"Film e serie",description:"Film, serie TV, franchise e cast.",icon:Clapperboard,tone:"film"},{title:"Libri",description:"Libri, autori, saghe e personaggi.",icon:BookOpen,tone:"books"},{title:"Food",description:"Piatti, ristoranti, cucine e ingredienti.",icon:Utensils,tone:"food"},{title:"Viaggi",description:"Città, paesi, luoghi ed esperienze.",icon:Plane,tone:"travel"}];
export default async function ExplorePage(){
 const supabase=await createClient();const {data,error}=await supabase.rpc("renqd_get_social_feed",{p_event_types:null,p_before:null,p_limit:50});
 const rows=error?[]:(((data??{}) as {items?:SocialFeedItem[]}).items??[]);
 const feedItems=await Promise.all(rows.map(async item=>({...item,actor:{...item.actor,avatarUrl:await getProfileMediaUrl(supabase,item.actor.avatarUrl)}})));
 return <div className="explore-page"><div className="platform-page-heading"><div><div className="page-eyebrow"><Compass size={14}/> IL MONDO RENQD</div><h1>Segui la curiosità.</h1><p>Persone, classifiche e passioni da scoprire.</p></div></div><SocialDiscover/><SocialFeed items={feedItems}/><section className="explore-intro"><div><span>IL PROSSIMO RENQ INIZIA DA QUI</span><h2>Trova il tuo<br/><em>prossimo mondo.</em></h2><p>Scegli un argomento e trasformalo nel tuo prossimo ranking.</p></div><div className="explore-mark" aria-hidden="true">R<span>✳</span></div></section><div className="section-heading-row"><div><div className="page-eyebrow">ESPLORA PER CATEGORIA</div><h2>Le tue passioni, <em>una alla volta.</em></h2></div><span className="section-count">06 CATEGORIE</span></div><div className="explore-grid">{categories.map(({title,description,icon:Icon,tone},i)=><Link href="/create" className={"explore-card tone-"+tone} key={title}><div className="explore-card-top"><span>0{i+1}</span><Icon size={22}/></div><h3>{title}</h3><p>{description}</p><span className="explore-card-arrow">Apri categoria ↗</span></Link>)}</div></div>;
}