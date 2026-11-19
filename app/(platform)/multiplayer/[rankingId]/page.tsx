import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {MultiplayerSessionPanel} from "@/components/multiplayer-session-panel";
import {DynamicCoverTheme} from "@/components/dynamic-cover-theme";
export const dynamic="force-dynamic";
export default async function MultiplayerPage({params}:{params:Promise<{rankingId:string}>}){
 const {rankingId}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rankingId))notFound();
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login?next="+encodeURIComponent("/multiplayer/"+rankingId));
 const {data,error}=await supabase.rpc("renqd_get_multiplayer_session",{p_ranking_id:rankingId});
 if(error||!data)notFound();
 const settings=(data.ranking?.settings??{}) as Record<string,unknown>;
 const coverPath=typeof settings.coverImagePath==="string"?settings.coverImagePath:null;
 const {data:signedCover}=coverPath?await supabase.storage.from("renq-covers").createSignedUrl(coverPath,60*60*24*7):{data:null};
 const coverImageUrl=signedCover?.signedUrl??(typeof settings.coverImageUrl==="string"?settings.coverImageUrl:null)??(typeof settings.defaultCoverImageUrl==="string"?settings.defaultCoverImageUrl:null);
 const coverPosition=settings.coverPosition&&typeof settings.coverPosition==="object"?settings.coverPosition as {x:number;y:number}:{x:50,y:50};
 const page=<main className="multiplayer-page"><MultiplayerSessionPanel initial={data} coverImageUrl={coverImageUrl} coverPosition={coverPosition}/></main>;
 return coverImageUrl?<DynamicCoverTheme imageSrc={coverImageUrl}>{page}</DynamicCoverTheme>:page;
}
