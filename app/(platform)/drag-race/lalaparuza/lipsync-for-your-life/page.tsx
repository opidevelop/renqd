import {createClient} from "@/lib/supabase/server";
import {LipsyncForYourLifeGame} from "@/components/drag-race/lipsync-for-your-life-game";
export const dynamic="force-dynamic";
export default async function LipsyncForYourLifePage(){
 const db=await createClient();
 const [f,s,q,l]=await Promise.all([
  db.from("drag_race_franchises").select("code,name").order("sort_order"),
  db.from("drag_race_seasons").select("id,name,franchise_code,season_number").order("year"),
  db.from("drag_race_queens").select("id,name,aliases,image_url").range(0,4999),
  db.from("drag_race_lipsyncs").select("id,season_id,song_title,song_artist,preview_url,apple_music_url").range(0,4999)
 ]);
 const seasons=s.data??[];const codesByQueen=new Map<string,string[]>();
 for(const season of seasons){const {data}=await db.from("drag_race_seasons").select("cast_ids").eq("id",season.id).maybeSingle();for(const id of data?.cast_ids??[]){const list=codesByQueen.get(id)??[];if(!list.includes(season.franchise_code))list.push(season.franchise_code);codesByQueen.set(id,list);}}
 return <LipsyncForYourLifeGame franchises={f.data??[]} seasons={seasons} queens={(q.data??[]).map(x=>({...x,aliases:x.aliases??[],franchiseCodes:codesByQueen.get(x.id)??[]}))} songs={l.data??[]}/>;
}
