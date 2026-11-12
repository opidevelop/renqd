import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RenqExperience } from "@/components/renq-experience";
import { SavedRenqDetail } from "@/components/saved-renq-detail";

export const dynamic = "force-dynamic";

export default async function RenqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);\n  const { data: ranking } = isUuid\n    ? await supabase.from("rankings").select("*").eq("id", id).eq("user_id", user.id).single()\n    : await supabase.from("rankings").select("*").eq("public_slug", id).eq("user_id", user.id).single();
  if (!ranking) notFound();

  const settings = (ranking.settings ?? {}) as Record<string, unknown>;
  const coverImagePath = typeof settings.coverImagePath === "string" ? settings.coverImagePath : null;
  const { data: signedCover } = coverImagePath ? await supabase.storage.from("renq-covers").createSignedUrl(coverImagePath, 60 * 60 * 24 * 7) : { data: null };
  const resolvedCoverImageUrl = signedCover?.signedUrl ?? (typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : null);
  const savedSnapshot = settings.savedSnapshot as { items?: Array<{ id: string; title: string; image_url?: string | null; description?: string | null; rank_position?: number | null; tie_group_id?: string | null }> } | undefined;
  const isSaved = ranking.status === "COMPLETED" && Boolean(settings.savedAt) && Array.isArray(savedSnapshot?.items);

  if (isSaved) {
    const [{ data: comments, count: commentCount }, { data: liked }, { count: likeCount }] = await Promise.all([
      supabase.from("ranking_comments").select("id,body,created_at,author_id", { count: "exact" }).eq("ranking_id", id).is("deleted_at", null).order("created_at", { ascending: true }),
      supabase.from("ranking_likes").select("user_id").eq("ranking_id", id).eq("user_id", user.id).maybeSingle(),
      supabase.from("ranking_likes").select("user_id", { count: "exact", head: true }).eq("ranking_id", id)
    ]);
    return <SavedRenqDetail
      ranking={{ id: ranking.id, public_slug: ranking.public_slug, title: ranking.title, mode: ranking.mode, settings, created_at: ranking.created_at }}
      items={savedSnapshot?.items ?? []}
      coverImageUrl={resolvedCoverImageUrl}
      coverImagePath={coverImagePath}
      defaultCoverImageUrl={typeof settings.defaultCoverImageUrl === "string" ? settings.defaultCoverImageUrl : null}
      comments={comments ?? []}
      commentCount={commentCount ?? 0}
      initialLiked={Boolean(liked)}
      likeCount={likeCount ?? 0}
    />;
  }

  const { data: items } = await supabase.from("ranking_items").select("id,title_snapshot,sort_order,rank_position,tie_group_id,custom_item_id").eq("ranking_id", id).order("rank_position", { ascending: true, nullsFirst: false }).order("sort_order");
  const customIds = (items ?? []).map(x => x.custom_item_id).filter(Boolean) as string[];
  const { data: custom } = customIds.length ? await supabase.from("custom_items").select("id,title,image_url,description,metadata").in("id", customIds) : { data: [] };
  const lookup = new Map((custom ?? []).map(x => [x.id, x]));
  const hydrated = (items ?? []).map(x => ({
    ...x,
    title: lookup.get(x.custom_item_id)?.title ?? x.title_snapshot,
    image_url: lookup.get(x.custom_item_id)?.image_url ?? null,
    description: lookup.get(x.custom_item_id)?.description ?? null,
    preview_url: (lookup.get(x.custom_item_id)?.metadata as Record<string, unknown> | undefined)?.previewUrl as string | null,
    apple_music_url: (lookup.get(x.custom_item_id)?.metadata as Record<string, unknown> | undefined)?.appleMusicUrl as string | null,
    spotify_url: (lookup.get(x.custom_item_id)?.metadata as Record<string, unknown> | undefined)?.spotifyUrl as string | null
  }));
  return <RenqExperience ranking={{ ...ranking, settings: { ...settings, coverImageUrl: resolvedCoverImageUrl } }} items={hydrated} />;
}
