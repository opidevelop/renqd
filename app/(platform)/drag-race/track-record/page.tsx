import {createClient} from "@/lib/supabase/server";
import {TrackRecordHub} from "@/components/drag-race/track-record-hub";
export const dynamic="force-dynamic";
type HallOfFameEntry={id:string;queenId:string|null;queenName:string;imageUrl:string|null;franchiseCode:string;seasonNumber:number|null;year:number|null;seasonTitle:string;recordId:string};
export default async function TrackRecordPage(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return null;
 const [t,r,f,profile,queens,allVisibleRecords]=await Promise.all([
  db.from("drag_race_track_record_templates").select("id,franchise_code,season_number,display_title,year,season_id,episodes,queens,source_metadata").order("franchise_code").order("season_number"),
  db.from("drag_race_track_records").select("id,title,season_id,visibility,updated_at,record_data").eq("owner_id",user.id).is("deleted_at",null).order("updated_at",{ascending:false}),
  db.from("drag_race_franchises").select("code,name"),
  db.from("profiles").select("role,status").eq("id",user.id).maybeSingle(),
  db.from("drag_race_queens").select("id,name,aliases,image_url").range(0,4999),
  db.from("drag_race_track_records").select("id,owner_id,title,visibility,record_data").is("deleted_at",null)
 ]);
 const franchiseNames=Object.fromEntries((f.data??[]).map(x=>[x.code,x.name]));
 const canSync=["OWNER","ADMIN","MODERATOR"].includes(String(profile.data?.role))&&profile.data?.status==="APPROVED";
 const queenById=new Map((queens.data??[]).map(q=>[q.id,q]));
 const hallOfFame:HallOfFameEntry[]=[];
 for(const record of allVisibleRecords.data??[]){
  const recordData=record.record_data as {franchise_code?:string;season_number?:number;year?:number;queens?:Array<{id?:string;name:string;image_url?:string|null;winner?:boolean}>};
  for(const queen of recordData.queens??[])if(queen.winner){
   const catalogQueen=queen.id?queenById.get(queen.id):null;
   hallOfFame.push({id:record.id+":"+(queen.id??queen.name),queenId:catalogQueen?.id??null,queenName:queen.name,imageUrl:queen.image_url??catalogQueen?.image_url??null,franchiseCode:recordData.franchise_code??"CUSTOM",seasonNumber:recordData.season_number??null,year:recordData.year??null,seasonTitle:record.title,recordId:record.id});
  }
 }
 return <TrackRecordHub userId={user.id} templates={t.data??[]} records={r.data??[]} franchiseNames={franchiseNames} hallOfFame={hallOfFame} catalogQueens={queens.data??[]}/>;
}
