import { createClient } from "@/lib/supabase/server";
import { getProfileMediaUrl } from "@/lib/supabase/profile-media";
import { NameEmAllExperience } from "@/components/pokemon/name-em-all";
import type { NameEmAllParticipant } from "@/components/pokemon/multiplayer-lobby";
import "../../pokemon.css";

export const dynamic = "force-dynamic";

export default async function NameEmAllPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: participant } = user ? await supabase.from("pokemon_name_em_all_participants")
    .select("session_id,ranking_id,participant_role,is_ready,is_active,is_connected,completed_at,catalog_order,joined_at")
    .eq("user_id",user.id).is("expelled_at",null)
    .order("joined_at",{ascending:false}).limit(1).maybeSingle() : { data: null };
  const { data: sessionRow } = user && participant ? await supabase.from("pokemon_name_em_all_sessions")
    .select("id,owner_id,host_id,ranking_id,game_mode,status,config,catalog_species_ids,special_species_ids,duration_seconds,started_at,deadline_at,paused_at,remaining_seconds,paused_total_seconds")
    .eq("id",participant.session_id).in("status",["LOBBY","ACTIVE","PAUSED"]).maybeSingle() : { data: null };
  if (user && participant && sessionRow && (!participant.is_active || !participant.is_connected)) {
    const {error:rejoinError}=await supabase.rpc("renqd_pokemon_name_em_all_rejoin_session",{p_session_id:sessionRow.id});
    if(rejoinError) console.error("Name ’Em All rejoin:",rejoinError.message);
  }
  const activeSession = sessionRow ? {
    ...sessionRow,
    catalog_species_ids: participant?.catalog_order?.length ? participant.catalog_order : sessionRow.catalog_species_ids,
  } : null;

  let discoveries: {species_id:number}[]=[];
  const initialDiscoverers:Record<string,string>={};
  let initialParticipants: NameEmAllParticipant[]=[];
  if(user&&activeSession){
    let discoveryQuery=supabase.from("pokemon_name_em_all_discoveries").select("species_id,user_id,discovered_by").eq("session_id",activeSession.id);
    discoveryQuery=activeSession.game_mode==="COLLABORATIVE"?discoveryQuery.is("user_id",null):discoveryQuery.eq("user_id",user.id);
    const [{data:foundRows},{data:participantRows}]=await Promise.all([
      discoveryQuery,
      supabase.from("pokemon_name_em_all_participants").select("user_id,participant_role,is_ready,is_active,is_connected,completed_at,joined_at,ranking_id")
        .eq("session_id",activeSession.id).is("expelled_at",null).order("joined_at",{ascending:true}),
    ]);
    discoveries=(foundRows??[]).map(row=>({species_id:Number(row.species_id)}));
    const ids=(participantRows??[]).map(row=>row.user_id);
    const [{data:profiles},{data:rankingRows}]=ids.length?await Promise.all([
      supabase.from("public_profiles").select("user_id,username,display_name,avatar_url").in("user_id",ids),
      supabase.from("rankings").select("id,public_slug").in("id",(participantRows??[]).map(row=>row.ranking_id)),
    ]):[{data:[]},{data:[]}];
    const profileMap=new Map((profiles??[]).map(profile=>[profile.user_id,profile]));
    const slugMap=new Map((rankingRows??[]).map(row=>[row.id,row.public_slug]));
    const {data:allDiscoveries}=await supabase.from("pokemon_name_em_all_discoveries")
      .select("species_id,user_id,discovered_by,discovered_at").eq("session_id",activeSession.id);
    const counts=new Map<string,number>();
    const lastDiscoveryAt=new Map<string,string>();
    for(const row of allDiscoveries??[]){
      const key=activeSession.game_mode==="COLLABORATIVE"?String(row.discovered_by):String(row.user_id);
      counts.set(key,(counts.get(key)??0)+1);
      const timestamp=String(row.discovered_at??"");
      if(timestamp&&(!lastDiscoveryAt.has(key)||timestamp>lastDiscoveryAt.get(key)!))lastDiscoveryAt.set(key,timestamp);
      if(activeSession.game_mode==="COLLABORATIVE"&&row.user_id===null&&row.discovered_by)initialDiscoverers[String(row.species_id)]=String(row.discovered_by);
    }
    initialParticipants=await Promise.all((participantRows??[]).map(async row=>{
      const profile=profileMap.get(row.user_id);
      return {
        userId:row.user_id,username:profile?.username??"",displayName:profile?.display_name||profile?.username||"Allenatore",
        avatarUrl:await getProfileMediaUrl(supabase,profile?.avatar_url??null),
        isReady:Boolean(row.is_ready),isActive:Boolean(row.is_active),isConnected:Boolean(row.is_connected),
        completed:Boolean(row.completed_at),foundCount:counts.get(row.user_id)??0,rankPosition:null,
        publicSlug:slugMap.get(row.ranking_id)??null,lastDiscoveryAt:lastDiscoveryAt.get(row.user_id)??null,
      };
    }));
  }

  const { data: profile } = user ? await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle() : {data:null};
  const { data: latestResult } = user && !activeSession ? await supabase.from("pokemon_name_em_all_results")
    .select("result_snapshot").eq("user_id",user.id).is("deleted_at",null)
    .order("created_at",{ascending:false}).limit(1).maybeSingle() : { data: null };

  return (
    <main className="pokemon-page pokemon-name-em-all">
      <NameEmAllExperience
        activeSession={activeSession as never}
        initialDiscoveries={discoveries.map(row=>row.species_id)}
        latestResult={(latestResult?.result_snapshot as Record<string,unknown> | undefined) ?? null}
        initialParticipants={initialParticipants}
        initialDiscoverers={initialDiscoverers}
        currentUserId={user?.id??""}
        currentUserRole={String(profile?.role??"")}
      />
    </main>
  );
}
