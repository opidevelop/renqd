import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RenqExperience } from "@/components/renq-experience";
import { GradeExperience } from "@/components/grade-experience";
import { SavedRenqDetail } from "@/components/saved-renq-detail";
import { highQualityImageUrl } from "@/lib/image-quality";

export const dynamic = "force-dynamic";

type MultiplayerDetails={session:{mode:"COLLABORATIVE"|"COMPETITIVE";status:string;deadlineAt:string|null;sharedState:Record<string,unknown>|null};participants:Array<{userId:string;username:string;displayName:string;avatarUrl:string|null;progressStatus:string}>};

export default async function RenqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: ranking } = isUuid
    ? await supabase.from("rankings").select("*").eq("id", id).is("deleted_at",null).maybeSingle()
    : await supabase.from("rankings").select("*").eq("public_slug", id).maybeSingle();
  if (!ranking) notFound();
  const isOwner=ranking.user_id===user.id;
  const {data:multiplayerSessionRow}=await supabase.from("ranking_multiplayer_sessions").select("id").eq("ranking_id",ranking.id).maybeSingle();
  let multiplayerDetails:MultiplayerDetails|null=null;
  if(multiplayerSessionRow){
    const {data:sessionDetails,error:sessionError}=await supabase.rpc("renqd_get_multiplayer_session",{p_ranking_id:ranking.id});
    if(sessionError||!sessionDetails)notFound();
    multiplayerDetails=sessionDetails as MultiplayerDetails;
  }
  if(!isOwner&&!multiplayerDetails)notFound();
  const {data:personalResult}=multiplayerDetails?.session.mode==="COMPETITIVE"
    ? await supabase.from("ranking_session_results").select("result_snapshot,result_status").eq("ranking_id",ranking.id).eq("user_id",user.id).maybeSingle()
    : {data:null};
  const {data:multiplayerResults}=multiplayerDetails?.session.mode==="COMPETITIVE"
    ? await supabase.from("ranking_session_results").select("user_id,result_snapshot,result_status").eq("ranking_id",ranking.id).eq("result_status","FINISHED")
    : {data:[]};
  const multiplayerContext=multiplayerDetails?{
    mode:multiplayerDetails.session.mode,
    status:multiplayerDetails.session.status,
    progressStatus:multiplayerDetails.participants.find((participant)=>participant.userId===user.id)?.progressStatus??"NOT_STARTED",
    deadlineAt:multiplayerDetails.session.deadlineAt,
    sharedState:multiplayerDetails.session.sharedState??null,
    personalProgress:personalResult?.result_snapshot??null
  }:null;

  const settings = (ranking.settings ?? {}) as Record<string, unknown>;
  const coverImagePath = typeof settings.coverImagePath === "string" ? settings.coverImagePath : null;
  const { data: signedCover } = coverImagePath ? await supabase.storage.from("renq-covers").createSignedUrl(coverImagePath, 60 * 60 * 24 * 7) : { data: null };
  const resolvedCoverImageUrl = signedCover?.signedUrl ?? (typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : null);
  const savedSnapshot = settings.savedSnapshot as { items?: Array<{ id: string; title: string; image_url?: string | null; description?: string | null; rank_position?: number | null; tie_group_id?: string | null; score?: number | null; tie_order?: number | null }> } | undefined;
  const isSaved = ranking.status === "COMPLETED" && Boolean(settings.savedAt) && Array.isArray(savedSnapshot?.items);

  if (isSaved) {
    const multiplayerComparison=multiplayerDetails?multiplayerDetails.participants.filter(person=>person.progressStatus==="FINISHED").map(person=>{
      const resultRow=(multiplayerResults??[]).find(row=>row.user_id===person.userId);
      const resultItems=Array.isArray(resultRow?.result_snapshot?.items)?resultRow.result_snapshot.items as Array<Record<string,unknown>>:(savedSnapshot?.items??[]) as Array<Record<string,unknown>>;
      const sortedResultItems=[...resultItems].sort((a,b)=>{
        if(ranking.mode==="BATTLE_RENQ")return Number(b.wins??0)-Number(a.wins??0);
        if(ranking.mode==="GRADE")return Number(b.score??-1)-Number(a.score??-1);
        return Number(a.rank_position??999999)-Number(b.rank_position??999999)||Number(a.tie_order??0)-Number(b.tie_order??0);
      });
      let previousPositionKey: number|null=null;let currentParticipantPosition=0;
      const placements=Object.fromEntries(sortedResultItems.map((item,index)=>{
        const positionKey=ranking.mode==="BATTLE_RENQ"?Number(item.wins??0):ranking.mode==="GRADE"?Number(item.score??-1):Number(item.rank_position??index+1);
        if(index===0||positionKey!==previousPositionKey)currentParticipantPosition=index+1;
        previousPositionKey=positionKey;
        const finalPosition=ranking.mode==="RENQ"||ranking.mode==="SPEED_RENQ"?Number(item.rank_position??currentParticipantPosition):currentParticipantPosition;
        return [String(item.id),{rankPosition:finalPosition,score:item.score===null||item.score===undefined?null:Number(item.score)}];
      }));
      return {userId:person.userId,username:person.username,displayName:person.displayName,avatarUrl:person.avatarUrl,placements};
    }):[];

    const [{ data: comments, count: commentCount }, { data: liked }, { count: likeCount }, { data: revisions }] = await Promise.all([
      supabase.from("ranking_comments").select("id,body,created_at,author_id", { count: "exact" }).eq("ranking_id", ranking.id).is("deleted_at", null).order("created_at", { ascending: true }),
      supabase.from("ranking_likes").select("user_id").eq("ranking_id", ranking.id).eq("user_id", user.id).maybeSingle(),
      supabase.from("ranking_likes").select("user_id", { count: "exact", head: true }).eq("ranking_id", ranking.id),
      supabase.from("ranking_revisions").select("id,version,change_summary,created_at").eq("ranking_id", ranking.id).order("version", { ascending: false }).limit(20)
    ]);
    return <SavedRenqDetail
      ranking={{ id: ranking.id, public_slug: ranking.public_slug, title: ranking.title, mode: ranking.mode, settings, created_at: ranking.created_at, visibility: ranking.visibility, allow_ties: ranking.allow_ties, started_at: ranking.started_at, completed_at: ranking.completed_at }}
      items={savedSnapshot?.items ?? []}
      coverImageUrl={resolvedCoverImageUrl}
      coverImagePath={coverImagePath}
      defaultCoverImageUrl={typeof settings.defaultCoverImageUrl === "string" ? settings.defaultCoverImageUrl : null}
      coverPosition={settings.coverPosition && typeof settings.coverPosition === "object" ? settings.coverPosition as {x:number;y:number} : {x:50,y:50}}
      comments={comments ?? []}
      commentCount={commentCount ?? 0}
      initialLiked={Boolean(liked)}
      likeCount={likeCount ?? 0}
      revisions={revisions ?? []}
      isMultiplayer={Boolean(multiplayerDetails)}
      multiplayerComparison={multiplayerComparison}
    />;
  }

  const { data: items } = await supabase.from("ranking_items").select("id,title_snapshot,sort_order,rank_position,tie_group_id,custom_item_id,score,tie_order").eq("ranking_id", ranking.id).order("rank_position", { ascending: true, nullsFirst: false }).order("sort_order");
  const customIds = (items ?? []).map(x => x.custom_item_id).filter(Boolean) as string[];
  const { data: custom } = customIds.length ? await supabase.from("custom_items").select("id,title,image_url,description,metadata").in("id", customIds) : { data: [] };
  const lookup = new Map((custom ?? []).map(x => [x.id, x]));
  const baseHydrated = (items ?? []).map(x => ({
    ...x,
    title: lookup.get(x.custom_item_id)?.title ?? x.title_snapshot,
    image_url: highQualityImageUrl(lookup.get(x.custom_item_id)?.image_url ?? null),
    description: lookup.get(x.custom_item_id)?.description ?? null,
    preview_url: (lookup.get(x.custom_item_id)?.metadata as Record<string, unknown> | undefined)?.previewUrl as string | null,
    apple_music_url: (lookup.get(x.custom_item_id)?.metadata as Record<string, unknown> | undefined)?.appleMusicUrl as string | null,
    spotify_url: (lookup.get(x.custom_item_id)?.metadata as Record<string, unknown> | undefined)?.spotifyUrl as string | null
  }));
  const personalItems=Array.isArray(personalResult?.result_snapshot?.items)?personalResult.result_snapshot.items as Array<Record<string,unknown>>:[];
  const personalById=new Map<string,Record<string,unknown>>(personalItems.map(item=>[String(item.id),item] as const));
  const hydrated=multiplayerContext?.mode==="COMPETITIVE"&&personalItems.length
    ? [...baseHydrated].map(item=>({...item,...(personalById.get(item.id)??{})})).sort((a,b)=>Number(a.rank_position??999999)-Number(b.rank_position??999999)||Number(a.tie_order??a.sort_order)-Number(b.tie_order??b.sort_order))
    : baseHydrated;
  const experienceRanking={...ranking,settings:{...settings,coverImageUrl:highQualityImageUrl(resolvedCoverImageUrl),coverPosition:settings.coverPosition??{x:50,y:50}}};
  if(ranking.mode==="GRADE")return <GradeExperience ranking={experienceRanking} items={hydrated} multiplayer={multiplayerContext} isOwner={isOwner}/>;
  return <RenqExperience ranking={experienceRanking} items={hydrated} multiplayer={multiplayerContext} isOwner={isOwner}/>;
}
