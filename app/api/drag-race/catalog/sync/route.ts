import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function POST(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Autenticazione richiesta"},{status:401});
 const {data:profile}=await supabase.from("profiles").select("role,status").eq("id",user.id).maybeSingle();
 if(profile?.status!=="APPROVED"||!["OWNER","ADMIN","MODERATOR"].includes(String(profile.role)))return NextResponse.json({error:"Accesso riservato allo staff"},{status:403});
 const {data,error}=await supabase.functions.invoke("drag-race-catalog-sync",{body:{force:true}});
 if(error)return NextResponse.json({error:"Sincronizzazione catalogo non riuscita"},{status:502});
 return NextResponse.json(data??{synced:false});
}
