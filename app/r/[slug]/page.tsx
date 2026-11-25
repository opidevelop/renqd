import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileMediaUrl } from "@/lib/supabase/profile-media";
import { ArrowLeft, Trophy } from "lucide-react";
import ReportRenqMenu from "@/components/report-renq-menu";
import { PokemonFavouritePublicView } from "@/components/pokemon/ultimate-favourite";
import { PokemonNameEmAllPublicResultView } from "@/components/pokemon/name-em-all";
import { FavouriteMatrix } from "@/lib/pokemon/catalog";
import "./report-renq.css";

export const dynamic = "force-dynamic";

export default async function PublicRenqPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: actor } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
  const isStaff = actor?.status === "APPROVED" && ["OWNER","ADMIN","MODERATOR"].includes(actor.role);
  let { data: ranking } = await supabase.from("rankings").select("id,user_id,public_slug,title,mode,settings,visibility,status,hidden_at,deleted_at").eq("public_slug", slug).maybeSingle();
  if (!ranking && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(slug)) {
    const result = await supabase.from("rankings").select("id,user_id,public_slug,title,mode,settings,visibility,status,hidden_at,deleted_at").eq("id", slug).maybeSingle();
    ranking = result.data;
  }
  if (!ranking || ranking.status !== "COMPLETED") notFound();
  const isOwner = ranking.user_id === user.id;
  let isSessionParticipant = false;
  if (ranking.mode === "POKEMON_NAME_EM_ALL") {
    const {data:resultMeta}=await supabase.from("pokemon_name_em_all_results").select("session_id").eq("ranking_id",ranking.id).maybeSingle();
    if (resultMeta?.session_id) {
      const {data:membership}=await supabase.from("pokemon_name_em_all_participants").select("user_id").eq("session_id",resultMeta.session_id).eq("user_id",user.id).is("expelled_at",null).maybeSingle();
      isSessionParticipant=Boolean(membership);
    }
  }
  if (!isStaff && !isOwner && !isSessionParticipant && (ranking.hidden_at || ranking.deleted_at || ranking.visibility !== "LIVE" || (ranking.settings as Record<string,unknown>)?.access === "private")) notFound();
  const settings = (ranking.settings ?? {}) as Record<string,unknown>;
  const snapshot = (settings.savedSnapshot ?? {}) as { items?: { id?:string; title:string; image_url?:string|null; description?:string|null; rank_position?:number|null }[] };
  const items = (snapshot.items ?? []).slice().sort((a,b)=>(a.rank_position??999)-(b.rank_position??999));
  const { data: profile } = await supabase.from("public_profiles").select("username,display_name,is_private").eq("user_id", ranking.user_id).maybeSingle();
  if (ranking.mode === "POKEMON_ULTIMATE_FAVOURITE") {
    const matrix = (settings.matrix ?? {}) as FavouriteMatrix;
    const ownerName = profile?.display_name || profile?.username || "Utente Renqd";
    return <PokemonFavouritePublicView matrix={matrix} ownerName={ownerName} />;
  }
  if (ranking.mode === "POKEMON_NAME_EM_ALL") {
    const result = (settings.resultSnapshot ?? {}) as Record<string, unknown>;
    const rawLeaderboard=Array.isArray(result.leaderboard)?result.leaderboard as Array<Record<string,unknown>>:[];
    const {data:ownerBlocked}=!isOwner?await supabase.rpc("renqd_is_user_blocked",{p_other_user_id:ranking.user_id}):{data:false};
    const snapshotOwner=rawLeaderboard.find(item=>String(item.userId??"")===ranking.user_id);
    const snapshotOwnerName=String(result.displayName??result.username??snapshotOwner?.displayName??snapshotOwner?.username??"");
    const ownerName = ownerBlocked===true?"Allenatore bloccato":profile?.display_name || profile?.username || snapshotOwnerName || "Utente Renqd";
    const leaderboard = rawLeaderboard.length ? await Promise.all(rawLeaderboard.map(async item=>{
      const itemUserId=typeof item.userId==="string"?item.userId:"";
      const {data:blocked}=itemUserId&&itemUserId!==user.id
        ?await supabase.rpc("renqd_is_user_blocked",{p_other_user_id:itemUserId})
        :{data:false};
      return {
        ...item,
        userId:blocked===true?null:item.userId,
        displayName:blocked===true?"Allenatore bloccato":item.displayName,
        username:blocked===true?"":item.username,
        publicSlug:blocked===true?null:item.publicSlug,
        avatarUrl:blocked===true?null:await getProfileMediaUrl(supabase,typeof item.avatarUrl==="string"?item.avatarUrl:null),
      };
    })) : [];
    const resultWithAvatars={...result,leaderboard};
    const isPublic = !ranking.hidden_at && !ranking.deleted_at && ranking.visibility === "LIVE"
      && settings.access !== "private" && profile?.is_private === false;
    const {data:canViewResult}=await supabase.rpc("renqd_pokemon_name_em_all_can_view",{p_ranking_id:ranking.id});
    const canViewSocial=canViewResult===true;
    const {data:canSocialResult}=await supabase.rpc("renqd_pokemon_name_em_all_can_social",{p_ranking_id:ranking.id});
    const canSocial=canSocialResult===true;
    const canReport = isPublic && actor?.status === "APPROVED" && !isOwner;
    const [{ data: comments }, { data: liked }, { count: likeCount }, {data:likes}] = canViewSocial ? await Promise.all([
      supabase.from("ranking_comments").select("id,body,created_at,edited_at,author_id,parent_comment_id").eq("ranking_id",ranking.id).is("deleted_at",null).order("created_at",{ascending:true}).limit(100),
      supabase.from("ranking_likes").select("user_id").eq("ranking_id",ranking.id).eq("user_id",user.id).maybeSingle(),
      supabase.from("ranking_likes").select("user_id",{count:"exact",head:true}).eq("ranking_id",ranking.id),
      supabase.from("ranking_likes").select("user_id,created_at").eq("ranking_id",ranking.id).order("created_at",{ascending:false}).limit(100),
    ]) : [{data:[]},{data:null},{count:0},{data:[]}];
    const commentIds=(comments??[]).map(comment=>comment.id);
    const {data:likesForComments}=canViewSocial&&commentIds.length
      ?await supabase.from("ranking_comment_likes").select("comment_id,user_id").in("comment_id",commentIds)
      :{data:[]};
    const authorIds=[...new Set([...(comments??[]).map(comment=>comment.author_id),...(likes??[]).map(item=>item.user_id)])];
    const {data:commentProfiles}=authorIds.length?await supabase.from("public_profiles").select("user_id,username,display_name,avatar_url").in("user_id",authorIds):{data:[]};
    const profileById=new Map((commentProfiles??[]).map(item=>[item.user_id,item]));
    const likesByComment=new Map<string,{count:number;liked:boolean}>();
    for(const like of likesForComments??[]){const current=likesByComment.get(like.comment_id)??{count:0,liked:false};current.count++;if(like.user_id===user.id)current.liked=true;likesByComment.set(like.comment_id,current);}
    const initialLikers=await Promise.all((likes??[]).map(async like=>{
      const liker=profileById.get(like.user_id);
      return {userId:like.user_id,displayName:liker?.display_name||liker?.username||"Allenatore",
        username:liker?.username||"",avatarUrl:await getProfileMediaUrl(supabase,liker?.avatar_url)};
    }));
    const initialComments=await Promise.all((comments??[]).map(async comment=>{
      const author=profileById.get(comment.author_id);const likes=likesByComment.get(comment.id);
      return {id:comment.id,body:comment.body,createdAt:comment.created_at,editedAt:comment.edited_at,
        authorId:comment.author_id,parentCommentId:comment.parent_comment_id,
        authorName:author?.display_name||author?.username||"Allenatore",username:author?.username||"",
        avatarUrl:await getProfileMediaUrl(supabase,author?.avatar_url),likeCount:likes?.count??0,likedByMe:likes?.liked??false};
    }));
    const reportStatus=canReport?await supabase.rpc("ranking_report_exists",{p_ranking_id:ranking.id}):{data:false};
    return <div className="pokemon-public-result-shell">
      <PokemonNameEmAllPublicResultView result={resultWithAvatars} ownerName={ownerName} isOwner={isOwner} profileHref={isOwner?"/profile":profile?.username?"/u/"+profile.username:"/profile"} social={canViewSocial?{
        rankingId:ranking.id,resultOwnerId:ranking.user_id,initialLiked:Boolean(liked),initialLikeCount:likeCount??0,initialLikers,initialComments,
        currentUserId:user.id,canLike:canSocial&&!isOwner,canComment:canSocial,isOwner,
      }:undefined}/>
      {canReport&&<ReportRenqMenu rankingId={ranking.id} alreadyReported={Boolean(reportStatus.data)}/>}
    </div>;
  }
  const canReport = actor?.status === "APPROVED" && user.id !== ranking.user_id
    && !ranking.hidden_at && !ranking.deleted_at && ranking.visibility === "LIVE"
    && (settings as Record<string, unknown>).access !== "private";
  const reportStatus = canReport ? await supabase.rpc("ranking_report_exists", { p_ranking_id: ranking.id }) : { data: false };
  const cover = typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : null;
  const position = settings.coverPosition && typeof settings.coverPosition === "object" ? settings.coverPosition as {x:number;y:number} : {x:50,y:50};
  return <main className="public-profile-page public-renq-page">
    {profile && <Link href={ranking.user_id === user.id ? "/profile" : "/u/" + profile.username} className="public-profile-back"><ArrowLeft size={15}/> {ranking.user_id === user.id ? "Il tuo profilo" : (profile.display_name || profile.username)}</Link>}
    <section className="profile-cover public-renq-cover" style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(15,12,10,.85),rgba(15,12,10,.12)),url(" + cover + ")", backgroundPosition: position.x + "% " + position.y + "%" } : undefined}>
      <div className="profile-cover-copy"><span>{String(ranking.mode).replaceAll("_"," ")} · RENQD</span><h1>{ranking.title}</h1><p>{items.length} elementi · Classifica pubblicata</p></div>
    </section>
    <section className="profile-renqs-section"><div className="profile-section-heading"><div><span>IL RISULTATO</span><h2>La classifica</h2></div><Trophy size={20}/></div>
      {items.length ? <div className="saved-renq-list">{items.map((item,index)=>{const rank=item.rank_position??index+1;const medal=rank<=3?["🥇","🥈","🥉"][rank-1]:null;return <article className={"saved-renq-row"+(rank<=3?" is-top-"+rank:"")} key={item.id??index}><span className="saved-renq-position">{String(rank).padStart(2,"0")}</span>{item.image_url?<img src={item.image_url} alt="" loading="lazy"/>:<span className="saved-renq-item-placeholder"><Trophy size={18}/></span>}<div className="saved-renq-item-copy"><strong>{item.title}</strong>{item.description&&<small>{item.description}</small>}</div>{medal&&<span className={"saved-renq-medal medal-"+rank}>{medal}</span>}</article>;})}</div> : <div className="profile-empty-state"><Trophy size={22}/><strong>Anteprima della classifica non disponibile</strong></div>}
    </section>
    {canReport && <ReportRenqMenu rankingId={ranking.id} alreadyReported={Boolean(reportStatus.data)}/>}
    <div className="profile-public-footer">renqd<span>.</span></div>
  </main>;
}
