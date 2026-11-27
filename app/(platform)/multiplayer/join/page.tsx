import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {MultiplayerJoin} from "@/components/multiplayer-join";
export const dynamic="force-dynamic";
export default async function MultiplayerJoinPage({searchParams}:{searchParams:Promise<{token?:string}>}){
 const {token}=await searchParams;
 if(!token||!/^[0-9a-f]{64}$/i.test(token))return <main className="multiplayer-join-page"><div><h1>Link non valido.</h1><p>Questo invito non è corretto o è incompleto.</p></div></main>;
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login?next="+encodeURIComponent("/multiplayer/join?token="+token));
 return <MultiplayerJoin token={token}/>;
}
