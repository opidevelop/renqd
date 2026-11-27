import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export const runtime="nodejs";
type CommonsImageInfo={url?:string;thumburl?:string;descriptionurl?:string;thumbwidth?:number;thumbheight?:number;extmetadata?:{LicenseShortName?:{value?:string};ImageDescription?:{value?:string}}};
type CommonsPage={title?:string;imageinfo?:CommonsImageInfo[]};
type Candidate={title:string;info:CommonsImageInfo};
const headers={"Cache-Control":"private, max-age=3600, s-maxage=604800, stale-while-revalidate=86400"};

type FandomImage={title:string;url?:string;thumburl?:string;descriptionurl?:string};
async function fandomPageImages(title:string):Promise<FandomImage[]>{
 try{
  const api="https://rupaulsdragrace.fandom.com/api.php?";
  const page=new URLSearchParams({action:"query",titles:title,prop:"images",imlimit:"500",format:"json"});
  const response=await fetch(api+page.toString(),{headers:{"User-Agent":"Renqd/1.0 (https://renqd.app)","Accept":"application/json"},next:{revalidate:86400},signal:AbortSignal.timeout(12000)});
  if(!response.ok)return[];
  const payload=await response.json() as {query?:{pages?:Record<string,{images?:{title:string}[]}>}};
  const files=Object.values(payload.query?.pages??{}).flatMap(x=>x.images??[]).map(x=>x.title).filter(x=>/^File:/i.test(x));
  const matches=files.filter(x=>/\.jpe?g$|\.png$|\.webp$/i.test(x)).slice(0,80);
  if(!matches.length)return[];
  const info=new URLSearchParams({action:"query",titles:matches.join("|"),prop:"imageinfo",iiprop:"url",iiurlwidth:"900",format:"json"});
  const detail=await fetch(api+info.toString(),{headers:{"User-Agent":"Renqd/1.0 (https://renqd.app)"},next:{revalidate:86400},signal:AbortSignal.timeout(12000)});
  if(!detail.ok)return[];
  const data=await detail.json() as {query?:{pages?:Record<string,{title:string;imageinfo?:{url?:string;thumburl?:string;descriptionurl?:string}[]}>}};
  return Object.values(data.query?.pages??{}).flatMap(x=>(x.imageinfo??[]).map(i=>({title:x.title,url:i.url,thumburl:i.thumburl,descriptionurl:i.descriptionurl})));
 }catch{return[];}
}
const fileNorm=(value:string)=>norm(value.replace(/^File:/i,"").replace(/\.[^.]+$/,""));

