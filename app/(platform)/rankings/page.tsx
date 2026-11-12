import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowUpRight, Trophy, Plus, Music2, Gamepad2, Clapperboard, BookOpen, Clock3 } from "lucide-react";

export const dynamic="force-dynamic";

const modeLabels:Record<string,string>={RENQ:"Classico",BATTLE_RENQ:"Battle",SPEED_RENQ:"Speed"};
const categoryLabels:Record<string,string>={music:"Musica",games:"Videogiochi",film:"Film e serie",books:"Libri",sport:"Sport",custom:"Personalizzato"};
const categoryIcons:Record<string,typeof Music2>={music:Music2,games:Gamepad2,film:Clapperboard,books:BookOpen};

export default async function MyRenqsPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return null;
 const {data:results,error}=await supabase.from("ranking_results").select("id,ranking_id,result_snapshot,created_at").eq("user_id",user.id).order("created_at",{ascending:false});
 const rankingIds=[...new Set((results??[]).map(x=>x.ranking_id))];
 const {data:rankings}=rankingIds.length?await supabase.from("rankings").select("id,title,mode,status,settings,created_at,completed_at").in("id",rankingIds).eq("user_id",user.id):{data:[]};
 const lookup=new Map((rankings??[]).map(x=>[x.id,x]));
 const saved=(results??[]).map(result=>({result,ranking:lookup.get(result.ranking_id)})).filter(x=>x.ranking);
 return <div className="my-renqs-page">
  <header className="my-renqs-header"><div><span className="page-eyebrow"><Trophy size={14}/> LA TUA COLLEZIONE</span><h1>I miei <em>Renq.</em></h1><p>Le classifiche che hai deciso di conservare, tutte in un unico posto.</p></div><Link href="/create" className="my-renqs-create"><Plus size={17}/> Crea un Renq</Link></header>
  <div className="my-renqs-summary"><div><strong>{saved.length.toString().padStart(2,"0")}</strong><span>RENQ SALVATI</span></div><p>Ogni classifica racconta una scelta. Qui ritrovi le tue.</p></div>
  {error?<div className="my-renqs-empty"><h2>Non riusciamo a caricare i tuoi Renq.</h2><p>Riprova tra poco.</p></div>:saved.length===0?<div className="my-renqs-empty"><span className="my-renqs-empty-icon"><Trophy size={25}/></span><h2>La tua collezione inizia da qui.</h2><p>Quando completi un Renq e scegli “Conferma e salva”, lo troverai in questa pagina.</p><Link href="/create">Crea il tuo primo Renq <ArrowUpRight size={16}/></Link></div>:<div className="my-renqs-grid">{saved.map(({result,ranking})=>{const snapshot=(result.result_snapshot??{}) as {items?:{title:string;image_url?:string|null;rank_position?:number|null}[];ranking?:{settings?:Record<string,unknown>}};const rows=snapshot.items??[];const settings=(ranking?.settings??snapshot.ranking?.settings??{}) as Record<string,unknown>;const category=String(settings.category??"custom");const Icon=categoryIcons[category]??Trophy;return <Link href={"/renq/"+ranking!.id} className="my-renq-card" key={result.id}><div className="my-renq-card-top"><span className="my-renq-category"><Icon size={14}/>{categoryLabels[category]??"Renq"}</span><span className="my-renq-mode">{modeLabels[ranking!.mode]??"Renq"}</span></div><h2>{ranking!.title}</h2><p className="my-renq-card-meta">{rows.length} elementi <i>·</i> Salvato il {new Date(result.created_at).toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"})}</p><div className="my-renq-preview">{rows.slice(0,3).map((item,i)=><div key={i}><span>{String(item.rank_position??i+1).padStart(2,"0")}</span><strong>{item.title}</strong></div>)}</div><div className="my-renq-card-bottom"><span>Apri classifica</span><ArrowUpRight size={17}/></div></Link>;})}</div>}
 </div>;
}
