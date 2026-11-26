import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export const runtime="nodejs";
type CommonsImageInfo={url?:string;thumburl?:string;descriptionurl?:string;extmetadata?:{LicenseShortName?:{value?:string};ImageDescription?:{value?:string}}};
type CommonsPage={title?:string;imageinfo?:CommonsImageInfo[]};
const headers={"Cache-Control":"private, max-age=3600, s-maxage=604800, stale-while-revalidate=86400"};
const escapeXml=(value:string)=>value.replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]??c));
const norm=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
const stripHtml=(value:string)=>value.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
function allowedLicense(value:string){const license=value.toLowerCase();if(/non.?commercial|no derivatives|\bnd\b|\bnc\b|fair use|all rights reserved/.test(license))return false;return license.startsWith("cc0")||license.includes("public domain")||/^cc by(?:-sa)?\b/.test(license)||license.startsWith("gfdl");}
async function findImage(name:string){
 const query=encodeURIComponent(`filetype:bitmap "${name}" drag queen`),url=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json`;
 const response=await fetch(url,{headers:{"User-Agent":"Renqd/1.0 (https://renqd.app)"},next:{revalidate:604800},signal:AbortSignal.timeout(10000)});if(!response.ok)return null;
 const payload=await response.json() as {query?:{pages?:Record<string,CommonsPage>}},target=norm(name);
 const candidates=Object.values(payload.query?.pages??{}).flatMap(page=>(page.imageinfo??[]).map(info=>({title:page.title??"",info})));
 const match=candidates.filter(({title,info})=>{const license=info.extmetadata?.LicenseShortName?.value??"",description=stripHtml(info.extmetadata?.ImageDescription?.value??"");return allowedLicense(license)&&Boolean(info.thumburl||info.url)&&(norm(title).includes(target)||norm(description).includes(target));}).sort((a,b)=>Number(Boolean(b.info.thumburl))-Number(Boolean(a.info.thumburl)))[0];
 return match?{imageUrl:match.info.thumburl??match.info.url??null,sourceUrl:match.info.descriptionurl??null}:null;
}
function fallback(name:string){const initials=name.split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase();return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f9e5ef"/><stop offset="1" stop-color="#ead7e7"/></linearGradient></defs><rect width="600" height="600" rx="48" fill="url(#g)"/><circle cx="300" cy="250" r="150" fill="#fff" opacity=".42"/><text x="300" y="310" text-anchor="middle" font-family="Arial,sans-serif" font-size="145" font-weight="700" fill="#a33e72">${initials}</text><text x="300" y="510" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#815a70">${escapeXml(name.slice(0,36))}</text></svg>`;}
export async function GET(request:Request){
 const db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)return new NextResponse("Unauthorized",{status:401});
 const {data:profile}=await db.from("profiles").select("status").eq("id",user.id).maybeSingle();if(profile?.status!=="APPROVED")return new NextResponse("Forbidden",{status:403});
 const params=new URL(request.url).searchParams,id=params.get("id"),source=params.get("source")==="1";if(!id||id.length>180)return new NextResponse("Bad request",{status:400});
 const {data:queen}=await db.from("drag_race_queens").select("name,image_url").eq("id",id).maybeSingle();if(!queen)return new NextResponse("Not found",{status:404});
 if(source){const image=await findImage(queen.name);return NextResponse.redirect(image?.sourceUrl??("https://commons.wikimedia.org/w/index.php?search="+encodeURIComponent(`"${queen.name}" drag queen`)),{headers});}
 if(queen.image_url&&/^https:\/\//.test(queen.image_url))return NextResponse.redirect(queen.image_url,{headers});
 try{const image=await findImage(queen.name);if(image?.imageUrl)return NextResponse.redirect(image.imageUrl,{headers});}catch{}
 return new NextResponse(fallback(queen.name),{status:200,headers:{...headers,"Content-Type":"image/svg+xml; charset=utf-8"}});
}