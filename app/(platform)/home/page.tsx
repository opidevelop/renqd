import Image from "next/image";
import Link from "next/link";
import {HomeResumeActions} from "@/components/home-resume-actions";
import {createClient} from "@/lib/supabase/server";
import {Music2,Gamepad2,Clapperboard,BookOpen,Trophy,Sparkles,Plus,ArrowUpRight,Clock3,Users} from "lucide-react";
const cats=[{title:"Musica",id:"music",detail:"Album, artisti e canzoni",tone:"music",icon:Music2},{title:"Videogiochi",id:"games",detail:"Giochi, saghe e personaggi",tone:"games",icon:Gamepad2},{title:"Film e serie",id:"film",detail:"Film, serie e franchise",tone:"film",icon:Clapperboard},{title:"Libri",id:"books",detail:"Autori, romanzi e saghe",tone:"books",icon:BookOpen},{title:"Sport",id:"sport",detail:"Atleti, squadre e competizioni",tone:"sport",icon:Trophy},{title:"Lista personalizzata",id:"custom",detail:"Crea una lista senza limiti",tone:"custom",icon:Sparkles}];
type ResumeEntry={id:string;title:string|null;mode:string;kind:"draft"|"session";status:string;settings:Record<string,unknown>};
export default async function PlatformHomePage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 const [{data:drafts},{data:participantRows}]=user?await Promise.all([
  supabase.from("rankings").select("id,title,mode,settings,updated_at,created_at").eq("user_id",user.id).eq("status","DRAFT").is("deleted_at",null).order("updated_at",{ascending:false}).limit(30),
  supabase.from("ranking_participants").select("ranking_id").eq("user_id",user.id).in("invitation_status",["PENDING","ACCEPTED"])
 ]):[{data:[]},{data:[]}];
 const draftEntries:ResumeEntry[]=(drafts??[]).filter(row=>{
  const settings=(row.settings??{}) as Record<string,unknown>;
  const snapshot=settings.savedSnapshot as {items?:unknown[]}|undefined;
  return Boolean(snapshot?.items?.length||settings.draftItems||settings.items||settings.category);
 }).map(row=>({id:row.id,title:row.title,mode:row.mode,kind:"draft",status:"DRAFT",settings:(row.settings??{}) as Record<string,unknown>}));
 const sessionIds=[...new Set((participantRows??[]).map(row=>row.ranking_id))].filter(Boolean);
 const sessionEntries=(await Promise.all(sessionIds.map(async rankingId=>{
  const {data,error}=await supabase.rpc("renqd_get_multiplayer_session",{p_ranking_id:rankingId});
  if(error||!data||!["LOBBY","ACTIVE","AWAITING_DECISION"].includes(String(data.session?.status)))return null;
  return {id:String(data.ranking.id),title:typeof data.ranking.title==="string"?data.ranking.title:null,mode:String(data.ranking.mode??"RENQ"),kind:"session" as const,status:String(data.session.status),settings:(data.ranking.settings??{}) as Record<string,unknown>};
 }))).filter((entry):entry is NonNullable<typeof entry>=>entry!==null);
 const sessionRankingIds=new Set(sessionEntries.map(entry=>entry.id));
 const resumable=[...draftEntries.filter(entry=>!sessionRankingIds.has(entry.id)),...sessionEntries];
 const resumableWithCovers=await Promise.all(resumable.map(async entry=>{
  const coverPath=typeof entry.settings.coverImagePath==="string"?entry.settings.coverImagePath:null;
  const {data:signed}=coverPath?await supabase.storage.from("renq-covers").createSignedUrl(coverPath,60*60*24*7):{data:null};
  const snapshot=entry.settings.savedSnapshot as {items?:{image_url?:string|null}[]}|undefined;
  const coverImageUrl=signed?.signedUrl??(typeof entry.settings.coverImageUrl==="string"?entry.settings.coverImageUrl:null)??(typeof entry.settings.defaultCoverImageUrl==="string"?entry.settings.defaultCoverImageUrl:null)??snapshot?.items?.find(item=>item.image_url)?.image_url??null;
  const coverPosition=entry.settings.coverPosition&&typeof entry.settings.coverPosition==="object"?entry.settings.coverPosition as {x:number;y:number}:{x:50,y:50};
  return {...entry,coverImageUrl,coverPosition};
 }));
 return <div className="home-app">
  <section className="home-create-focus"><div className="home-create-copy"><span className="home-create-eyebrow">DA UN&apos;IDEA A UNA CLASSIFICA</span><h1>Cosa mettiamo<br/><em>in classifica?</em></h1><p>Scegli una passione o crea il tuo Renq da zero.</p><Link href="/create" className="home-create-button"><Plus size={21}/><span>Crea un Renq</span></Link></div></section>
  {resumableWithCovers.length>0&&<section className="home-resume-section"><div className="section-heading-row"><div><span className="home-create-eyebrow">IL TUO LAVORO IN SOSPESO</span><h2>Riprendi <em>Renq.</em></h2><p>Bozze e sessioni multiplayer a cui puoi tornare.</p></div><HomeResumeActions/></div><div className="home-resume-grid">{resumableWithCovers.map(row=><Link href={row.kind==="session"?"/multiplayer/"+row.id:"/renq/"+row.id} key={row.id} className="home-resume-card">{row.coverImageUrl?<img className="home-resume-art" src={row.coverImageUrl} alt="" loading="lazy" style={{objectPosition:row.coverPosition.x+"% "+row.coverPosition.y+"%"}}/>:<span className="home-resume-icon">{row.kind==="session"?<Users size={19}/>:<Clock3 size={19}/>}</span>}<span className="home-resume-copy"><strong>{row.title||"Renq senza titolo"}</strong><small>{row.kind==="session"?"Sessione multiplayer":row.mode==="SPEED_RENQ"?"Speed Renq":row.mode==="BATTLE_RENQ"?"Battle Renq":row.mode==="GRADE"?"Grade":"Renq"} · {row.kind==="session"?"In corso":"Da completare"}</small></span><ArrowUpRight size={18}/></Link>)}</div></section>}
  <Link href="/pokemon" className="home-pokemon-banner">
   <span className="home-pokemon-banner-copy"><small>RENQD × POKÉMON</small><strong>Il tuo universo Pokémon.</strong><em>Quattro esperienze. Un solo mondo da esplorare.</em><span className="home-pokemon-banner-cta">Entra nell’hub <ArrowUpRight size={16}/></span></span>
   <span className="home-pokemon-banner-art" aria-hidden="true"><i/><img className="home-pokemon-mon home-pokemon-mon-back" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png" alt=""/><img className="home-pokemon-mon home-pokemon-mon-mid" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" alt=""/><img className="home-pokemon-mon home-pokemon-mon-front" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png" alt=""/></span>
   <span className="home-pokemon-banner-arrow"><ArrowUpRight size={20}/></span>
  </Link>
  <section className="home-category-section"><div className="section-heading-row"><div><span className="home-create-eyebrow">PARTI DA UNA CATEGORIA</span><h2>Esplora le tue <em>passioni.</em></h2></div></div><div className="home-category-grid">{cats.map(({title,id,detail,tone,icon:Icon})=><Link href={"/create?category="+id} key={id} className={"home-category-card tone-"+tone}><span className="home-category-icon"><Icon size={22}/></span><strong>{title}</strong><small>{detail}</small><span className="category-arrow">↗</span></Link>)}</div></section>
  <footer className="home-attribution-footer"><span>renqd.</span><Link href="/attributions" aria-label="Informazioni sulle attribuzioni" title="Attribuzioni"><span aria-hidden="true">i</span></Link></footer>
 </div>;
}
