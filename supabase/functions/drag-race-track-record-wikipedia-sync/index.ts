import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Episode = { number:number; title:string };
type Result = { episode:number; placement:string|null; facts?:Record<string,unknown> };
type Queen = { id:string; name:string; results:Result[]; aliases?:string[] };
type Template = { id:string; franchise_code:string; season_number:number; display_title:string; episodes:Episode[]; queens:Queen[]; source_metadata?:Record<string,unknown> };
type WikiSearchItem = { title:string; pageid:number };
type WikiSearchResponse = { query?:{search?:WikiSearchItem[]} };
type WikiRevisionResponse = { query?:{pages?:Array<{pageid:number;revisions?:Array<{revid:number;timestamp:string}>}>} };
type Cell = { text:string; rowSpan:number; colSpan:number };
type ParsedPlacement = { queenId:string; episode:number; raw:string; code:string };

const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});
const WIKI_API="https://en.wikipedia.org/w/api.php";
const WIKI_AGENT="Renqd/1.0 (https://renqd.app; Drag Race catalog attribution and placement sync)";
const normalize=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"").trim();
const decodeHtml=(value:string)=>value
 .replace(/&nbsp;|&#160;/gi," ")
 .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
 .replace(/&quot;/gi,'"').replace(/&apos;|&#39;/gi,"'")
 .replace(/&#(\d+);/g,(_,n:string)=>String.fromCodePoint(Number(n)))
 .replace(/&#x([0-9a-f]+);/gi,(_,n:string)=>String.fromCodePoint(parseInt(n,16)));
function cellText(html:string){
 return decodeHtml(html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi," ").replace(/<br\s*\/?>/gi," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ")).trim();
}
function parseCells(row:string):Cell[]{
 const cells:Cell[]=[];
 const re=/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
 for(const match of row.matchAll(re)){
  const attrs=match[2]??"";
  const rowSpan=Math.max(1,Number(attrs.match(/\browspan\s*=\s*["']?(\d+)/i)?.[1]??1));
  const colSpan=Math.max(1,Number(attrs.match(/\bcolspan\s*=\s*["']?(\d+)/i)?.[1]??1));
  cells.push({text:cellText(match[3]??""),rowSpan,colSpan});
 }
 return cells;
}
function expandRows(rows:string[]){
 const grid:string[][]=[];
 rows.forEach((row,rowIndex)=>{
  grid[rowIndex]??=[];
  let column=0;
  for(const cell of parseCells(row)){
   while(grid[rowIndex][column]!==undefined)column++;
   for(let r=0;r<cell.rowSpan;r++){
    grid[rowIndex+r]??=[];
    for(let col=0;col<cell.colSpan;col++)grid[rowIndex+r][column+col]=cell.text;
   }
   column+=cell.colSpan;
  }
 });
 return grid;
}
function episodeNumber(value:string){
 const text=value.trim();
 const match=text.match(/^(?:episode|ep\.?\s*)\s*(\d+)$/i)??text.match(/^(\d+)$/);
 return match?Number(match[1]):null;
}
function placementCode(value:string){
 const text=value.toUpperCase().replace(/\[[^\]]*\]/g,"").replace(/\s+/g," ").trim();
 if(/^TOP2\b/.test(text))return "TOP2";
 if(/^HIGH\s+TEAM\b/.test(text))return "HIGH TEAM";
 if(/^HIGH\b/.test(text))return "HIGH";
 if(/^WIN\b/.test(text))return "WIN";
 if(/^SAFE\b/.test(text))return "SAFE";
 if(/^LOW\b/.test(text))return "LOW";
 if(/^BTM2\b/.test(text))return "BTM2";
 if(/^BTM\b/.test(text))return "BTM";
 if(/^ELIM\b/.test(text))return "ELIM";
 return null;
}
function parseProgressTable(html:string,episodes:Episode[],queens:Queen[]):ParsedPlacement[]{
 const knownEpisodes=new Set(episodes.map(x=>x.number));
 const queenLookup=new Map<string,Queen|null>();
 for(const queen of queens){
  for(const name of [queen.name,...(queen.aliases??[])]){
   const key=normalize(name);
   if(!key)continue;
   queenLookup.set(key,queenLookup.has(key)&&queenLookup.get(key)?.id!==queen.id?null:queen);
  }
 }
 const tables=[...html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)]
  .filter(match=>/\bclass\s*=\s*["'][^"']*wikitable/i.test(match[1]??""));
 for(const table of tables){
  const rawRows=[...(table[2]??"").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(x=>x[1]??"");
  const grid=expandRows(rawRows);
  const headerIndex=grid.findIndex(row=>row.some(cell=>/contestant|queen|drag name/i.test(cell??""))&&row.filter(cell=>cell!==undefined&&episodeNumber(cell)!==null).length>=2);
  if(headerIndex<0)continue;
  const header=grid[headerIndex]??[];
  const nameColumn=header.findIndex(cell=>/contestant|queen|drag name/i.test(cell??""));
  const episodeColumns=header.map((cell,index)=>({index,number:cell?episodeNumber(cell):null})).filter((x):x is {index:number;number:number}=>x.number!==null&&knownEpisodes.has(x.number));
  if(nameColumn<0||episodeColumns.length<2)continue;
  const placements:ParsedPlacement[]=[];
  for(const row of grid.slice(headerIndex+1)){
   const rawName=row[nameColumn]??"";
   const queen=queenLookup.get(normalize(rawName));
   if(!queen)continue;
   for(const column of episodeColumns){
    const raw=row[column.index]??"";
    const code=placementCode(raw);
    if(code)placements.push({queenId:queen.id,episode:column.number,raw,code});
   }
  }
  return placements;
 }
 return [];
}
function candidates(template:Template){
 const n=template.season_number;
 const specific:Record<string,string>={
  US:`RuPaul's Drag Race season ${n}`,
  AS:`RuPaul's Drag Race All Stars season ${n}`,
  UK:`RuPaul's Drag Race UK series ${n}`,
  UKVTW:`RuPaul's Drag Race UK vs the World series ${n}`,
  DU:`RuPaul's Drag Race Down Under season ${n}`,
  CA:`Canada's Drag Race season ${n}`
 };
 const name=template.display_title.replace(/\bSeason\b/i,"season");
 return [...new Set([specific[template.franchise_code],name].filter((x):x is string=>Boolean(x)))];
}
async function searchPage(candidate:string):Promise<WikiSearchItem|null>{
 const url=new URL(WIKI_API);
 url.searchParams.set("action","query");url.searchParams.set("list","search");
 url.searchParams.set("srsearch",candidate);url.searchParams.set("srnamespace","0");
 url.searchParams.set("srlimit","8");url.searchParams.set("format","json");url.searchParams.set("formatversion","2");
 const response=await fetch(url,{headers:{"User-Agent":WIKI_AGENT},signal:AbortSignal.timeout(10000)});
 if(!response.ok)return null;
 const data=await response.json() as WikiSearchResponse;
 const results=data.query?.search??[];
 return results.find(item=>normalize(item.title)===normalize(candidate))??null;
}
async function pageRevision(title:string){
 const url=new URL(WIKI_API);
 url.searchParams.set("action","query");url.searchParams.set("prop","revisions");
 url.searchParams.set("rvprop","ids|timestamp");url.searchParams.set("titles",title);
 url.searchParams.set("format","json");url.searchParams.set("formatversion","2");
 const response=await fetch(url,{headers:{"User-Agent":WIKI_AGENT},signal:AbortSignal.timeout(10000)});
 if(!response.ok)return null;
 const data=await response.json() as WikiRevisionResponse;
 return data.query?.pages?.[0]?.revisions?.[0]??null;
}
async function fetchPageHtml(title:string){
 const path=encodeURIComponent(title.replace(/ /g,"_"));
 const response=await fetch("https://en.wikipedia.org/api/rest_v1/page/html/"+path,{headers:{"User-Agent":WIKI_AGENT},signal:AbortSignal.timeout(12000)});
 return response.ok?await response.text():null;
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!service)return reply({error:"Server configuration unavailable"},500);
 const auth=req.headers.get("Authorization");if(!auth)return reply({error:"Authentication required"},401);
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:userData,error:userError}=await userClient.auth.getUser();
 if(userError||!userData.user)return reply({error:"Authentication required"},401);
 const {data:profile}=await userClient.from("profiles").select("role,status").eq("id",userData.user.id).maybeSingle();
 if(profile?.status!=="APPROVED"||!["OWNER","ADMIN","MODERATOR"].includes(String(profile.role)))return reply({error:"Staff access required"},403);
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 let limit=5;try{const body=await req.json();if(Number.isInteger(body?.limit))limit=Math.max(1,Math.min(5,body.limit));}catch{}
 const {data:allTemplates,error:templateError}=await admin.from("drag_race_track_record_templates").select("id,franchise_code,season_number,display_title,episodes,queens,source_metadata").order("franchise_code").order("season_number");
 if(templateError)return reply({error:"Unable to load Track Record templates"},503);
 const templates=(allTemplates??[]) as Template[];
 const retryBefore=Date.now()-30*24*60*60*1000;
 const pending=templates.filter(template=>{const attempted=Date.parse(String((template.source_metadata as Record<string,unknown>|undefined)?.wikimedia_attempted_at??""));return !Number.isFinite(attempted)||attempted<retryBefore;});
 const batch=pending.slice(0,limit);
 const {data:rules,error:rulesError}=await admin.from("drag_race_track_record_scoring_rules").select("placement_key,label").order("sort_order");
 if(rulesError)return reply({error:"Unable to load PPE scoring rules"},503);
 const keyByLabel=new Map<string,string>();
 for(const rule of rules??[]){const key=normalize(String(rule.label??"").toUpperCase());if(key&&!keyByLabel.has(key))keyByLabel.set(key,rule.placement_key);}
 let processed=0,updated=0,placementsAdded=0,notFound=0,noTable=0,noMatches=0;
 for(const template of batch){
  processed++;
  const attemptedAt=new Date().toISOString();
  let page:WikiSearchItem|null=null;
  for(const candidate of candidates(template)){page=await searchPage(candidate);if(page)break;}
  const previous=(template.source_metadata??{}) as Record<string,unknown>;
  if(!page){
   notFound++;
   const metadata={...previous,wikimedia_status:"PAGE_NOT_FOUND",wikimedia_attempted_at:attemptedAt};
   const {error}=await admin.from("drag_race_track_record_templates").update({source_metadata:metadata,updated_at:attemptedAt}).eq("id",template.id);
   if(error)console.error("Track Record Wikipedia status update",template.id,error);
   continue;
  }
  const [html,revision]=await Promise.all([fetchPageHtml(page.title),pageRevision(page.title)]);
  const parsed=html?parseProgressTable(html,template.episodes??[],template.queens??[]):[];
  if(!parsed.length){
   noTable++;
   const metadata={...previous,wikimedia_status:"NO_PROGRESS_TABLE",wikimedia_attempted_at:attemptedAt,wikimedia_page_title:page.title,wikimedia_source_url:"https://en.wikipedia.org/wiki/"+encodeURIComponent(page.title.replace(/ /g,"_"))};
   const {error}=await admin.from("drag_race_track_record_templates").update({source_metadata:metadata,updated_at:attemptedAt}).eq("id",template.id);
   if(error)console.error("Track Record Wikipedia status update",template.id,error);
   continue;
  }
  const bottomCounts=new Map<number,number>();
  for(const item of parsed)if(item.code==="BTM")bottomCounts.set(item.episode,(bottomCounts.get(item.episode)??0)+1);
  const byQueen=new Map<string,Map<number,{key:string|null;raw:string}>>();
  for(const item of parsed){
   const code=item.code==="BTM"?(bottomCounts.get(item.episode)===2?"BTM2":null):item.code;
   const key=code?keyByLabel.get(normalize(code)):undefined;
   const episodesMap=byQueen.get(item.queenId)??new Map<number,{key:string|null;raw:string}>();
   episodesMap.set(item.episode,{key:key??null,raw:item.raw});byQueen.set(item.queenId,episodesMap);
  }
  let added=0,matched=0;
  const queens=template.queens.map(queen=>{
   const source=byQueen.get(queen.id);if(!source)return queen;
   matched++;
   const results=queen.results.map(result=>{
    const found=source.get(result.episode);if(!found)return result;
    const placement=result.placement??found.key;
    if(!result.placement&&found.key)added++;
    return {...result,placement,facts:{...(result.facts??{}),wikipedia_raw_placement:found.raw}};
   });
   return {...queen,results};
  });
  if(!matched){
   noMatches++;
   const metadata={...previous,wikimedia_status:"NO_MATCHING_QUEENS",wikimedia_attempted_at:attemptedAt,wikimedia_page_title:page.title,wikimedia_source_url:"https://en.wikipedia.org/wiki/"+encodeURIComponent(page.title.replace(/ /g,"_"))};
   const {error}=await admin.from("drag_race_track_record_templates").update({source_metadata:metadata,updated_at:attemptedAt}).eq("id",template.id);
   if(error)console.error("Track Record Wikipedia status update",template.id,error);
   continue;
  }
  placementsAdded+=added;
  const sourceUrl=revision?.revid?("https://en.wikipedia.org/w/index.php?title="+encodeURIComponent(page.title)+"&oldid="+revision.revid):("https://en.wikipedia.org/wiki/"+encodeURIComponent(page.title.replace(/ /g,"_")));
  const metadata={...previous,wikimedia_status:"IMPORTED",wikimedia_attempted_at:attemptedAt,wikimedia_page_title:page.title,wikimedia_source_url:sourceUrl,wikimedia_revision_id:revision?.revid??null,wikimedia_revision_timestamp:revision?.timestamp??null,wikimedia_author:"Wikipedia contributors",wikimedia_modifications:"Placement labels were normalized to Renqd PPE keys. BTM was converted to BTM2 only when exactly two matched contestants were marked BTM in the episode.",wikimedia_license:"CC BY-SA 4.0",wikimedia_license_url:"https://creativecommons.org/licenses/by-sa/4.0/"};
  const {error}=await admin.from("drag_race_track_record_templates").update({queens,source_metadata:metadata,updated_at:attemptedAt}).eq("id",template.id);
  if(error)console.error("Track Record Wikipedia template update",template.id,error);else updated++;
 }
 const remaining=Math.max(0,pending.length-processed);
 return reply({synced:true,processed,updated,placementsAdded,notFound,noTable,noMatches,remaining,source:"Wikipedia / MediaWiki API",license:"CC BY-SA 4.0"});
});
