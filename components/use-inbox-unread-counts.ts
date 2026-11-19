"use client";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
type UnreadCounts={messages:number;activity:number};
export function useInboxUnreadCounts(userId:string,initial:UnreadCounts){
 const[counts,setCounts]=useState(initial);
 useEffect(()=>{
  const supabase=createClient();let active=true;
  const refresh=async()=>{
   const [{count:activityCount},{data:unreadRows}]=await Promise.all([
    supabase.from("user_notifications").select("id",{count:"exact",head:true}).eq("recipient_id",userId).is("read_at",null),
    supabase.rpc("renqd_direct_unread_counts")
   ]);
   if(!active)return;
   const rows=(unreadRows??[]) as Array<{conversation_id:string;unread_count:number}>;
   setCounts({activity:activityCount??0,messages:rows.reduce((sum,row)=>sum+Number(row.unread_count??0),0)});
  };
  const channel=supabase.channel("renqd-unread-counts-"+userId)
   .on("postgres_changes",{event:"*",schema:"public",table:"user_notifications",filter:"recipient_id=eq."+userId},()=>{void refresh();})
   .on("postgres_changes",{event:"*",schema:"public",table:"direct_messages"},()=>{void refresh();})
   .on("postgres_changes",{event:"*",schema:"public",table:"direct_conversation_reads",filter:"user_id=eq."+userId},()=>{void refresh();})
   .on("postgres_changes",{event:"*",schema:"public",table:"direct_conversations"},()=>{void refresh();})
   .subscribe();
  void refresh();
  return()=>{active=false;void supabase.removeChannel(channel);};
 },[userId]);
 return counts;
}