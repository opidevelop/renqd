import { createClient } from "@/lib/supabase/server";
import { MyRenqsBrowser } from "@/components/my-renqs-browser";

export const dynamic = "force-dynamic";

export default async function MyRenqsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: rankings } = await supabase.from("rankings").select("id,public_slug,title,mode,status,settings,created_at,started_at,completed_at").eq("user_id", user.id).in("status", ["COMPLETED","DRAFT"]).order("completed_at", { ascending: false });
  const saved = (rankings ?? []).filter(item => Boolean((item.settings as Record<string,unknown> | null)?.savedAt));
  const initialItems = await Promise.all(saved.map(async ranking => {
    const settings = (ranking.settings ?? {}) as Record<string,unknown>;
    const snapshot = (settings.savedSnapshot ?? {}) as { items?: { title:string; image_url?:string|null; rank_position?:number|null }[] };
    const rows = snapshot.items ?? [];
    const coverPath = typeof settings.coverImagePath === "string" ? settings.coverImagePath : null;
    const { data: signed } = coverPath ? await supabase.storage.from("renq-covers").createSignedUrl(coverPath,60*60*24*7) : { data:null };
    return {
      id: ranking.id, public_slug: ranking.public_slug, title: ranking.title, mode: ranking.mode,
      elapsedSeconds: ranking.mode === "SPEED_RENQ" && ranking.started_at && ranking.completed_at ? Math.max(0, Math.round((new Date(ranking.completed_at).getTime() - new Date(ranking.started_at).getTime()) / 1000)) : null,
      created_at: String(settings.savedAt ?? ranking.completed_at ?? ranking.created_at), rows,
      category: String(settings.category ?? "custom"),
      coverImage: signed?.signedUrl ?? (typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : rows.find(row=>row.image_url)?.image_url ?? null),
      coverPosition: settings.coverPosition && typeof settings.coverPosition === "object" ? settings.coverPosition as {x:number;y:number} : {x:50,y:50}
    };
  }));
  return <MyRenqsBrowser initialItems={initialItems}/>;
}
