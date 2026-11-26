import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {TrackRecordEditor} from "@/components/drag-race/track-record-editor";
export const dynamic="force-dynamic";
export default async function TrackRecordDetailPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return null;
 const [r,s]=await Promise.all([
  db.from("drag_race_track_records").select("id,owner_id,title,record_data,visibility").eq("id",id).maybeSingle(),
  db.from("drag_race_track_record_scoring_rules").select("placement_key,label,score,color,sort_order").order("sort_order")
 ]);
 if(!r.data)notFound();
 const canEdit=r.data.owner_id===user.id;
 return <TrackRecordEditor recordId={r.data.id} title={r.data.title} initialData={r.data.record_data} rules={s.data??[]} canEdit={canEdit}/>;
}
