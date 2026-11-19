import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {MultiplayerSessionPanel} from "@/components/multiplayer-session-panel";
export const dynamic="force-dynamic";
export default async function MultiplayerPage({params}:{params:Promise<{rankingId:string}>}){
 const {rankingId}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rankingId))notFound();
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login?next="+encodeURIComponent("/multiplayer/"+rankingId));
 const {data,error}=await supabase.rpc("renqd_get_multiplayer_session",{p_ranking_id:rankingId});
 if(error||!data)notFound();
 return <main className="multiplayer-page"><MultiplayerSessionPanel initial={data}/></main>;
}
