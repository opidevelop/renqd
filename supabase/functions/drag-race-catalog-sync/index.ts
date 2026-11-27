import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseLipsyncTables } from "./wikipedia-parser.js";

const VERSION="1.1.1";
const SOURCE_ID="@tkalejandro/drag-race-mcp";
const PACKAGE="https://registry.npmjs.org/@tkalejandro/drag-race-mcp/-/drag-race-mcp-1.1.1.tgz";
const SOURCE="https://github.com/tkalejandro/drag-race-mcp/tree/main/src/data";
const LABELS:Record<string,[string,string,number]>={
US:["RuPaul’s Drag Race","North America",1],AS:["RuPaul’s Drag Race All Stars","North America",2],UK:["RuPaul’s Drag Race UK","Europe",3],UKVTW:["RuPaul’s Drag Race UK vs the World","International",4],DE:["Drag Race Germany","Europe",5],FR:["Drag Race France","Europe",6],NL:["Drag Race Holland","Europe",7],BE:["Drag Race Belgique","Europe",8],SE:["Drag Race Sverige","Europe",9],ES:["Drag Race España","Europe",10],ESAS:["Drag Race España All Stars","Europe",11],GAS:["RuPaul’s Drag Race Global All Stars","International",12],CA:["Canada’s Drag Race","North America",13],CVTW:["Canada’s Drag Race vs the World","International",14],CAS:["Canada’s Drag Race All Stars","North America",15],DU:["Drag Race Down Under","Oceania",16],DUVTW:["Drag Race Down Under vs the World","International",17],TH:["Drag Race Thailand","Asia",18],PH:["Drag Race Philippines","Asia",19],PHSR:["Drag Race Philippines: Slaysian Royale","Asia",20],IT:["Drag Race Italia","Europe",21],BR:["Drag Race Brasil","South America",22],MX:["Drag Race México","North America",23],MXLR:["Drag Race México: Latina Royale","International",24]};
type ChallengeSource={name:string;winnerIds:string[]};
type LipSyncSource={song:string;queenIds:string[];winnerIds:string[];eliminatedIds?:string[];kind?:string};
type EpisodeSource={id:string;seasonId:string;episodeNumber:number;title:string;miniChallenge?:ChallengeSource;maxiChallenge?:ChallengeSource;topIds?:string[];bottomIds?:string[];lipSync?:LipSyncSource};
type QueenAppearanceSource={seasonId:string;placement:number;eliminatedEpisodeId?:string;disqualified?:boolean;quit?:boolean;reentered?:boolean};
type QueenSource={id:string;name:string;aliases?:string[];origin?:Record<string,unknown>;appearances?:QueenAppearanceSource[]};
type SeasonSource={id:string;franchise:string;seasonNumber:number;year:number;name:string;episodeCount:number;castIds:string[];winnerIds?:string[];runnerUpIds?:string[]};
type SeasonPack={season?:SeasonSource;episodes?:EpisodeSource[]};
type ItunesMatch={artist:string;preview:string|null;url:string|null};
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"content-type":"application/json"}});
const field=(b:Uint8Array,s:number,n:number)=>new TextDecoder().decode(b.slice(s,s+n)).replace(/\0.*$/s,"").trim();
function tarFiles(b:Uint8Array){const out:{path:string;data:Uint8Array}[]=[];let o=0;while(o+512<=b.length){const h=b.slice(o,o+512);if(h.every(x=>x===0))break;const name=field(h,0,100),prefix=field(h,345,155),path=prefix?prefix+"/"+name:name,size=parseInt(field(h,124,12)||"0",8),type=String.fromCharCode(h[156]||48),start=o+512,end=start+size;if((type==="0"||type==="\0"||type==="7")&&end<=b.length&&path.endsWith(".json"))out.push({path,data:b.slice(start,end)});o=start+Math.ceil(size/512)*512;}return out;}
const norm=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
async function itunes(song:string,artist?:string|null):Promise<ItunesMatch|null>{try{const term=[song,artist].filter(Boolean).join(" ");const p=new URLSearchParams({term,entity:"song",limit:"50",country:"US"});const r=await fetch("https://itunes.apple.com/search?"+p,{signal:AbortSignal.timeout(6500)});if(!r.ok)return null;const d=await r.json() as {results?:Array<{trackName?:string;artistName?:string;previewUrl?:string;trackViewUrl?:string}>};const m=(d.results??[]).filter(x=>x.trackName&&x.artistName&&norm(x.trackName)===norm(song)&&(!artist||norm(x.artistName)===norm(artist)));const artists=[...new Set(m.map(x=>x.artistName!))];if(artists.length!==1)return null;const chosen=m.find(x=>x.previewUrl)??m[0];return{artist:artists[0],preview:chosen.previewUrl??null,url:chosen.trackViewUrl??null};}catch{return null;}}
let admin:ReturnType<typeof createClient>|null=null;
async function upsert(table:string,rows:Record<string,unknown>[],key:string){if(!admin)throw new Error("Database client unavailable");for(let i=0;i<rows.length;i+=100){const {error}=await admin.from(table).upsert(rows.slice(i,i+100),{onConflict:key});if(error)throw error;}}

