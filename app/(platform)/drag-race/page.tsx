import {createClient} from "@/lib/supabase/server";
import {DragRaceHub} from "@/components/drag-race/hub";
export const dynamic="force-dynamic";
export default async function DragRacePage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 const [profile,state]=await Promise.all([
  user?supabase.from("profiles").select("role").eq("id",user.id).maybeSingle():Promise.resolve({data:null}),
  supabase.from("drag_race_catalog_sync_state").select("last_synced_at,source_version").eq("id",1).maybeSingle()
 ]);
 const role=profile.data?.role;const canSync=["OWNER","ADMIN","MODERATOR"].includes(String(role));
 return <DragRaceHub canSync={canSync} lastSyncedAt={state.data?.last_synced_at??null} sourceVersion={state.data?.source_version??"1.1.1"}/>;
}
