import {createClient} from "@/lib/supabase/server";
import {getProfileMediaUrl} from "@/lib/supabase/profile-media";
import {InboxWorkspace} from "@/components/inbox-workspace";
export const dynamic="force-dynamic";
export default async function InboxPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return null;
 const [{data:notifications},{data:conversations}]=await Promise.all([
  supabase.from("user_notifications").select("id,actor_id,notification_type,payload,read_at,created_at").order("created_at",{ascending:false}).limit(100),
  supabase.from("direct_conversations").select("id,participant_one_id,participant_two_id,last_message_at,created_at").or("participant_one_id.eq."+user.id+",participant_two_id.eq."+user.id).order("last_message_at",{ascending:false,nullsFirst:false})
 ]);
 const rows=conversations??[];const ids=rows.map(row=>row.id);const otherIds=rows.map(row=>row.participant_one_id===user.id?row.participant_two_id:row.participant_one_id);
 const [{data:profiles},{data:reads},{data:messages}]=ids.length?await Promise.all([
  supabase.from("public_profiles").select("user_id,username,display_name,avatar_url,is_private").in("user_id",otherIds),
  supabase.from("direct_conversation_reads").select("conversation_id,last_read_at,user_id").in("conversation_id",ids),
  supabase.from("direct_messages").select("id,conversation_id,sender_id,body,created_at,deleted_at").in("conversation_id",ids).order("created_at",{ascending:false}).limit(2000)
 ]):[{data:[]},{data:[]},{data:[]}];
 const conversationsForUi=await Promise.all(rows.map(async row=>{
  const otherId=row.participant_one_id===user.id?row.participant_two_id:row.participant_one_id;
  const profile=(profiles??[]).find(item=>item.user_id===otherId);
  const avatarUrl=profile?.avatar_url?await getProfileMediaUrl(supabase,profile.avatar_url):null;
  const ownRead=(reads??[]).find(item=>item.conversation_id===row.id&&item.user_id===user.id)?.last_read_at??null;
  const otherRead=(reads??[]).find(item=>item.conversation_id===row.id&&item.user_id===otherId)?.last_read_at??null;
  const conversationMessages=(messages??[]).filter(item=>item.conversation_id===row.id);
  const latest=conversationMessages[0]??null;
  const unreadCount=conversationMessages.filter(item=>item.sender_id!==user.id&&(!ownRead||item.created_at>ownRead)).length;
  return {id:row.id,otherUserId:otherId,username:profile?.username??null,displayName:profile?.display_name||profile?.username||"Utente Renqd",avatarUrl,isPrivate:profile?.is_private??true,lastMessage:latest?{body:latest.deleted_at?"Messaggio eliminato":latest.body,senderId:latest.sender_id,createdAt:latest.created_at}:null,unreadCount,otherReadAt:otherRead};
 }));
 return <InboxWorkspace notifications={(notifications??[]) as Array<{id:string;actor_id:string|null;notification_type:string;payload:Record<string,unknown>;read_at:string|null;created_at:string}>} conversations={conversationsForUi} currentUserId={user.id}/>;
}
