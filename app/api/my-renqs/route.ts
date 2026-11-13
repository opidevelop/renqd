import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessione scaduta." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const category = params.get("category") ?? "";
  const mode = params.get("mode") ?? "";
  let requestQuery = supabase.from("rankings").select("id,public_slug,title,mode,status,settings,created_at,completed_at").eq("user_id", user.id).in("status", ["COMPLETED","DRAFT"]);
  if (query) requestQuery = requestQuery.ilike("title", "%" + query.replace(/[%_]/g, "\\$&") + "%");
  if (category) requestQuery = requestQuery.filter("settings->>category", "eq", category);
  if (mode) requestQuery = requestQuery.eq("mode", mode);
  const { data, error } = await requestQuery.order("completed_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Non è stato possibile cercare i Renq." }, { status: 500 });
  const saved = (data ?? []).filter(item => Boolean((item.settings as Record<string, unknown> | null)?.savedAt));
  const items = await Promise.all(saved.map(async ranking => {
    const settings = (ranking.settings ?? {}) as Record<string, unknown>;
    const snapshot = (settings.savedSnapshot ?? {}) as { items?: { title: string; image_url?: string | null; rank_position?: number | null }[] };
    const rows = snapshot.items ?? [];
    const coverPath = typeof settings.coverImagePath === "string" ? settings.coverImagePath : null;
    const { data: signed } = coverPath ? await supabase.storage.from("renq-covers").createSignedUrl(coverPath, 60 * 60 * 24 * 7) : { data: null };
    return {
      id: ranking.id, public_slug: ranking.public_slug, title: ranking.title, mode: ranking.mode,
      created_at: String(settings.savedAt ?? ranking.completed_at ?? ranking.created_at),
      rows, category: String(settings.category ?? "custom"),
      coverImage: signed?.signedUrl ?? (typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : rows.find(row => row.image_url)?.image_url ?? null),
      coverPosition: settings.coverPosition && typeof settings.coverPosition === "object" ? settings.coverPosition as { x: number; y: number } : { x: 50, y: 50 }
    };
  }));
  return NextResponse.json({ items });
}
