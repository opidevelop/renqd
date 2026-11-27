import Image from "next/image";
import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {ArrowLeft,Trophy,Star,Music,Mic2} from "lucide-react";
import {CatalogReportButton} from "@/components/drag-race/catalog-report-button";
import {SeasonCatalogPoster} from "@/components/drag-race/season-catalog-poster";
export const dynamic="force-dynamic";
type QueenAppearance={seasonId:string;placement?:number;challengeWins?:Array<{episodeId:string;name:string}>;miniChallengeWins?:Array<{episodeId:string;name?:string}>;lipSyncWins?:Array<{episodeId:string;song:string}>;lipSyncLosses?:Array<{episodeId:string;song:string}>;disqualified?:boolean;quit?:boolean;reentered?:boolean};
type Season={id:string;franchise_code:string;season_number:number;year:number|null;name:string;winner_ids:string[];runner_up_ids:string[]};
export default async function DragRaceQueenPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return null;
 const {data:queen}=await db.from("drag_race_queens").select("id,name,aliases,origin,appearances,image_url,source_url,source_version").eq("id",id).maybeSingle();
 if(!queen)notFound();
 const appearances=(queen.appearances??[]) as QueenAppearance[];
 const seasonIds=[...new Set(appearances.map(a=>a.seasonId).filter(Boolean))];
 const [seasonResult,franchiseResult]=await Promise.all([
  seasonIds.length?db.from("drag_race_seasons").select("id,franchise_code,season_number,year,name,winner_ids,runner_up_ids").in("id",seasonIds):Promise.resolve({data:[] as Season[]}),
  db.from("drag_race_franchises").select("code,name")
 ]);
 const seasons=(seasonResult.data??[]) as Season[];
 const seasonMap=new Map(seasons.map(s=>[s.id,s]));
 const franchiseMap=new Map((franchiseResult.data??[]).map(f=>[f.code,f.name]));
 const totalChallengeWins=appearances.reduce((sum,a)=>sum+(a.challengeWins?.length??0),0);
 const totalMiniWins=appearances.reduce((sum,a)=>sum+(a.miniChallengeWins?.length??0),0);
 const totalLipWins=appearances.reduce((sum,a)=>sum+(a.lipSyncWins?.length??0),0);
 const totalLipLosses=appearances.reduce((sum,a)=>sum+(a.lipSyncLosses?.length??0),0);
 const seasonWins=appearances.filter(a=>seasonMap.get(a.seasonId)?.winner_ids.includes(queen.id)).length;
 const countries=(queen.origin as {countries?:string[]}|null)?.countries??[];
 return <main className="drag-race-page drag-queen-profile drag-race-pop-queen"><Link className="drag-back" href="/drag-race/track-record"><ArrowLeft size={16}/> Track Record</Link>
  <header className="drag-queen-profile-head drag-race-pop-queen-head"><Image src={queen.image_url??("/api/drag-race/queen-image?id="+encodeURIComponent(queen.id))} alt={queen.name} width={180} height={180} unoptimized/><div><span>DRAG RACE · QUEEN PROFILE</span><h1>{queen.name}</h1>{queen.aliases?.length>0&&<p>Alias: {queen.aliases.join(" · ")}</p>}{countries.length>0&&<p>Origini: {countries.join(" · ")}</p>}{queen.source_url&&<a href={queen.source_url} target="_blank" rel="noreferrer">Fonte del catalogo</a>}<CatalogReportButton entityType="QUEEN" entityId={queen.id} entityName={queen.name} sourceUrl={queen.source_url} sourceVersion={queen.source_version}/></div></header>
  <section className="drag-queen-stats drag-race-pop-queen-stats"><div><strong>{appearances.length}</strong><small>Stagioni</small></div><div><strong>{seasonWins}</strong><small>Vittorie</small></div><div><strong>{totalChallengeWins}</strong><small>Challenge win</small></div><div><strong>{totalMiniWins}</strong><small>Mini challenge</small></div><div><strong>{totalLipWins}</strong><small>Lipsync vinti</small></div><div><strong>{totalLipLosses}</strong><small>Lipsync persi</small></div></section>
  <section className="drag-track-section drag-race-pop-career"><div className="drag-track-section-head"><div><span>CAREER HISTORY</span><h2>Partecipazioni</h2></div><Trophy size={22}/></div>
   {appearances.length?<div className="drag-queen-season-list">{appearances.map((appearance,index)=>{const season=seasonMap.get(appearance.seasonId);const won=Boolean(season?.winner_ids.includes(queen.id));const runner=Boolean(season?.runner_up_ids.includes(queen.id));return <article className="drag-race-pop-season-card" key={appearance.seasonId+index}><SeasonCatalogPoster seasonId={season?.id??null} title={season?.name??appearance.seasonId}/><div className="drag-queen-season-main"><strong>{season?.name??appearance.seasonId}</strong><small>{franchiseMap.get(season?.franchise_code??"")??season?.franchise_code??"Drag Race"}{season?.year?" · "+season.year:""}</small></div><div className="drag-queen-season-badges">{won?<span className="is-winner"><Trophy size={12}/> Vincitrice</span>:runner?<span>Runner-up</span>:appearance.placement?<span>#{appearance.placement}</span>:null}{appearance.quit&&<span>Quit</span>}{appearance.disqualified&&<span>Disqualified</span>}{appearance.reentered&&<span>Rientrata</span>}</div><div className="drag-queen-season-metrics"><span><Star size={12}/> {appearance.challengeWins?.length??0} challenge win</span><span><Music size={12}/> {appearance.lipSyncWins?.length??0} lipsync vinti</span><span><Mic2 size={12}/> {appearance.lipSyncLosses?.length??0} lipsync persi</span></div></article>;})}</div>:<div className="drag-track-empty">Nessuna partecipazione disponibile nel catalogo.</div>}
  </section>
 </main>;
}
