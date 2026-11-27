"use client";
import {useEffect,useState} from "react";
import {UserPlus,UserCheck,Clock3} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
export function ProfileFollowButton({targetUserId}:{targetUserId:string}){
 const[status,setStatus]=useState<"none"|"PENDING"|"ACCEPTED">("none");const[loading,setLoading]=useState(false);const[message,setMessage]=useState("");
 useEffect(()=>{
  const supabase=createClient();let active=true;let channel:ReturnType<typeof supabase.channel>|null=null;
  void (async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user||user.id===targetUserId)return;
   const {data}=await supabase.from("user_follows").select("status").eq("follower_id",user.id).eq("followed_id",targetUserId).maybeSingle();
   if(active&&data)setStatus(data.status as "PENDING"|"ACCEPTED");
   channel=supabase.channel("renqd-follow-"+user.id+"-"+targetUserId).on("postgres_changes",{event:"*",schema:"public",table:"user_follows",filter:"follower_id=eq."+user.id},payload=>{
    const row=(payload.new??payload.old) as {followed_id?:string;status?:string};if(row.followed_id!==targetUserId)return;
    if(payload.eventType==="DELETE")setStatus("none");else if(row.status==="PENDING"||row.status==="ACCEPTED")setStatus(row.status);
   }).subscribe();
  })();
  return()=>{active=false;if(channel)void supabase.removeChannel(channel);};
 },[targetUserId]);
 async function toggle(){
  if(loading)return;setLoading(true);setMessage("");
  try{const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();if(!user){setMessage("Accedi per seguire questo profilo.");return;}if(user.id===targetUserId)return;
   if(status!=="none"){const {error}=await supabase.from("user_follows").delete().eq("follower_id",user.id).eq("followed_id",targetUserId);if(error)throw error;setStatus("none");}
   else{const {data,error}=await supabase.from("user_follows").insert({follower_id:user.id,followed_id:targetUserId}).select("status").single();if(error)throw error;setStatus(data.status as "PENDING"|"ACCEPTED");}
  }catch(e){setMessage(e instanceof Error?e.message:"Operazione non riuscita.");}
  finally{setLoading(false);}
 }
 return <div className="profile-follow-wrap"><button type="button" className="profile-follow-button" onClick={()=>void toggle()} disabled={loading}>{status==="ACCEPTED"?<><UserCheck size={16}/> Segui già</>:status==="PENDING"?<><Clock3 size={16}/> Richiesta inviata</>:<><UserPlus size={16}/> Segui</>}</button>{message&&<small>{message}</small>}</div>;
}
