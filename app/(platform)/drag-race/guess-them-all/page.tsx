import {createClient} from "@/lib/supabase/server";
import {GuessThemAllGame} from "@/components/drag-race/guess-them-all-game";
export const dynamic="force-dynamic";
export default async function GuessThemAllPage(){
 const db=await createClient();const [f,s,q]=await Promise.all([
  db.from("drag_race_franchises").select("code,name").order("sort_order"),
  db.from("drag_race_seasons").select("id,franchise_code,season_number,cast_ids"),
  db.from("drag_race_queens").select("id,name,aliases,image_url").range(0,4999)
 ]);
 const codes=new Map<string,string[]>(),first=new Map<string,number>();
 for(const season of s.data??[])for(const id of season.cast_ids??[]){const list=codes.get(id)??[];if(!list.includes(season.franchise_code))list.push(season.franchise_code);codes.set(id,list);first.set(id,Math.min(first.get(id)??999,season.season_number));}
 return <GuessThemAllGame franchises={f.data??[]} queens={(q.data??[]).map(x=>({...x,aliases:x.aliases??[],image_url:x.image_url??("/api/drag-race/queen-image?id="+encodeURIComponent(x.id)),franchiseCodes:codes.get(x.id)??[],firstSeason:first.get(x.id)??999}))}/>;
}
