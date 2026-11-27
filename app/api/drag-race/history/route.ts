import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {getAccountAccess} from "@/lib/supabase/authorization";
export const dynamic="force-dynamic";
export async function DELETE(request:Request){
 const supabase=await createClient();const {user,status}=await getAccountAccess(supabase);
 if(!user)return NextResponse.json({error:"Sessione scaduta. Accedi di nuovo."},{status:401});
 if(status!=="APPROVED")return NextResponse.json({error:"Account non ancora abilitato."},{status:403});
 const body=await request.json().catch(()=>null) as {all?:boolean;sessionId?:string}|null;
 const all=body?.all===true;const sessionId=typeof body?.sessionId==="string"?body.sessionId:null;
 if(!all&&!sessionId)return NextResponse.json({error:"Richiesta di eliminazione non valida."},{status:400});
 const {error}=await supabase.rpc("drag_race_delete_history",{p_session_id:all?null:sessionId});
 if(error)return NextResponse.json({error:error.code==="P0002"?"Partita non trovata.":"Non è stato possibile eliminare la cronologia."},{status:error.code==="P0002"?404:500});
 return NextResponse.json({ok:true,deletedAll:all},{headers:{"Cache-Control":"private, no-store"}});
}
