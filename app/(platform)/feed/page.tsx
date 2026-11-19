import {createClient} from "@/lib/supabase/server";
import {getProfileMediaUrl} from "@/lib/supabase/profile-media";
import {SocialFeed,type SocialFeedItem} from "@/components/social-feed";
export const dynamic="force-dynamic";
export default async function FeedPage(){
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("renqd_get_social_feed",{p_event_types:null,p_before:null,p_limit:50});
 const rows=error?[]:(((data??{}) as {items?:SocialFeedItem[]}).items??[]);
 const items=await Promise.all(rows.map(async item=>({...item,actor:{...item.actor,avatarUrl:await getProfileMediaUrl(supabase,item.actor.avatarUrl)}})));
 return <SocialFeed items={items}/>;
}