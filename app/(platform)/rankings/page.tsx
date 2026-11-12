import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowUpRight, Trophy, Plus, Music2, Gamepad2, Clapperboard, BookOpen } from "lucide-react";

export const dynamic="force-dynamic";

const modeLabels:Record<string,string>={RENQ:"Classico",BATTLE_RENQ:"Battle",SPEED_RENQ:"Speed"};
const categoryLabels:Record<string,string>={music:"Musica",games:"Videogiochi",film:"Film e serie",books:"Libri",sport:"Sport",custom:"Personalizzato"};
const categoryIcons:Record<string,typeof Music2>={music:Music2,games:Gamepad2,film:Clapperboard,books:BookOpen};

export default async function MyRenqsPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return null;
 const {data:rankings,error}=await supabase.from("rankings").select("id,title,mode,status,settings,created_at,completed_at").eq("user_id",user.id).in("status",["COMPLETED","DRAFT"]).order("completed_at",{ascending:false});
 const savedRankings=(rankings??[]).filter(ranking=>Boolean((ranking.settings as Record<string,unknown>|null)?.savedAt));
 const saved=await Promise.all(savedRankings.map(async ranking=>{
  const settings=(ranking.settings??{}) as Record<string,unknown>;
  const snapshot=(settings.savedSnapshot??{}) as {items?:{title:string;image_url?:string|null;rank_position?:number|null}[]};
  const rows=snapshot.items??[];
  const coverPath=typeof settings.coverImagePath==="string"?settings.coverImagePath:null;
  const {data:signedCover}=coverPath?await supabase.storage.from("renq-covers").createSignedUrl(coverPath,60*60*24*7):{data:null};
  const coverImage=signedCover?.signedUrl??(typeof settings.coverImageUrl==="string"?settings.coverImageUrl:rows.find(item=>item.image_url)?.image_url??null);
  const category=String(settings.category??"custom");
  const Icon=categoryIcons[category]??Trophy;
  return {ranking,result:{id:ranking.id,created_at:String(settings.savedAt)},settings,rows,category,Icon,coverImage};
 }));
 return <div className="my-renqs-page">
  <header className="my-renqs-header"><div><span className="page-eyebrow"><Trophy size={14}/> LA TUA COLLEZIONE</span><h1>I miei <span className="renqd-wordmark">renqd<span>.</span></span></h1><p>Le classifiche che hai deciso di conservare, tutte in un unico posto.</p></div><Link href="/create" className="my-renqs-create"><Plus size={17}/> Crea un Renq</Link></header>
  <div className="my-renqs-summary"><div><strong>{saved.length.toString().padStart(2,"0")}</strong><span>RENQ SALVATI</span></div><p>Ogni classifica racconta una scelta. Qui ritrovi le tue.</p></div>
  {error?<div className="my-renqs-empty"><h2>Non riusciamo a caricare i tuoi Renq.</h2><p>Riprova tra poco.</p></div>:saved.length===0?<div className="my-renqs-empty"><span className="my-renqs-empty-icon"><Trophy size={25}/></span><h2>La tua collezione inizia da qui.</h2><p>Quando completi un Renq e scegli “Conferma e salva”, lo troverai in questa pagina.</p><Link href="/create">Crea il tuo primo Renq <ArrowUpRight size={16}/></Link></div>:<div className="my-renqs-grid">{saved.map(({result,ranking,rows,category,Icon,coverImage})=><Link href={"/renq/"+(ranking.public_slug??ranking.id)} className="my-renq-card" key={result.id}><div className="my-renq-card-art">{coverImage?<img src={coverImage} alt="" loading="lazy"/>:<span><Icon size={25}/></span>}<div className="my-renq-card-art-shade"/><div className="my-renq-card-top"><span className="my-renq-category"><Icon size={14}/>{categoryLabels[category]??"Renq"}</span><span className="my-renq-mode">{modeLabels[ranking.mode]??"Renq"}</span></div></div><h2>{ranking.title}</h2><p className="my-renq-card-meta">{rows.length} elementi <i>·</i> Salvato il {new Date(result.created_at).toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"})}</p><div className="my-renq-preview">{rows.slice(0,3).map((item,i)=><div key={i}><span>{String(item.rank_position??i+1).padStart(2,"0")}</span><strong>{item.title}</strong></div>)}</div><div className="my-renq-card-bottom"><span>Apri classifica</span><ArrowUpRight size={17}/></div></Link>)}</div>}
 </div>;
}
