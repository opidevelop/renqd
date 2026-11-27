import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {getAccountAccess} from "@/lib/supabase/authorization";
import {getProfileMediaUrl} from "@/lib/supabase/profile-media";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const supabase=await createClient();
 const {user,status}=await getAccountAccess(supabase);
 if(!user)return NextResponse.json({error:"Sessione scaduta. Accedi di nuovo."},{status:401});
 if(status!=="APPROVED")return NextResponse.json({error:"Account non ancora abilitato."},{status:403});
 const query=new URL(request.url).searchParams.get("q")?.trim()??"";
 const {data,error}=await supabase.rpc("renqd_discover_social",{p_query:query||null,p_limit:16});
 if(error)return NextResponse.json({error:"Non è stato possibile caricare Scopri."},{status:500});
 const result=(data??{}) as {users?:Array<Record<string,unknown>>;rankings?:Array<Record<string,unknown>>};
 const users=await Promise.all((result.users??[]).map(async item=>({...item,avatarUrl:await getProfileMediaUrl(supabase,typeof item.avatarUrl==="string"?item.avatarUrl:null)})));
 const rankings=await Promise.all((result.rankings??[]).map(async item=>{
  const creator=(item.creator??{}) as Record<string,unknown>;
  return {...item,creator:{...creator,avatarUrl:await getProfileMediaUrl(supabase,typeof creator.avatarUrl==="string"?creator.avatarUrl:null)}};
 }));
 return NextResponse.json({users,rankings},{headers:{"Cache-Control":"private, no-store"}});
}