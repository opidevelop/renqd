"use client";
import {useSearchParams} from "next/navigation";
import {useEffect,useState} from "react";
import {Activity,MessageCircle} from "lucide-react";
import {ActivityInbox} from "@/components/activity-inbox";
import {DirectMessages} from "@/components/direct-messages";
type Notice={id:string;actor_id:string|null;notification_type:string;payload:Record<string,unknown>;read_at:string|null;created_at:string};
type Conversation={id:string;otherUserId:string;username:string|null;displayName:string;avatarUrl:string|null;isPrivate:boolean;lastMessage:{body:string;senderId:string;createdAt:string}|null;unreadCount:number;otherReadAt:string|null};
export function InboxWorkspace({notifications,conversations,currentUserId}:{notifications:Notice[];conversations:Conversation[];currentUserId:string}){
 const params=useSearchParams();const[tab,setTab]=useState<"messages"|"activity">(params.get("tab")==="activity"?"activity":"messages");
 useEffect(()=>{setTab(params.get("tab")==="activity"?"activity":"messages");},[params]);
 const unreadActivity=notifications.filter(item=>!item.read_at).length;const unreadMessages=conversations.reduce((sum,item)=>sum+item.unreadCount,0);
 return <div className="inbox-workspace"><div className="inbox-tabs" role="tablist" aria-label="Inbox"><button type="button" role="tab" aria-selected={tab==="messages"} className={tab==="messages"?"is-active":""} onClick={()=>setTab("messages")}><MessageCircle size={16}/> Messaggi{unreadMessages>0&&<i>{unreadMessages}</i>}</button><button type="button" role="tab" aria-selected={tab==="activity"} className={tab==="activity"?"is-active":""} onClick={()=>setTab("activity")}><Activity size={16}/> Attività{unreadActivity>0&&<i>{unreadActivity}</i>}</button></div>
 {tab==="messages"?<DirectMessages initialConversations={conversations} currentUserId={currentUserId} initialConversationId={params.get("conversation")}/>:<ActivityInbox notifications={notifications}/>}
 </div>;
}
