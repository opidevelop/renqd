import {createClient} from "@/lib/supabase/server";
import {GuessThemAllGame} from "@/components/drag-race/guess-them-all-game";
export const dynamic="force-dynamic";
export default async function GuessThemAllPage(){
 const db=await createClient();const [f,s,q]=await Promise.all([
  db.from("drag_race_franchises").select("code,name,region").order("sort_order"),
  db.from("drag_race_seasons").select("id,franchise_code,season_number,name,year,cast_ids").order("year"),
  db.from("drag_race_queens").select("id,name,aliases,image_url,appearances").range(0,4999)
 ]);
 const franchiseOrder=new Map((f.data??[]).map((item,index)=>[item.code,index]));
 const seasons=[...(s.data??[])].sort((a,b)=>(franchiseOrder.get(a.franchise_code)??999)-(franchiseOrder.get(b.franchise_code)??999)||a.season_number-b.season_number);
 const seasonById=new Map(seasons.map(item=>[item.id,item]));
 const codes=new Map<string,string[]>(),firstAppearance=new Map<string,{franchiseCode:string;seasonId:string;seasonNumber:number}>();
 for(const season of seasons)for(const id of season.cast_ids??[]){
  const list=codes.get(id)??[];if(!list.includes(season.franchise_code))list.push(season.franchise_code);codes.set(id,list);
  if(!firstAppearance.has(id))firstAppearance.set(id,{franchiseCode:season.franchise_code,seasonId:season.id,seasonNumber:season.season_number});
 }
 const franchiseNames=Object.fromEntries((f.data??[]).map(item=>[item.code,item.name]));
 return <GuessThemAllGame franchises={(f.data??[]).map(item=>({...item,flag:({US:"🇺🇸",AS:"🇺🇸",UK:"🇬🇧",UKVTW:"🌍",DE:"🇩🇪",FR:"🇫🇷",NL:"🇳🇱",BE:"🇧🇪",SE:"🇸🇪",ES:"🇪🇸",ESAS:"🇪🇸",GAS:"🌍",CA:"🇨🇦",CVTW:"🌍",CAS:"🇨🇦",DU:"🇦🇺🇳🇿",TH:"🇹🇭",PH:"🇵🇭",PHSR:"🇵🇭",IT:"🇮🇹",BR:"🇧🇷",MX:"🇲🇽",FRAS:"🇫🇷"} as Record<string,string>)[item.code]??"🌍"}))}
  seasons={seasons.map(item=>({id:item.id,franchise_code:item.franchise_code,season_number:item.season_number,name:item.name,year:item.year??null}))}
  queens={(q.data??[]).map(item=>{const first=firstAppearance.get(item.id);return {...item,aliases:item.aliases??[],image_url:item.image_url??("/api/drag-race/queen-image?id="+encodeURIComponent(item.id)),franchiseCodes:codes.get(item.id)??[],firstSeason:first?.seasonNumber??999,primaryFranchiseCode:first?.franchiseCode??"",primarySeasonId:first?.seasonId??"",appearances:Array.isArray(item.appearances)?item.appearances:[]};})}/>
}