type WikiLipRow={episode:number;songTitle:string;songArtist:string|null;queenIds:string[];rawRow:string[]};
type WikiSeasonResult={sectionFound:boolean;title:string;url:string;revisionId:string;rows:WikiLipRow[]};
type ExistingLipsyncRow={id:string;season_id:string;episode_id:string;song_title:string;song_artist:string|null;queen_ids:string[];winner_ids:string[];kind:string|null;preview_url:string|null;apple_music_url:string|null;metadata_status:string;is_eligible:boolean;source_version:string;raw_data:Record<string,unknown>|null};
const wikiTitle=(name:string)=>name.replace(/ Season ([0-9]+)$/i," season $1").replace(/ Series ([0-9]+)$/i," series $1");
async function wikipediaSeason(pack:SeasonPack,queens:QueenSource[]):Promise<WikiSeasonResult|null>{
 if(!pack.season||!pack.episodes)return null;
 const title=wikiTitle(pack.season.name),endpoint=new URL("https://en.wikipedia.org/w/api.php");
 endpoint.searchParams.set("action","parse");endpoint.searchParams.set("page",title);endpoint.searchParams.set("prop","sections");endpoint.searchParams.set("format","json");endpoint.searchParams.set("formatversion","2");
 const headers={"User-Agent":"Renqd/1.0 (https://renqd.app)","Accept":"application/json"};
 const metaResponse=await fetch(endpoint,{headers,signal:AbortSignal.timeout(10000)});if(!metaResponse.ok)return null;
 const meta=await metaResponse.json() as {parse?:{title?:string;revid?:number;sections?:Array<{line:string;index:string}>}};
 if(!meta.parse)return null;
 const section=meta.parse.sections?.find(item=>/lip.?sync/i.test(item.line)),pageTitle=meta.parse.title??title,pageUrl="https://en.wikipedia.org/wiki/"+encodeURIComponent(pageTitle.replace(/ /g,"_"));
 if(!section)return{sectionFound:false,title:pageTitle,url:pageUrl,revisionId:String(meta.parse.revid??"unknown"),rows:[]};
 const contentUrl=new URL(endpoint);contentUrl.searchParams.set("prop","text");contentUrl.searchParams.set("section",section.index);
 const contentResponse=await fetch(contentUrl,{headers,signal:AbortSignal.timeout(10000)});
 if(!contentResponse.ok)return{sectionFound:true,title:pageTitle,url:pageUrl,revisionId:String(meta.parse.revid??"unknown"),rows:[]};
 const content=await contentResponse.json() as {parse?:{text?:string}},cast=queens.filter(queen=>(pack.season?.castIds??[]).includes(queen.id));
 const rows=parseLipsyncTables(content.parse?.text??"",pack.episodes.map(episode=>({number:episode.episodeNumber})),cast) as WikiLipRow[];
 return{sectionFound:true,title:pageTitle,url:pageUrl,revisionId:String(meta.parse.revid??"unknown"),rows};
}
async function wikipediaLipsyncCatalog(seasons:SeasonPack[],queens:QueenSource[]){
 const rows:Array<WikiLipRow&{seasonId:string;episodeId:string;pageTitle:string;sourceUrl:string;revisionId:string}>=[];
 let sections=0,errors=0;
 for(let index=0;index<seasons.length;index+=4){
  const batch=await Promise.all(seasons.slice(index,index+4).map(async pack=>{try{return{pack,result:await wikipediaSeason(pack,queens)};}catch(error){console.warn("Wikipedia season sync",pack.season?.id,error);return{pack,result:null};}}));
  for(const item of batch){const pack=item.pack,result=item.result;if(!pack.season||!result){errors++;continue;}if(!result.sectionFound)continue;sections++;const episodeByNumber=new Map((pack.episodes??[]).map(episode=>[episode.episodeNumber,episode.id]));for(const row of result.rows){const episodeId=episodeByNumber.get(row.episode);if(episodeId&&row.queenIds.length===2)rows.push({...row,seasonId:pack.season.id,episodeId,pageTitle:result.title,sourceUrl:result.url,revisionId:result.revisionId});}}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 return{rows,sections,errors};
}
const slug=(value:string)=>norm(value).slice(0,36)||"song";
const lipKey=(row:{season_id:string;episode_id:string;song_title:string;queen_ids:string[]})=>[row.season_id,row.episode_id,norm(row.song_title),[...(row.queen_ids??[])].sort().join(",")].join("|");

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{status:200,headers:corsHeaders});
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
  const queens:QueenSource[]=[],packs=new Map<string,SeasonPack>();
  for(const f of tarFiles(tar)){const path=f.path.replace(/^package\//,"");if(path.startsWith("dist/data/queens/")){queens.push(JSON.parse(new TextDecoder().decode(f.data)) as QueenSource);continue;}if(path.startsWith("dist/data/seasons/")){const parts=path.split("/"),id=parts[3];if(!id)continue;const pack=packs.get(id)??{};const v=JSON.parse(new TextDecoder().decode(f.data)) as SeasonSource|EpisodeSource[];if(parts[4]==="season.json")pack.season=v as SeasonSource;if(parts[4]==="episodes.json")pack.episodes=v as EpisodeSource[];packs.set(id,pack);}}
  const seasons=[...packs.values()].filter((x):x is {season:SeasonSource;episodes:EpisodeSource[]}=>Boolean(x.season&&Array.isArray(x.episodes)));if(queens.length<250||seasons.length<60)throw new Error("Incomplete archive: "+queens.length+" queens / "+seasons.length+" seasons");
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
  const queenById=new Map<string,QueenSource>(queens.map(q=>[q.id,q]));
  const factsRows=seasons.flatMap(({season,episodes})=>{
   const castIds:string[]=season.castIds??[];
   return (episodes??[]).flatMap((episode:EpisodeSource)=>{
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
     const appearance=(queen?.appearances??[]).find((item:QueenAppearanceSource)=>item.seasonId===season.id);
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

  // Track Record templates contain season structure only. Competitive outcomes
  // (placements, winners, eliminations and challenge/lipsync results) are never copied.
  const templates=seasons.map(({season,episodes})=>{
   const episodeList=(episodes??[]).map((episode:EpisodeSource)=>({
    number:episode.episodeNumber,
    title:episode.title,
    counts_for_ppe:!/(grand\s+)?finale/i.test(episode.title??""),
    mini_challenge:episode.miniChallenge?.name??null,
    maxi_challenge:episode.maxiChallenge?.name??null,
    lip_sync_song:episode.lipSync?.song??null
   }));
   const queenList=(season.castIds??[]).map((queenId:string)=>{
    const queen=queenById.get(queenId);
    return {
     id:queenId,
     name:queen?.name??queenId,
     winner:false,
     results:episodeList.map(ep=>({episode:ep.number,placement:null})),
     ppe_episode_numbers:episodeList.filter(ep=>ep.counts_for_ppe).map(ep=>ep.number)
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
     placement_mode:"MANUAL"
    },
    source_version:SOURCE_ID+"@"+VERSION,
    updated_at:now
   };
  });
  await upsert("drag_race_track_record_templates",templates,"id");
  const lips=episodeRows.flatMap(e=>{const s=e.lip_sync as LipSyncSource|null;if(!s?.song||!Array.isArray(s.queenIds)||s.queenIds.length<2)return[];return[{id:e.id,season_id:e.season_id,episode_id:e.id,song_title:s.song,song_artist:null,queen_ids:s.queenIds,winner_ids:s.winnerIds??[],kind:s.kind??null,preview_url:null,apple_music_url:null,metadata_status:"PENDING",is_eligible:false,source_version:VERSION,raw_data:s,updated_at:now}];});
  await upsert("drag_race_lipsyncs",lips,"id");
  const songs=[...new Set(lips.map(x=>x.song_title))],metadata=new Map<string,ItunesMatch|null>();
  for(let i=0;i<songs.length;i+=6){const found=await Promise.all(songs.slice(i,i+6).map(async song=>({song,value:await itunes(song)})));for(const x of found)metadata.set(norm(x.song),x.value);}
  const enriched=lips.map(x=>{const m=metadata.get(norm(x.song_title)),artist=m?.artist??null,preview=m?.preview??null;return{...x,song_artist:artist,preview_url:preview,apple_music_url:m?.url??null,metadata_status:!artist?"MISSING_ARTIST":!preview?"MISSING_PREVIEW":"READY",is_eligible:x.queen_ids.length===2&&x.queen_ids.every((id:string)=>queenIds.has(id))&&Boolean(artist&&preview)};});
  await upsert("drag_race_lipsyncs",enriched,"id");
  const {rows:wikiRows,sections:wikiSections,errors:wikiErrors}=await wikipediaLipsyncCatalog(seasons,queens);
  const wikiSongPairs=[...new Map(wikiRows.filter(row=>row.songArtist).map(row=>[norm(row.songTitle)+"|"+norm(row.songArtist??""),{song:row.songTitle,artist:row.songArtist}])).values()];
  const wikiMetadata=new Map<string,ItunesMatch|null>();
  for(let i=0;i<wikiSongPairs.length;i+=6){const matches=await Promise.all(wikiSongPairs.slice(i,i+6).map(async item=>({item,value:await itunes(item.song,item.artist)})));for(const item of matches)wikiMetadata.set(norm(item.item.song)+"|"+norm(item.item.artist??""),item.value);}
  const existingResult=await admin.from("drag_race_lipsyncs").select("id,season_id,episode_id,song_title,song_artist,queen_ids,winner_ids,kind,preview_url,apple_music_url,metadata_status,is_eligible,source_version,raw_data").limit(5000);
  if(existingResult.error)throw existingResult.error;
  const existingLips=(existingResult.data??[]) as unknown as ExistingLipsyncRow[],existingIndex=new Map<string,ExistingLipsyncRow>(existingLips.map(row=>[lipKey(row),row]));
  const wikiUpserts:Record<string,unknown>[]=[];
  for(const item of wikiRows){
   const key=lipKey({season_id:item.seasonId,episode_id:item.episodeId,song_title:item.songTitle,queen_ids:item.queenIds}),old=existingIndex.get(key),match=wikiMetadata.get(norm(item.songTitle)+"|"+norm(item.songArtist??""))??metadata.get(norm(item.songTitle));
   const oldArtist=typeof old?.song_artist==="string"?old.song_artist:null,artist=oldArtist??item.songArtist??match?.artist??null;
   const sourceArtistMismatch=Boolean(oldArtist&&item.songArtist&&norm(oldArtist)!==norm(item.songArtist)),itunesArtistMismatch=Boolean(item.songArtist&&match?.artist&&norm(item.songArtist)!==norm(match.artist)),canUseMatch=!sourceArtistMismatch&&!itunesArtistMismatch;
   const preview=old?.preview_url??(canUseMatch?match?.preview??null:null),appleUrl=old?.apple_music_url??(canUseMatch?match?.url??null:null);
   const raw=old?.raw_data&&typeof old.raw_data==="object"&&!Array.isArray(old.raw_data)?old.raw_data:{},id=old?.id??("WIKI-"+item.seasonId+"-"+item.episodeId+"-"+slug(item.songTitle)+"-"+item.queenIds.map(slug).join("-"));
   const row={id,season_id:item.seasonId,episode_id:item.episodeId,song_title:old?.song_title??item.songTitle,song_artist:artist,queen_ids:old?.queen_ids??item.queenIds,winner_ids:old?.winner_ids??[],kind:old?.kind??null,preview_url:preview,apple_music_url:appleUrl,metadata_status:old?.metadata_status==="READY"?"READY":sourceArtistMismatch||itunesArtistMismatch?"AMBIGUOUS":!artist?"MISSING_ARTIST":!preview?"MISSING_PREVIEW":"READY",is_eligible:item.queenIds.length===2&&item.queenIds.every(id=>queenIds.has(id))&&Boolean(artist&&preview),source_version:(old?.source_version??VERSION)+"+wikipedia-"+item.revisionId,raw_data:{...raw,wikipedia:{page_title:item.pageTitle,source_url:item.sourceUrl,revision_id:item.revisionId,section:"Lip syncs",raw_row:item.rawRow}},updated_at:now};
   wikiUpserts.push(row);existingIndex.set(key,row as ExistingLipsyncRow);
  }
  await upsert("drag_race_lipsyncs",wikiUpserts,"id");
  const {count:totalLipsyncs,error:totalError}=await admin.from("drag_race_lipsyncs").select("id",{count:"exact",head:true}),{count:eligible,error:eligibleError}=await admin.from("drag_race_lipsyncs").select("id",{count:"exact",head:true}).eq("is_eligible",true);
  if(totalError)throw totalError;if(eligibleError)throw eligibleError;
  const {error:se}=await admin.from("drag_race_catalog_sync_state").update({source_version:VERSION,last_synced_at:now,sync_lock_until:null,franchise_count:franchises.length,queen_count:queenRows.length,season_count:seasonRows.length,episode_count:episodeRows.length,lipsync_count:totalLipsyncs??lips.length+wikiUpserts.length,eligible_lipsync_count:eligible??0,updated_at:now}).eq("id",1);
  if(se)throw se;
  return reply({synced:true,sourceVersion:VERSION,wikipedia:{seasonsWithSection:wikiSections,rowsParsed:wikiRows.length,rowsUpserted:wikiUpserts.length,errors:wikiErrors},franchises:franchises.length,queens:queenRows.length,seasons:seasonRows.length,episodes:episodeRows.length,queenEpisodeFacts:factsRows.length,trackRecordTemplates:templates.length,lipsyncs:totalLipsyncs??lips.length+wikiUpserts.length,eligibleLipsyncs:eligible??0,lastSyncedAt:now}); }catch(e){await admin.from("drag_race_catalog_sync_state").update({sync_lock_until:null,updated_at:new Date().toISOString()}).eq("id",1);console.error("drag-race-catalog-sync",e);return reply({error:"Catalog sync failed",detail:e instanceof Error?e.message:"Unknown error"},502);}
});
