import { createClient } from "@/lib/supabase/server";
import { RenqTrashBrowser } from "@/components/renq-trash-browser";

export const dynamic = "force-dynamic";

export default async function RenqTrashPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: rankings } = await supabase.from("rankings")
    .select("id,public_slug,title,mode,settings,created_at,deleted_at")
    .eq("user_id", user.id).not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  const initialItems = (rankings ?? []).map(ranking => {
    const settings = (ranking.settings ?? {}) as Record<string, unknown>;
    const snapshot = (settings.savedSnapshot ?? {}) as { items?: { title: string }[] };
    return { id: ranking.id, public_slug: ranking.public_slug, title: ranking.title, mode: ranking.mode, deleted_at: ranking.deleted_at, count: snapshot.items?.length ?? 0 };
  });
  return <RenqTrashBrowser initialItems={initialItems} />;
}
