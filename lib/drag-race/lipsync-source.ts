import type { createClient } from "@/lib/supabase/client";

type SupabaseClient = ReturnType<typeof createClient>;

export type DynamicLipsync = {
  id: string;
  season_id: string;
  episode_number: number;
  song_title: string;
  song_artist: string;
  queen_ids: string[];
  pairs: string[][];
  preview_url: string;
  apple_music_url: string | null;
  source_url: string;
  source_revision: string | null;
  occurrences: Array<{ season_id: string; episode_number: number; queen_ids: string[]; source_url: string; source_revision: string | null }>;
  source_version: string;
};

type LookupOptions = {
  franchiseCodes?: string[];
  seasonIds?: string[];
  count?: number;
  excludeSongIds?: string[];
};

export async function fetchDynamicLipsyncs(
  client: SupabaseClient,
  options: LookupOptions,
): Promise<{ songs: DynamicLipsync[]; coverage: Record<string, number> }> {
  const { data, error } = await client.functions.invoke("drag-race-lipsync-source", {
    body: options,
  });
  if (error) throw new Error(error.message || "Recupero dei lipsync non riuscito.");
  const songs = Array.isArray(data?.songs) ? data.songs : [];
  return {
    songs: songs.map((song: Omit<DynamicLipsync, "source_version"> & { source_revision?: string | null }) => ({
      ...song,
      source_version: song.source_revision ? "Wikipedia revision " + song.source_revision : "Wikipedia",
    })),
    coverage: data?.coverage ?? {},
  };
}
