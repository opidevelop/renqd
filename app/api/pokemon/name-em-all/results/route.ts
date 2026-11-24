import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountAccess } from "@/lib/supabase/authorization";

function fail(message:string,status=400){return NextResponse.json({error:message},{status});}

export async function POST(request:Request){
  const supabase=await createClient();
  const {user,status}=await getAccountAccess(supabase);
  if(!user)return fail("Sessione scaduta. Accedi di nuovo.",401);
  if(status!=="APPROVED")return fail("Account non ancora abilitato.",403);
  const body=await request.json().catch(()=>null);
  if(body?.action==="delete-one"){
    const id=typeof body.rankingId==="string"?body.rankingId:"";
    if(!id)return fail("Risultato non valido.");
    const {error}=await supabase.rpc("renqd_pokemon_name_em_all_delete_result",{p_ranking_id:id});
    if(error)return fail(error.message,400);
    return NextResponse.json({ok:true});
  }
  if(body?.action==="delete-all"){
    const {data,error}=await supabase.rpc("renqd_pokemon_name_em_all_delete_all_results");
    if(error)return fail(error.message,400);
    return NextResponse.json({ok:true,deletedCount:Number(data??0)});
  }
  return fail("Azione non riconosciuta.");
}
