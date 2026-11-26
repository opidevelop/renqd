import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION="1.1.1";
const SOURCE_ID="@tkalejandro/drag-race-mcp";
const PACKAGE="https://registry.npmjs.org/@tkalejandro/drag-race-mcp/-/drag-race-mcp-1.1.1.tgz";
const SOURCE="https://github.com/tkalejandro/drag-race-mcp/tree/main/src/data";
const LABELS:Record<string,[string,string,number]>={
US:["RuPaul’s Drag Race","North America",1],AS:["RuPaul’s Drag Race All Stars","North America",2],UK:["RuPaul’s Drag Race UK","Europe",3],UKVTW:["RuPaul’s Drag Race UK vs the World","International",4],DE:["Drag Race Germany","Europe",5],FR:["Drag Race France","Europe",6],NL:["Drag Race Holland","Europe",7],BE:["Drag Race Belgique","Europe",8],SE:["Drag Race Sverige","Europe",9],ES:["Drag Race España","Europe",10],ESAS:["Drag Race España All Stars","Europe",11],GAS:["RuPaul’s Drag Race Global All Stars","International",12],CA:["Canada’s Drag Race","North America",13],CVTW:["Canada’s Drag Race vs the World","International",14],CAS:["Canada’s Drag Race All Stars","North America",15],DU:["Drag Race Down Under","Oceania",16],DUVTW:["Drag Race Down Under vs the World","International",17],TH:["Drag Race Thailand","Asia",18],PH:["Drag Race Philippines","Asia",19],PHSR:["Drag Race Philippines: Slaysian Royale","Asia",20],IT:["Drag Race Italia","Europe",21],BR:["Drag Race Brasil","South America",22],MX:["Drag Race México","North America",23],MXLR:["Drag Race México: Latina Royale","International",24]};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});
const field=(b:Uint8Array,s:number,n:number)=>new TextDecoder().decode(b.slice(s,s+n)).replace(/\0.*$/s,"").trim();
function tarFiles(b:Uint8Array){const out:{path:string;data:Uint8Array}[]=[];let o=0;while(o+512<=b.length){const h=b.slice(o,o+512);if(h.every(x=>x===0))break;const name=field(h,0,100),prefix=field(h,345,155),path=prefix?prefix+"/"+name:name,size=parseInt(field(h,124,12)||"0",8),type=String.fromCharCode(h[156]||48),start=o+512,end=start+size;if((type==="0"||type==="\0"||type==="7")&&end<=b.length&&path.endsWith(".json"))out.push({path,data:b.slice(start,end)});o=start+Math.ceil(size/512)*512;}return out;}
const norm=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
async function itunes(song:string){try{const p=new URLSearchParams({term:song,entity:"song",limit:"20",country:"IT"});const r=await fetch("https://itunes.apple.com/search?"+p,{signal:AbortSignal.timeout(6500)});if(!r.ok)return null;const d=await r.json() as {results?:Array<{trackName?:string;artistName?:string;previewUrl?:string;trackViewUrl?:string}>};const m=(d.results??[]).filter(x=>x.trackName&&x.artistName&&norm(x.trackName)===norm(song));const artists=[...new Set(m.map(x=>x.artistName!))];if(artists.length!==1)return null;const chosen=m.find(x=>x.previewUrl)??m[0];return{artist:artists[0],preview:chosen.previewUrl??null,url:chosen.trackViewUrl??null};}catch{return null;}}
async function upsert(table:string,rows:Record<string,unknown>[],key:string){for(let i=0;i<rows.length;i+=100){const {error}=await admin.from(table).upsert(rows.slice(i,i+100),{onConflict:key});if(error)throw error;}}
let admin:any;
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!service)return reply({error:"Server configuration unavailable"},500);
 const auth=req.headers.get("Authorization");if(!auth)return reply({error:"Authentication required"},401);
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:u,error:ue}=await userClient.auth.getUser();if(ue||!u.user)return reply({error:"Authentication required"},401);
 const {data:p}=await userClient.from("profiles").select("role,status").eq("id",u.user.id).maybeSingle();
 if(p?.status!=="APPROVED"||!["OWNER","ADMIN","MODERATOR"].includes(String(p.role)))return reply({error:"Staff access required"},403);
 admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 let force=false;try{force=(await req.json())?.force===true;}catch{}
 const {data:claim,error:ce}=await admin.rpc("drag_race_claim_catalog_sync",{p_force:force});if(ce)return reply({error:"Sync lock unavailable"},503);
 if(!claim){const {data:state}=await admin.from("drag_race_catalog_sync_state").select("*").eq("id",1).maybeSingle();return reply({synced:false,state});}
 try{
  const res=await fetch(PACKAGE,{signal:AbortSignal.timeout(30000)});if(!res.ok)throw new Error("NPM package HTTP "+res.status);
  const gz=new Uint8Array(await res.arrayBuffer());const stream=new Response(gz).body!.pipeThrough(new DecompressionStream("gzip"));const tar=new Uint8Array(await new Response(stream).arrayBuffer());
  const queens:any[]=[],packs=new Map<string,{season?:any;episodes?:any[]}>();
  for(const f of tarFiles(tar)){const path=f.path.replace(/^package\//,"");if(path.startsWith("dist/data/queens/")){queens.push(JSON.parse(new TextDecoder().decode(f.data)));continue;}if(path.startsWith("dist/data/seasons/")){const parts=path.split("/"),id=parts[3];if(!id)continue;const pack=packs.get(id)??{};const v=JSON.parse(new TextDecoder().decode(f.data));if(parts[4]==="season.json")pack.season=v;if(parts[4]==="episodes.json")pack.episodes=v;packs.set(id,pack);}}
  const seasons=[...packs.values()].filter(x=>x.season&&Array.isArray(x.episodes));if(queens.length<250||seasons.length<60)throw new Error("Incomplete archive: "+queens.length+" queens / "+seasons.length+" seasons");
  const queenIds=new Set(queens.map(q=>q.id));if(queenIds.size!==queens.length)throw new Error("Duplicate queen IDs");
  const now=new Date().toISOString(),codes=[...new Set(seasons.map(x=>x.season.franchise))];
  const franchises=codes.map(code=>{const x=LABELS[code];if(!x)throw new Error("Unknown franchise "+code);return{code,name:x[0],region:x[1],sort_order:x[2],source_version:VERSION,updated_at:now};});
  await upsert("drag_race_franchises",franchises,"code");
  const queenRows=queens.map(q=>({id:q.id,name:q.name,aliases:q.aliases??[],origin:q.origin??{},appearances:q.appearances??[],source_url:SOURCE+"/queens/"+q.id+".json",source_version:VERSION,raw_data:q,updated_at:now}));
  await upsert("drag_race_queens",queenRows,"id");
  const seasonRows=seasons.map(({season:s})=>({id:s.id,franchise_code:s.franchise,season_number:s.seasonNumber,year:s.year??null,name:s.name,episode_count:s.episodeCount??0,cast_ids:s.castIds??[],winner_ids:s.winnerIds??[],runner_up_ids:s.runnerUpIds??[],source_url:SOURCE+"/seasons/"+s.id,source_version:VERSION,raw_data:s,updated_at:now}));
  await upsert("drag_race_seasons",seasonRows,"id");
  const episodeRows=seasons.flatMap(({episodes})=>(episodes??[]).map(e=>({id:e.id,season_id:e.seasonId,episode_number:e.episodeNumber,title:e.title,lip_sync:e.lipSync??null,source_version:VERSION,raw_data:e,updated_at:now})));
  await upsert("drag_race_episodes",episodeRows,"id");

  // Preserve source facts at Queen/episode granularity. These facts deliberately
  // remain separate from PPE placements: top/bottom/challenge facts are not
  // silently translated into WIN/HIGH/SAFE/LOW/BTM2.
  const queenById=new Map(queens.map(q=>[q.id,q]));
  const factsRows=seasons.flatMap(({season,episodes})=>{
   const castIds:string[]=season.castIds??[];
   return (episodes??[]).flatMap((episode:any)=>{
    const miniWinners=new Set<string>(episode.miniChallenge?.winnerIds??[]);
    const maxiWinners=new Set<string>(episode.maxiChallenge?.winnerIds??[]);
    const topIds=new Set<string>(episode.topIds??[]);
    const bottomIds=new Set<string>(episode.bottomIds??[]);
    const lip=episode.lipSync??null;
    const lipQueens=new Set<string>(lip?.queenIds??[]);
    const lipWinners=new Set<string>(lip?.winnerIds??[]);
    const lipEliminated=new Set<string>(lip?.eliminatedIds??[]);
    return castIds.map(queenId=>{
     const queen=queenById.get(queenId);
     const appearance=(queen?.appearances??[]).find((item:any)=>item.seasonId===season.id);
     const facts={
      mini_challenge_winner:miniWinners.has(queenId),
      maxi_challenge_winner:maxiWinners.has(queenId),
      listed_top:topIds.has(queenId),
      listed_bottom:bottomIds.has(queenId),
      lipsync_participant:lipQueens.has(queenId),
      lipsync_winner:lipWinners.has(queenId),
      lipsync_eliminated:lipEliminated.has(queenId),
      eliminated_this_episode:appearance?.eliminatedEpisodeId===episode.id,
      season_placement:appearance?.placement??null,
      season_quit:appearance?.quit===true,
      season_disqualified:appearance?.disqualified===true,
      season_reentered:appearance?.reentered===true
     };
     return {episode_id:episode.id,season_id:season.id,queen_id:queenId,facts,source_id:SOURCE_ID,source_version:VERSION,updated_at:now};
    });
   });
  });
  await upsert("drag_race_episode_queen_facts",factsRows,"episode_id,queen_id");

  // Generate one official Track Record template per catalog season. Only an
  // explicit source elimination event is translated to ELIM; every other
  // placement remains blank until a reliable source or an editor confirms it.
  const templates=seasons.map(({season,episodes})=>{
   const episodeList=(episodes??[]).map((episode:any)=>({
    number:episode.episodeNumber,
    title:episode.title,
    counts_for_ppe:!/(grand\\s+)?finale/i.test(episode.title??"")
   }));
   const queenList=(season.castIds??[]).map((queenId:string,index:number)=>{
    const queen=queenById.get(queenId);
    const appearance=(queen?.appearances??[]).find((item:any)=>item.seasonId===season.id);
    const results=(episodes??[]).map((episode:any)=>({
     episode:episode.episodeNumber,
     placement:appearance?.eliminatedEpisodeId===episode.id?"ELIM":null,
     facts:{
      mini_challenge_winner:(episode.miniChallenge?.winnerIds??[]).includes(queenId),
      maxi_challenge_winner:(episode.maxiChallenge?.winnerIds??[]).includes(queenId),
      listed_top:(episode.topIds??[]).includes(queenId),
      listed_bottom:(episode.bottomIds??[]).includes(queenId),
      lipsync_participant:(episode.lipSync?.queenIds??[]).includes(queenId),
      lipsync_winner:(episode.lipSync?.winnerIds??[]).includes(queenId),
      lipsync_eliminated:(episode.lipSync?.eliminatedIds??[]).includes(queenId),
      eliminated_this_episode:appearance?.eliminatedEpisodeId===episode.id
     }
    }));
    return {
     id:queenId,
     name:queen?.name??queenId,
     rank:appearance?.placement?String(appearance.placement):null,
     results,
     ppe_episode_numbers:episodeList.filter(ep=>ep.counts_for_ppe).map(ep=>ep.number),
     elimination_episode:appearance?.eliminatedEpisodeId
      ? (episodes??[]).find((ep:any)=>ep.id===appearance.eliminatedEpisodeId)?.episodeNumber??null
      : null,
     elimination_tie_order:index+1
    };
   });
   return {
    id:season.id,
    franchise_code:season.franchise,
    season_number:season.seasonNumber,
    display_title:season.name,
    year:season.year??null,
    season_id:season.id,
    episodes:episodeList,
    queens:queenList,
    source_metadata:{
     source_id:SOURCE_ID,
     source_version:VERSION,
     source_url:SOURCE+"/seasons/"+season.id,
     generated_at:now,
     placement_completeness:"PARTIAL",
     placement_note:"Sono precompilati soltanto gli eventi di eliminazione espliciti. Gli altri placement non sono dedotti da challenge, top/bottom o lipsync e restano modificabili."
    },
    source_version:SOURCE_ID+"@"+VERSION,
    updated_at:now
   };
  });
  await upsert("drag_race_track_record_templates",templates,"id");
  const lips=episodeRows.flatMap(e=>{const s=e.lip_sync as any;if(!s?.song||!Array.isArray(s.queenIds)||s.queenIds.length<2)return[];return[{id:e.id,season_id:e.season_id,episode_id:e.id,song_title:s.song,song_artist:null,queen_ids:s.queenIds,winner_ids:s.winnerIds??[],kind:s.kind??null,preview_url:null,apple_music_url:null,metadata_status:"PENDING",is_eligible:false,source_version:VERSION,raw_data:s,updated_at:now}];});
  await upsert("drag_race_lipsyncs",lips,"id");
  const songs=[...new Set(lips.map(x=>x.song_title))],metadata=new Map<string,any>();
  for(let i=0;i<songs.length;i+=6){const found=await Promise.all(songs.slice(i,i+6).map(async song=>({song,value:await itunes(song)})));for(const x of found)metadata.set(norm(x.song),x.value);}
  const enriched=lips.map(x=>{const m=metadata.get(norm(x.song_title)),artist=m?.artist??null,preview=m?.preview??null;return{...x,song_artist:artist,preview_url:preview,apple_music_url:m?.url??null,metadata_status:!artist?"MISSING_ARTIST":!preview?"MISSING_PREVIEW":"READY",is_eligible:x.queen_ids.length===2&&x.queen_ids.every((id:string)=>queenIds.has(id))&&Boolean(artist&&preview)};});
  await upsert("drag_race_lipsyncs",enriched,"id");
  const eligible=enriched.filter(x=>x.is_eligible).length;
  const {error:se}=await admin.from("drag_race_catalog_sync_state").update({source_version:VERSION,last_synced_at:now,sync_lock_until:null,franchise_count:franchises.length,queen_count:queenRows.length,season_count:seasonRows.length,episode_count:episodeRows.length,lipsync_count:lips.length,eligible_lipsync_count:eligible,updated_at:now}).eq("id",1);
  if(se)throw se;
  return reply({synced:true,sourceVersion:VERSION,franchises:franchises.length,queens:queenRows.length,seasons:seasonRows.length,episodes:episodeRows.length,queenEpisodeFacts:factsRows.length,trackRecordTemplates:templates.length,lipsyncs:lips.length,eligibleLipsyncs:eligible,lastSyncedAt:now});
 }catch(e){await admin.from("drag_race_catalog_sync_state").update({sync_lock_until:null,updated_at:new Date().toISOString()}).eq("id",1);console.error("drag-race-catalog-sync",e);return reply({error:"Catalog sync failed",detail:e instanceof Error?e.message:"Unknown error"},502);}
});
