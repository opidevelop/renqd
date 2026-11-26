import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export const runtime="nodejs";
type CommonsImageInfo={url?:string;thumburl?:string;extmetadata?:{LicenseShortName?:{value?:string}}};
type CommonsPage={imageinfo?:CommonsImageInfo[]};
const headers={"Cache-Control":"private, max-age=3600, s-maxage=604800, stale-while-revalidate=86400"};
const escapeXml=(value:string)=>value.replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]??c));
function fallback(name:string){const initials=name.split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase();return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f9e5ef"/><stop offset="1" stop-color="#ead7e7"/></linearGradient></defs><rect width="600" height="600" rx="48" fill="url(#g)"/><circle cx="300" cy="250" r="150" fill="#fff" opacity=".42"/><text x="300" y="310" text-anchor="middle" font-family="Arial,sans-serif" font-size="145" font-weight="700" fill="#a33e72">${initials}</text><text x="300" y="510" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#815a70">${escapeXml(name.slice(0,36))}</text></svg>`;}
export async function GET(request:Request){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return new NextResponse("Unauthorized",{status:401});
 const {data:profile}=await db.from("profiles").select("status").eq("id",user.id).maybeSingle();if(profile?.status!=="APPROVED")return new NextResponse("Forbidden",{status:403});
 const id=new URL(request.url).searchParams.get("id");if(!id||id.length>180)return new NextResponse("Bad request",{status:400});
 const {data:queen}=await db.from("drag_race_queens").select("name,image_url").eq("id",id).maybeSingle();if(!queen)return new NextResponse("Not found",{status:404});
 if(queen.image_url&&/^https:\/\//.test(queen.image_url))return NextResponse.redirect(queen.image_url,{headers});
 try{
  const query=encodeURIComponent(`filetype:bitmap "${queen.name}" drag queen`);
  const url=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=600&format=json&origin=*`;
  const response=await fetch(url,{headers:{"User-Agent":"Renqd/1.0"},next:{revalidate:604800}});
  if(response.ok){
   const payload=await response.json() as {query?:{pages?:Record<string,CommonsPage>}};const pages=Object.values(payload.query?.pages??{});
   const allowed=pages.map(p=>p.imageinfo?.[0]).filter(Boolean).filter(info=>{
    const license=String(info.extmetadata?.LicenseShortName?.value??"").toLowerCase();
    return license.startsWith("cc0")||license.includes("public domain");
   }).sort((a,b)=>Number(Boolean(b.thumburl))-Number(Boolean(a.thumburl)));
   const image=allowed.find(x=>x.thumburl)?.thumburl??allowed.find(x=>x.url)?.url;
   if(image)return NextResponse.redirect(image,{headers});
  }
 }catch{}
 return new NextResponse(fallback(queen.name),{status:200,headers:{...headers,"Content-Type":"image/svg+xml; charset=utf-8"}});
}
