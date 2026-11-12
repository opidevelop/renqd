import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RenqExperience } from "@/components/renq-experience";
export const dynamic="force-dynamic";
export default async function RenqPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)notFound();
 const {data:ranking}=await supabase.from("rankings").select("*").eq("id",id).eq("user_id",user.id).single();if(!ranking)notFound();
 const {data:items}=await supabase.from("ranking_items").select("id,title_snapshot,sort_order,rank_position,custom_item_id").eq("ranking_id",id).order("rank_position",{ascending:true,nullsFirst:false}).order("sort_order");
 const customIds=(items??[]).map(x=>x.custom_item_id).filter(Boolean) as string[];
 const {data:custom}=customIds.length?await supabase.from("custom_items").select("id,title,image_url,description").in("id",customIds):{data:[]};
 const lookup=new Map((custom??[]).map(x=>[x.id,x]));
 const hydrated=(items??[]).map(x=>({...x,title:lookup.get(x.custom_item_id)?.title??x.title_snapshot,image_url:lookup.get(x.custom_item_id)?.image_url??null,description:lookup.get(x.custom_item_id)?.description??null}));
 return <RenqExperience ranking={ranking} items={hydrated}/>;
}
