"use client";
import {useState} from "react";
import {MessageCircle,Check} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
export function MessageRequestButton({targetUserId,conversationId}:{targetUserId:string;conversationId:string|null}){
 const[loading,setLoading]=useState(false);const[requested,setRequested]=useState(false);const[error,setError]=useState("");
 if(conversationId)return <a className="profile-message-button" href={"/inbox?tab=messages&conversation="+conversationId}><MessageCircle size={15}/> Apri messaggi</a>;
 async function request(){if(loading||requested)return;setLoading(true);setError("");try{const supabase=createClient();const{error:rpcError}=await supabase.rpc("renqd_request_direct_message",{p_recipient_id:targetUserId});if(rpcError)throw rpcError;setRequested(true);}catch(e){setError(e instanceof Error?e.message:"Richiesta non inviata.");}finally{setLoading(false);}}
 return <div className="profile-message-request"><button type="button" className="profile-message-button" onClick={()=>void request()} disabled={loading||requested}>{requested?<><Check size={15}/> Richiesta inviata</>:<><MessageCircle size={15}/> Invia un messaggio</>}</button>{error&&<small role="alert">{error}</small>}</div>;
}
