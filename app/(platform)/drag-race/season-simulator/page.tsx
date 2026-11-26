import {createClient} from "@/lib/supabase/server";
import {DragRaceSeasonSimulator} from "@/components/drag-race/season-simulator";
export const dynamic="force-dynamic";
export default async function SeasonSimulatorPage(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return null;
 const [f,s,q,l,saved]=await Promise.all([
  db.from("drag_race_franchises").select("code,name").order("sort_order"),
  db.from("drag_race_seasons").select("id,franchise_code,season_number,year,name,cast_ids").order("franchise_code").order("season_number"),
  db.from("drag_race_queens").select("id,name,aliases,image_url").range(0,4999),
  db.from("drag_race_lipsyncs").select("id,song_title,song_artist,preview_url,apple_music_url").eq("is_eligible",true).range(0,4999),
  db.from("drag_race_saved_seasons").select("id,title,created_at,statistics").eq("owner_id",user.id).order("created_at",{ascending:false}).limit(30)
 ]);
 const franchiseCodes=new Map<string,string[]>();for(const season of s.data??[])for(const id of season.cast_ids??[]){const list=franchiseCodes.get(id)??[];if(!list.includes(season.franchise_code))list.push(season.franchise_code);franchiseCodes.set(id,list);}
 return <DragRaceSeasonSimulator userId={user.id} franchises={f.data??[]} seasons={s.data??[]} queens={(q.data??[]).map(x=>({...x,aliases:x.aliases??[],image_url:x.image_url??("/api/drag-race/queen-image?id="+encodeURIComponent(x.id)),franchiseCodes:franchiseCodes.get(x.id)??[]}))} songs={l.data??[]} savedSeasons={(saved.data??[]) as Array<{id:string;title:string;created_at:string;statistics:Record<string,unknown>}>}/>;
}