const escapeXml=(value:string)=>value.replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]??c));
const norm=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
const stripHtml=(value:string)=>value.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
function allowedLicense(value:string){const license=value.toLowerCase();if(/non.?commercial|no derivatives|\bnd\b|\bnc\b|fair use|all rights reserved/.test(license))return false;return license.startsWith("cc0")||license.includes("public domain")||/^cc by(?:-sa)?\b/.test(license)||license.startsWith("gfdl");}
async function commonsCandidates(params:URLSearchParams):Promise<Candidate[]>{try{const response=await fetch("https://commons.wikimedia.org/w/api.php?"+params.toString(),{headers:{"User-Agent":"Renqd/1.0 (https://renqd.app)"},next:{revalidate:604800},signal:AbortSignal.timeout(10000)});if(!response.ok)return[];const payload=await response.json() as {query?:{pages?:Record<string,CommonsPage>}};return Object.values(payload.query?.pages??{}).flatMap(page=>(page.imageinfo??[]).map(info=>({title:page.title??"",info})));}catch{return[];}}
function chooseImage(candidates:Candidate[],name:string,categoryMatch=false){const target=norm(name);const ranked=candidates.map(candidate=>{const {title,info}=candidate,license=info.extmetadata?.LicenseShortName?.value??"",description=stripHtml(info.extmetadata?.ImageDescription?.value??"");if(!allowedLicense(license)||!(info.thumburl||info.url))return{candidate,score:-1};const titleMatch=norm(title).includes(target),descriptionMatch=norm(description).includes(target);if(!categoryMatch&&!titleMatch&&!descriptionMatch)return{candidate,score:-1};const portraitRatio=info.thumbwidth&&info.thumbheight?info.thumbheight/info.thumbwidth:0;let score=(titleMatch?6:0)+(descriptionMatch?3:0)+(portraitRatio>=1.05?2:0)+(/portrait|headshot/i.test(title)?2:0)-(/\b(and|with|group|together)\b/i.test(title)?3:0);if(categoryMatch&&!titleMatch&&!descriptionMatch)score=portraitRatio>=1.05?1:0;return{candidate,score};}).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score);const best=ranked[0]?.candidate;if(!best)return null;return{imageUrl:best.info.thumburl??best.info.url??null,sourceUrl:best.info.descriptionurl??null};}
async function findImage(name:string){const category=new URLSearchParams({action:"query",generator:"categorymembers",gcmtitle:"Category:"+name,gcmtype:"file",gcmlimit:"50",prop:"imageinfo",iiprop:"url|extmetadata",iiurlwidth:"640",format:"json"});const fromCategory=chooseImage(await commonsCandidates(category),name,true);if(fromCategory?.imageUrl)return fromCategory;const search=new URLSearchParams({action:"query",generator:"search",gsrsearch:'filetype:bitmap "'+name+'" drag queen',gsrnamespace:"6",gsrlimit:"30",prop:"imageinfo",iiprop:"url|extmetadata",iiurlwidth:"640",format:"json"});return chooseImage(await commonsCandidates(search),name,false);}
function fallback(name:string){const initials=name.split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase();return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f9e5ef"/><stop offset="1" stop-color="#ead7e7"/></linearGradient></defs><rect width="600" height="600" rx="48" fill="url(#g)"/><circle cx="300" cy="250" r="150" fill="#fff" opacity=".42"/><text x="300" y="310" text-anchor="middle" font-family="Arial,sans-serif" font-size="145" font-weight="700" fill="#a33e72">${initials}</text><text x="300" y="510" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#815a70">${escapeXml(name.slice(0,36))}</text></svg>`;}
export async function GET(request:Request){
 const db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)return new NextResponse("Unauthorized",{status:401});
 const {data:profile}=await db.from("profiles").select("status").eq("id",user.id).maybeSingle();if(profile?.status!=="APPROVED")return new NextResponse("Forbidden",{status:403});
 const params=new URL(request.url).searchParams,id=params.get("id"),source=params.get("source")==="1";if(!id||id.length>180)return new NextResponse("Bad request",{status:400});
 const {data:queen}=await db.from("drag_race_queens").select("name,image_url,appearances").eq("id",id).maybeSingle();if(!queen)return new NextResponse("Not found",{status:404});
 if(source){const image=await findImage(queen.name);return NextResponse.redirect(image?.sourceUrl??("https://commons.wikimedia.org/w/index.php?search="+encodeURIComponent('"'+queen.name+'" drag queen')),{headers});}

 const appearances=(queen.appearances??[]) as {seasonId?:string}[];
 const seasonIds=[...new Set(appearances.map(x=>x.seasonId).filter((x):x is string=>Boolean(x)))];
 if(seasonIds.length){
  const {data:seasons}=await db.from("drag_race_seasons").select("id,franchise_code,season_number,year").in("id",seasonIds).order("year",{ascending:false});
  const latest=seasons?.[0];
  if(latest){
   const {data:franchise}=await db.from("drag_race_franchises").select("name").eq("code",latest.franchise_code).maybeSingle();
   if(franchise?.name){
    const title=franchise.name.replace(/[’‘]/g,"'")+" (Season "+latest.season_number+")";
    const images=await fandomPageImages(title),target=norm(queen.name);
    const match=images.map(image=>({...image,score:fileNorm(image.title).includes(target)?(fileNorm(image.title).includes("promo")?3:2):0})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score)[0];
    if(match?.thumburl||match?.url){
     const imageUrl=match.thumburl??match.url!;
     if(source)return NextResponse.redirect(match.descriptionurl??"https://rupaulsdragrace.fandom.com/wiki/"+encodeURIComponent(title.replace(/ /g,"_")),{headers});
     return NextResponse.redirect(imageUrl,{headers});
    }
   }
  }
 }
 if(source){const image=await findImage(queen.name);return NextResponse.redirect(image?.sourceUrl??("https://commons.wikimedia.org/w/index.php?search="+encodeURIComponent('"'+queen.name+'" drag queen')),{headers});}

 const image=await findImage(queen.name);if(image?.imageUrl)return NextResponse.redirect(image.imageUrl,{headers});
 return new NextResponse(fallback(queen.name),{status:200,headers:{...headers,"Content-Type":"image/svg+xml; charset=utf-8"}});
}
