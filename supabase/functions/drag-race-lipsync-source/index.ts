import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseLipsyncTables } from "./wikipedia-parser.js";

type SeasonRow = {
  id: string;
  franchise_code: string;
  season_number: number;
  name: string;
  cast_ids: string[];
};
type QueenRow = { id: string; name: string; aliases: string[] };
type WikiRow = { episode: number; songTitle: string; songArtist: string | null; queenIds: string[]; rawRow: string[] };
type Candidate = {
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
};
type CachedSeason = { expiresAt: number; rows: WikiRow[]; sourceUrl: string; revision: string | null };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const normalize = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
const cache = new Map<string, CachedSeason>();
const CACHE_TTL = 6 * 60 * 60 * 1000;
const userAgent = "Renqd/1.0 (https://renqd.app; Drag Race game lipsync lookup)";

function pageTitle(name: string) {
  return name.replace(/ Season ([0-9]+)$/i, " season $1").replace(/ Series ([0-9]+)$/i, " series $1");
}
function uniquePairs(rows: WikiRow[]) {
  const pairs = new Map<string, string[]>();
  for (const row of rows) {
    if (row.queenIds.length !== 2) continue;
    const key = [...row.queenIds].sort().join("|");
    if (!pairs.has(key)) pairs.set(key, row.queenIds);
  }
  return [...pairs.values()];
}
function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function fetchSeasonRows(season: SeasonRow, cast: QueenRow[], episodeNumbers: number[]): Promise<CachedSeason> {
  const cached = cache.get(season.id);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const title = pageTitle(season.name);
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "text|revid");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("redirects", "1");

  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Wikipedia HTTP ${response.status}`);
  const payload = await response.json() as {
    parse?: { title?: string; revid?: number; text?: string };
    error?: { info?: string };
  };
  if (!payload.parse?.text) throw new Error(payload.error?.info ?? "Wikipedia page unavailable");

  const sourceTitle = payload.parse.title ?? title;
  const sourceUrl = "https://en.wikipedia.org/wiki/" + encodeURIComponent(sourceTitle.replace(/ /g, "_"));
  const rows = parseLipsyncTables(payload.parse.text, episodeNumbers.map((number) => ({ number })), cast) as WikiRow[];
  const result: CachedSeason = {
    expiresAt: Date.now() + CACHE_TTL,
    rows,
    sourceUrl,
    revision: payload.parse.revid ? String(payload.parse.revid) : null,
  };
  cache.set(season.id, result);
  return result;
}

async function findPreview(song: string, artist: string) {
  const params = new URLSearchParams({ term: `${song} ${artist}`, entity: "song", limit: "50", country: "US" });
  const response = await fetch("https://itunes.apple.com/search?" + params, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const payload = await response.json() as {
    results?: Array<{ trackName?: string; artistName?: string; previewUrl?: string; trackViewUrl?: string }>;
  };
  const exact = (payload.results ?? []).filter((item) =>
    item.trackName && item.artistName && item.previewUrl &&
    normalize(item.trackName) === normalize(song) &&
    normalize(item.artistName) === normalize(artist)
  );
  const preview = exact.find((item) => Boolean(item.previewUrl));
  return preview?.previewUrl
    ? { previewUrl: preview.previewUrl, appleMusicUrl: preview.trackViewUrl ?? null }
    : null;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply({ error: "Server configuration unavailable" }, 500);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return reply({ error: "Authentication required" }, 401);
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return reply({ error: "Authentication required" }, 401);

  const { data: profile, error: profileError } = await userClient
    .from("profiles").select("role,status").eq("id", auth.user.id).maybeSingle();
  if (profileError || profile?.status !== "APPROVED") return reply({ error: "Approved account required" }, 403);

  let body: { franchiseCodes?: string[]; seasonIds?: string[]; count?: number; excludeSongIds?: string[] } = {};
  try { body = await request.json(); } catch { return reply({ error: "Invalid request body" }, 400); }
  const franchiseCodes = Array.isArray(body.franchiseCodes)
    ? [...new Set(body.franchiseCodes.filter((value) => typeof value === "string"))]
    : [];
  const seasonIds = Array.isArray(body.seasonIds)
    ? [...new Set(body.seasonIds.filter((value) => typeof value === "string"))]
    : [];
  const count = Math.max(1, Math.min(200, Number.isFinite(body.count) ? Math.floor(body.count!) : 1));
  const excluded = new Set((body.excludeSongIds ?? []).filter((value) => typeof value === "string"));

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  let seasonQuery = admin.from("drag_race_seasons")
    .select("id,franchise_code,season_number,name,cast_ids")
    .order("franchise_code").order("season_number");
  if (seasonIds.length) seasonQuery = seasonQuery.in("id", seasonIds);
  else if (franchiseCodes.length) seasonQuery = seasonQuery.in("franchise_code", franchiseCodes);
  const { data: seasonsData, error: seasonsError } = await seasonQuery;
  if (seasonsError) return reply({ error: "Season catalog unavailable" }, 502);
  const seasons = (seasonsData ?? []) as SeasonRow[];
  if (!seasons.length) return reply({ songs: [], coverage: { seasonsRequested: 0, seasonsRead: 0, rowsFound: 0 } });

  const castIds = [...new Set(seasons.flatMap((season) => season.cast_ids ?? []))];
  const queenRows: QueenRow[] = [];
  for (let offset = 0; offset < castIds.length; offset += 200) {
    const { data, error } = await admin.from("drag_race_queens")
      .select("id,name,aliases").in("id", castIds.slice(offset, offset + 200));
    if (error) return reply({ error: "Queen catalog unavailable" }, 502);
    queenRows.push(...((data ?? []) as QueenRow[]));
  }
  const queenById = new Map(queenRows.map((queen) => [queen.id, queen]));
  const { data: episodeData, error: episodeError } = await admin.from("drag_race_episodes")
    .select("season_id,episode_number").in("season_id", seasons.map((season) => season.id));
  if (episodeError) return reply({ error: "Episode catalog unavailable" }, 502);
  const episodeNumbers = new Map<string, number[]>();
  for (const episode of episodeData ?? []) { const list = episodeNumbers.get(episode.season_id) ?? []; list.push(episode.episode_number); episodeNumbers.set(episode.season_id, list); }
  const seasonResults: Array<{ season: SeasonRow; cached: CachedSeason }> = [];
  let failedSeasons = 0;
  for (let offset = 0; offset < seasons.length; offset += 8) {
    const batch = await Promise.all(seasons.slice(offset, offset + 8).map(async (season) => {
      const cast = (season.cast_ids ?? []).map((id) => queenById.get(id)).filter((queen): queen is QueenRow => Boolean(queen));
      try { return { season, cached: await fetchSeasonRows(season, cast, episodeNumbers.get(season.id) ?? []) }; }
      catch (error) { console.warn("Wikipedia lipsync lookup", season.id, error); failedSeasons++; return null; }
    }));
    seasonResults.push(...batch.filter((item): item is { season: SeasonRow; cached: CachedSeason } => Boolean(item)));
  }

  const groups = new Map<string, {
    title: string; artist: string; rows: Array<{ season: SeasonRow; row: WikiRow; cached: CachedSeason }>;
  }>();
  for (const item of seasonResults) {
    for (const row of item.cached.rows) {
      if (!row.songTitle || !row.songArtist || row.queenIds.length !== 2) continue;
      if (row.queenIds.some((id) => !queenById.has(id))) continue;
      const key = normalize(row.songTitle) + "|" + normalize(row.songArtist);
      const group = groups.get(key) ?? { title: row.songTitle, artist: row.songArtist, rows: [] };
      group.rows.push({ season: item.season, row, cached: item.cached });
      groups.set(key, group);
    }
  }

  const songs: Candidate[] = [];
  const shuffledGroups = shuffle([...groups.values()]).filter((group) => !excluded.has(normalize(group.title + "|" + group.artist)));
  for (let offset = 0; offset < shuffledGroups.length && songs.length < count; offset += 8) {
    const batch = await Promise.all(shuffledGroups.slice(offset, offset + 8).map(async (group) => ({
      group,
      preview: await findPreview(group.title, group.artist).catch(() => null),
    })));
    for (const { group, preview } of batch) {
      if (!preview || songs.length >= count) continue; // Skip unresolved/unplayable songs.
      const pairs = uniquePairs(group.rows.map((item) => item.row));
      if (!pairs.length) continue;
      const first = group.rows[0];
      const queenIds = [...new Set(pairs.flat())];
      songs.push({
        id: normalize(group.title + "|" + group.artist),
        season_id: first.season.id,
        episode_number: first.row.episode,
        song_title: group.title,
        song_artist: group.artist,
        queen_ids: queenIds,
        pairs,
        preview_url: preview.previewUrl,
        apple_music_url: preview.appleMusicUrl,
        source_url: first.cached.sourceUrl,
        source_revision: first.cached.revision,
        occurrences: group.rows.map((item) => ({ season_id: item.season.id, episode_number: item.row.episode, queen_ids: item.row.queenIds, source_url: item.cached.sourceUrl, source_revision: item.cached.revision })),
      });
    }
  }

  return reply({
    songs,
    coverage: {
      seasonsRequested: seasons.length,
      seasonsRead: seasonResults.length,
      seasonsUnavailable: failedSeasons,
      rowsFound: [...groups.values()].reduce((sum, group) => sum + group.rows.length, 0),
      uniqueSongs: groups.size,
      playableSongs: songs.length,
    },
  });
});
