import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export const runtime="nodejs";
type CommonsImageInfo={url?:string;thumburl?:string;descriptionurl?:string;extmetadata?:{LicenseShortName?:{value?:string};ImageDescription?:{value?:string}}};
type CommonsPage={title?:string;imageinfo?:CommonsImageInfo[]};
const headers={"Cache-Control":"private, max-age=3600, s-maxage=604800, stale-while-revalidate=86400"};
const escapeXml=(value:string)=>value.replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]??c));
const norm=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
const stripHtml=(value:string)=>value.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
function allowedLicense(value:string){const license=value.toLowerCase();if(/non.?commercial|no derivatives|\bnd\b|\bnc\b|fair use|all rights reserved/.test(license))return false;return license.startsWith("cc0")||license.includes("public domain")||/^cc by(?:-sa)?\b/.test(license)||license.startsWith("gfdl");}
async function findImage(name:string){
 const query=encodeURIComponent(`filetype:bitmap "${name}" logo`),url=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json`;
 const response=await fetch(url,{headers:{"User-Agent":"Renqd/1.0 (https://renqd.app)"},next:{revalidate:604800},signal:AbortSignal.timeout(10000)});if(!response.ok)return null;
 const payload=await response.json() as {query?:{pages?:Record<string,CommonsPage>}},target=norm(name);
 const candidates=Object.values(payload.query?.pages??{}).flatMap(page=>(page.imageinfo??[]).map(info=>({title:page.title??"",info})));
 const match=candidates.filter(({title,info})=>{const license=info.extmetadata?.LicenseShortName?.value??"",description=stripHtml(info.extmetadata?.ImageDescription?.value??"");return allowedLicense(license)&&Boolean(info.thumburl||info.url)&&(norm(title).includes(target)||norm(description).includes(target));}).sort((a,b)=>Number(Boolean(b.info.thumburl))-Number(Boolean(a.info.thumburl)))[0];
 return match?{imageUrl:match.info.thumburl??match.info.url??null,sourceUrl:match.info.descriptionurl??null}:null;
}
function fallback(code:string,name:string){const initials=code.replace(/[^A-Z0-9]/g,"").slice(0,4);return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#381d31"/><stop offset=".55" stop-color="#9c3d75"/><stop offset="1" stop-color="#e7a4c8"/></linearGradient></defs><rect width="640" height="420" rx="30" fill="url(#g)"/><circle cx="520" cy="60" r="170" fill="#fff" opacity=".08"/><circle cx="90" cy="390" r="160" fill="#fff" opacity=".08"/><text x="48" y="225" font-family="Arial,sans-serif" font-size="92" font-weight="900" fill="#fff" opacity=".95">${escapeXml(initials)}</text><text x="52" y="285" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#fff">${escapeXml(name.slice(0,44))}</text><text x="54" y="340" font-family="Arial,sans-serif" font-size="13" letter-spacing="5" fill="#ffe4f1">RENQD × DRAG RACE</text></svg>`;}
export async function GET(request:Request){
 const db=await createClient(),{data:{user}}=await db.auth.getUser();if(!user)return new NextResponse("Unauthorized",{status:401});
 const {data:profile}=await db.from("profiles").select("status").eq("id",user.id).maybeSingle();if(profile?.status!=="APPROVED")return new NextResponse("Forbidden",{status:403});
 const params=new URL(request.url).searchParams,code=params.get("code"),source=params.get("source")==="1";if(!code||code.length>20)return new NextResponse("Bad request",{status:400});
 const {data:franchise}=await db.from("drag_race_franchises").select("name").eq("code",code).maybeSingle();if(!franchise)return new NextResponse("Not found",{status:404});
 try{const image=await findImage(franchise.name);if(source)return NextResponse.redirect(image?.sourceUrl??("https://commons.wikimedia.org/w/index.php?search="+encodeURIComponent(franchise.name+" logo")),{headers});if(image?.imageUrl)return NextResponse.redirect(image.imageUrl,{headers});}catch{}
 if(source)return NextResponse.redirect("https://commons.wikimedia.org/w/index.php?search="+encodeURIComponent(franchise.name+" logo"),{headers});
 return new NextResponse(fallback(code,franchise.name),{status:200,headers:{...headers,"Content-Type":"image/svg+xml; charset=utf-8"}});
}