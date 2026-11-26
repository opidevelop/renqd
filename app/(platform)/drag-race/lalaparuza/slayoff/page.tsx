import {createClient} from "@/lib/supabase/server";
import {SlayoffGame} from "@/components/drag-race/slayoff-game";
export const dynamic="force-dynamic";
export default async function SlayoffPage(){
 const db=await createClient();
 const [f,s,q,l]=await Promise.all([
  db.from("drag_race_franchises").select("code,name").order("sort_order"),
  db.from("drag_race_seasons").select("id,franchise_code,cast_ids"),
  db.from("drag_race_queens").select("id,name,aliases,image_url").range(0,4999),
  db.from("drag_race_lipsyncs").select("id,song_title,song_artist,preview_url,apple_music_url").range(0,4999)
 ]);
 const codesByQueen=new Map<string,string[]>();
 for(const season of s.data??[])for(const id of season.cast_ids??[]){const list=codesByQueen.get(id)??[];if(!list.includes(season.franchise_code))list.push(season.franchise_code);codesByQueen.set(id,list);}
 return <SlayoffGame franchises={f.data??[]} queens={(q.data??[]).map(x=>({...x,aliases:x.aliases??[],franchiseCodes:codesByQueen.get(x.id)??[]}))} songs={l.data??[]}/>;
}
