import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountAccess } from "@/lib/supabase/authorization";

export async function POST(request:Request){
  const supabase=await createClient();
  const {user,status}=await getAccountAccess(supabase);
  if(!user)return NextResponse.json({error:"Sessione scaduta."},{status:401});
  if(status!=="APPROVED")return NextResponse.json({error:"Account non abilitato."},{status:403});
  const body=await request.json().catch(()=>null);
  const target=body?.targetUserId;
  if(typeof target!=="string"||target===user.id)return NextResponse.json({error:"Utente non valido."},{status:400});
  if(body.action==="block"){
    const {error}=await supabase.from("user_blocks").upsert({blocker_id:user.id,blocked_id:target},{onConflict:"blocker_id,blocked_id",ignoreDuplicates:true});
    if(error)return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({blocked:true});
  }
  if(body.action==="unblock"){
    const {error}=await supabase.from("user_blocks").delete().eq("blocker_id",user.id).eq("blocked_id",target);
    if(error)return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({blocked:false});
  }
  return NextResponse.json({error:"Azione non riconosciuta."},{status:400});
}
