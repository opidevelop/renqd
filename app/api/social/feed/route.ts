import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {getAccountAccess} from "@/lib/supabase/authorization";
import {getProfileMediaUrl} from "@/lib/supabase/profile-media";
export const dynamic="force-dynamic";
const allowed=["RANKING_PUBLISHED","RANKING_LIKED","RANKING_COMMENTED"];
export async function GET(request:Request){
 const supabase=await createClient();const {user,status}=await getAccountAccess(supabase);
 if(!user)return NextResponse.json({error:"Sessione scaduta. Accedi di nuovo."},{status:401});
 if(status!=="APPROVED")return NextResponse.json({error:"Account non ancora abilitato."},{status:403});
 const params=new URL(request.url).searchParams;const type=params.get("type")??"ALL";const before=params.get("before");
 if(type!=="ALL"&&!allowed.includes(type))return NextResponse.json({error:"Filtro non valido."},{status:400});
 const cursor=before&&Number.isFinite(Date.parse(before))?new Date(before).toISOString():null;
 const {data,error}=await supabase.rpc("renqd_get_social_feed",{p_event_types:type==="ALL"?null:[type],p_before:cursor,p_limit:50});
 if(error)return NextResponse.json({error:"Non è stato possibile caricare il Feed."},{status:500});
 const rows=(((data??{}) as {items?:Array<Record<string,unknown>>}).items??[]);
 const items=await Promise.all(rows.map(async raw=>{
  const actor=(raw.actor??{}) as Record<string,unknown>;
  return {...raw,actor:{...actor,avatarUrl:await getProfileMediaUrl(supabase,typeof actor.avatarUrl==="string"?actor.avatarUrl:null)}};
 }));
 return NextResponse.json({items},{headers:{"Cache-Control":"private, no-store"}});
}