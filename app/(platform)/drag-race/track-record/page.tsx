import {createClient} from "@/lib/supabase/server";
import {TrackRecordHub} from "@/components/drag-race/track-record-hub";
export const dynamic="force-dynamic";
export default async function TrackRecordPage(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return null;
 const [t,r,f]=await Promise.all([
  db.from("drag_race_track_record_templates").select("id,franchise_code,season_number,display_title,year,season_id,episodes,queens,source_metadata").order("franchise_code").order("season_number"),
  db.from("drag_race_track_records").select("id,title,season_id,visibility,updated_at,record_data").eq("owner_id",user.id).is("deleted_at",null).order("updated_at",{ascending:false}),
  db.from("drag_race_franchises").select("code,name")
 ]);
 const franchiseNames=Object.fromEntries((f.data??[]).map(x=>[x.code,x.name]));
 return <TrackRecordHub userId={user.id} templates={t.data??[]} records={r.data??[]} franchiseNames={franchiseNames}/>;
}
