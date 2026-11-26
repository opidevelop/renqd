import {createClient} from "@/lib/supabase/server";
import {DragRaceHub} from "@/components/drag-race/hub";
export const dynamic="force-dynamic";
export default async function DragRacePage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 const [f,q,s,e,l,state,profile]=await Promise.all([
  supabase.from("drag_race_franchises").select("code",{count:"exact",head:true}),
  supabase.from("drag_race_queens").select("id",{count:"exact",head:true}),
  supabase.from("drag_race_seasons").select("id",{count:"exact",head:true}),
  supabase.from("drag_race_episodes").select("id",{count:"exact",head:true}),
  supabase.from("drag_race_lipsyncs").select("id",{count:"exact",head:true}),
  supabase.from("drag_race_catalog_sync_state").select("last_synced_at,source_version,eligible_lipsync_count").eq("id",1).maybeSingle(),
  user?supabase.from("profiles").select("role").eq("id",user.id).maybeSingle():Promise.resolve({data:null})
 ]);
 const role=profile.data?.role;const canSync=["OWNER","ADMIN","MODERATOR"].includes(String(role));
 return <DragRaceHub counts={{franchises:f.count??0,queens:q.count??0,seasons:s.count??0,episodes:e.count??0,lipsyncs:l.count??0,eligible:state.data?.eligible_lipsync_count??0}} canSync={canSync} lastSyncedAt={state.data?.last_synced_at??null} sourceVersion={state.data?.source_version??"1.1.1"}/>;
}
