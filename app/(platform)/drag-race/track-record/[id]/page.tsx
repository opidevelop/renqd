import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {TrackRecordEditor} from "@/components/drag-race/track-record-editor";
export const dynamic="force-dynamic";
export default async function TrackRecordDetailPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return null;
 const [r,s,q,userProfile]=await Promise.all([
  db.from("drag_race_track_records").select("id,owner_id,title,record_data,visibility").eq("id",id).maybeSingle(),
  db.from("drag_race_track_record_scoring_rules").select("placement_key,label,score,color,sort_order").order("sort_order"),
  db.from("drag_race_queens").select("id,name,aliases,image_url").range(0,4999),
  db.from("profiles").select("role,status").eq("id",user.id).maybeSingle()
 ]);
 if(!r.data)notFound();
 const canEdit=r.data.owner_id===user.id;
 const ownerProfile=await db.from("public_profiles").select("is_private").eq("user_id",r.data.owner_id).maybeSingle();
 const socialEnabled=r.data.visibility==="PUBLIC"&&Boolean(ownerProfile.data&&!ownerProfile.data.is_private);
 const canModerateComments=canEdit||(["OWNER","ADMIN","MODERATOR"].includes(String(userProfile.data?.role))&&userProfile.data?.status==="APPROVED");
 return <TrackRecordEditor recordId={r.data.id} title={r.data.title} visibility={r.data.visibility} initialData={r.data.record_data} rules={s.data??[]} canEdit={canEdit} catalogQueens={q.data??[]} userId={user.id} ownerId={r.data.owner_id} canModerateComments={canModerateComments} socialEnabled={socialEnabled}/>
}
