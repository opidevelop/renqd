import {createClient} from "@/lib/supabase/server";
import {SlayoffGame} from "@/components/drag-race/slayoff-game";
export const dynamic="force-dynamic";
export default async function SlayoffPage(){
 const db=await createClient();
 const [f,s,q]=await Promise.all([
  db.from("drag_race_franchises").select("code,name").order("sort_order"),
  db.from("drag_race_seasons").select("id,franchise_code,name,season_number,cast_ids"),
  db.from("drag_race_queens").select("id,name,aliases,image_url").range(0,4999)
 ]);
 const codesByQueen=new Map<string,string[]>();
 for(const season of s.data??[])for(const id of season.cast_ids??[]){const list=codesByQueen.get(id)??[];if(!list.includes(season.franchise_code))list.push(season.franchise_code);codesByQueen.set(id,list);}
 return <SlayoffGame franchises={f.data??[]} seasons={(s.data??[]).map(({id,franchise_code,name,season_number})=>({id,franchise_code,name,season_number}))} queens={(q.data??[]).map(x=>({...x,aliases:x.aliases??[],image_url:x.image_url??("/api/drag-race/queen-image?id="+encodeURIComponent(x.id)),franchiseCodes:codesByQueen.get(x.id)??[]}))}/>;
}
