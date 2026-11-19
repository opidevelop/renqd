import {createClient} from "@/lib/supabase/server";
import {ActivityInbox} from "@/components/activity-inbox";
export const dynamic="force-dynamic";
export default async function InboxPage(){const supabase=await createClient();const {data}=await supabase.from("user_notifications").select("id,actor_id,notification_type,payload,read_at,created_at").order("created_at",{ascending:false}).limit(100);return <ActivityInbox notifications={(data??[]) as Array<{id:string;actor_id:string|null;notification_type:string;payload:Record<string,unknown>;read_at:string|null;created_at:string}>}/>;}
