import {createClient} from "@/lib/supabase/server";
import {GuessTheLipsyncGame} from "@/components/drag-race/guess-the-lipsync-game";
export const dynamic="force-dynamic";
export default async function GuessTheLipsyncPage(){
 const supabase=await createClient();
 const [f,s,q,l]=await Promise.all([
  supabase.from("drag_race_franchises").select("code,name").order("sort_order"),
  supabase.from("drag_race_seasons").select("id,franchise_code,season_number,name").order("year"),
  supabase.from("drag_race_queens").select("id,name,aliases,image_url").range(0,4999),
  supabase.from("drag_race_lipsyncs").select("id,season_id,song_title,song_artist,queen_ids,preview_url,apple_music_url,source_version").not("song_artist","is",null).range(0,4999)
 ]);
 return <GuessTheLipsyncGame franchises={f.data??[]} seasons={s.data??[]} queens={(q.data??[]).map(x=>({...x,aliases:x.aliases??[],image_url:x.image_url??("/api/drag-race/queen-image?id="+encodeURIComponent(x.id))}))} lipsyncs={(l.data??[]).filter(x=>x.song_artist&&Array.isArray(x.queen_ids)&&x.queen_ids.length===2).map(x=>({...x,song_artist:x.song_artist??"",preview_url:x.preview_url??null}))}/>;
}
