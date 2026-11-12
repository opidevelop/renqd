import type { NextRequest } from "next/server";

type MusicEntity = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  provider: "itunes" | "musicbrainz";
  payload?: Record<string, unknown>;
};

type MusicItem = { id: string; title: string; subtitle?: string; imageUrl?: string; previewUrl?: string; appleMusicUrl?: string; spotifyUrl?: string };

const ITUNES = "https://itunes.apple.com";
const MUSICBRAINZ = "https://musicbrainz.org/ws/2";
const USER_AGENT = "Renqd/0.1.0 (https://renqd.it)";
let lastMusicBrainzRequest = 0;
let musicBrainzQueue: Promise<unknown> = Promise.resolve();

async function musicBrainzJson<T>(url: string): Promise<T> {
  const task = musicBrainzQueue.then(async () => {
    const wait = Math.max(0, 1000 - (Date.now() - lastMusicBrainzRequest));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      next: { revalidate: 3600 },
    });
    lastMusicBrainzRequest = Date.now();
    if (!response.ok) throw new Error(`MusicBrainz returned ${response.status}`);
    return response.json() as Promise<T>;
  });
  musicBrainzQueue = task.then(() => undefined, () => undefined);
  return task;
}

async function itunesJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`iTunes returned ${response.status}`);
  return response.json() as Promise<T>;
}

function spotifySearchUrl(query: string) { return `https://open.spotify.com/search/${encodeURIComponent(query)}`; }

function normalizeMusicText(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

function artistCredit(credits?: Array<{ name?: string; artist?: { name?: string } }>) {
  return (credits ?? []).map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ");
}

async function resolveArtistImage(name: string): Promise<string | undefined> {
  const params = new URLSearchParams({ action: "query", titles: name, prop: "pageimages", piprop: "thumbnail", pithumbsize: "400", format: "json" });
  try {
    const response = await fetch("https://en.wikipedia.org/w/api.php?" + params, { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, next: { revalidate: 86400 } });
    if (response.ok) {
      const data = await response.json() as { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } };
      const image = Object.values(data.query?.pages ?? {}).find((page) => page.thumbnail?.source)?.thumbnail?.source;
      if (image) return image;
    }
  } catch { /* Try a catalog-art fallback below. */ }
  try {
    const fallbackParams = new URLSearchParams({ term: name, entity: "album", limit: "1", country: "IT" });
    const fallback = await itunesJson<{ results?: Array<{ artworkUrl100?: string }> }>(ITUNES + "/search?" + fallbackParams);
    const artwork = fallback.results?.[0]?.artworkUrl100;
    return typeof artwork === "string" ? artwork.replace("100x100", "300x300") : undefined;
  } catch { return undefined; }
}
async function searchItunes(query: string, contentType: string): Promise<MusicEntity[]> {
  const isAlbum = contentType === "Album";
  const params = new URLSearchParams({
    term: query,
    entity: isAlbum ? "album" : "musicArtist",
    limit: "8",
    country: "IT",
  });
  const data = await itunesJson<{ results?: Array<Record<string, unknown>> }>(`${ITUNES}/search?${params}`);
  const results = data.results ?? [];
  if (!isAlbum) {
    return Promise.all(results.flatMap((entry) => {
      if (typeof entry.artistId !== "number" || typeof entry.artistName !== "string") return [];
      return [resolveArtistImage(entry.artistName).then((imageUrl) => ({
        id: String(entry.artistId), title: entry.artistName as string,
        subtitle: typeof entry.primaryGenreName === "string" ? entry.primaryGenreName : "Artista",
        imageUrl, provider: "itunes" as const,
        payload: { artistId: entry.artistId, artistImageUrl: imageUrl },
        spotifyUrl: spotifySearchUrl(entry.artistName),
      }))];
    }));
  }
  return results.flatMap<MusicEntity>((entry) => {
    if (isAlbum) {
      if (typeof entry.collectionId !== "number" || typeof entry.collectionName !== "string") return [];
      const artist = typeof entry.artistName === "string" ? entry.artistName : "Artista sconosciuto";
      const year = typeof entry.releaseDate === "string" ? entry.releaseDate.slice(0, 4) : "";
      return [{
        id: String(entry.collectionId),
        title: entry.collectionName,
        subtitle: [artist, year].filter(Boolean).join(" · "),
        imageUrl: typeof entry.artworkUrl100 === "string" ? entry.artworkUrl100.replace("100x100", "300x300") : undefined,
        provider: "itunes" as const,
        payload: { collectionId: entry.collectionId, artistId: entry.artistId, artistName: artist },
        spotifyUrl: spotifySearchUrl(`${artist} ${entry.collectionName}`),
      }];
    }
    return [];
  });
}

async function searchMusicBrainz(query: string, contentType: string): Promise<MusicEntity[]> {
  const isAlbum = contentType === "Album";
  const resource = isAlbum ? "release-group" : "artist";
  const params = new URLSearchParams({ query, fmt: "json", limit: "8" });
  const data = await musicBrainzJson<Record<string, unknown>>(`${MUSICBRAINZ}/${resource}?${params}`);
  if (isAlbum) {
    const groups = ((data["release-groups"] ?? []) as Array<Record<string, unknown>>).filter((group) => group["primary-type"] === "Album");
    return groups.flatMap<MusicEntity>((group) => {
      if (typeof group.id !== "string" || typeof group.title !== "string") return [];
      const credits = group["artist-credit"] as Array<{ name?: string; artist?: { name?: string } }> | undefined;
      const date = typeof group["first-release-date"] === "string" ? group["first-release-date"] : "";
      return [{
        id: group.id,
        title: group.title,
        subtitle: [artistCredit(credits), date].filter(Boolean).join(" · "),
        imageUrl: "https://coverartarchive.org/release-group/" + group.id + "/front-250",
        provider: "musicbrainz" as const,
        payload: { releaseGroupId: group.id, imageUrl: "https://coverartarchive.org/release-group/" + group.id + "/front-250", albumTitle: group.title, artistName: artistCredit(credits) },
        spotifyUrl: spotifySearchUrl(`${artistCredit(credits)} ${group.title}`),
      }];
    });
  }
  const artists = (data.artists ?? []) as Array<Record<string, unknown>>;
  return Promise.all(artists.flatMap((artist) => {
    if (typeof artist.id !== "string" || typeof artist.name !== "string") return [];
    const disambiguation = typeof artist.disambiguation === "string" ? artist.disambiguation : "";
    const country = typeof artist.country === "string" ? artist.country : "";
    return [resolveArtistImage(artist.name).then((imageUrl) => ({
      id: artist.id as string, title: artist.name as string,
      subtitle: [disambiguation, country].filter(Boolean).join(" · ") || "Artista",
      imageUrl, provider: "musicbrainz" as const,
      payload: { artistId: artist.id, artistImageUrl: imageUrl },
      spotifyUrl: spotifySearchUrl(artist.name),
    }))];
  }));
}

async function loadItunesItems(payload: Record<string, unknown>, contentType: string): Promise<MusicItem[]> {
  const id = contentType === "Album" ? payload.collectionId : payload.artistId;
  if (typeof id !== "number" || !Number.isSafeInteger(id)) throw new Error("Invalid iTunes catalog identifier");
  const params = new URLSearchParams({ id: String(id), entity: contentType === "Album" ? "song" : "album", limit: "200", country: "IT" });
  const data = await itunesJson<{ results?: Array<Record<string, unknown>> }>(`${ITUNES}/lookup?${params}`);
  return (data.results ?? []).flatMap((entry) => {
    if (contentType === "Album") {
      if (entry.wrapperType !== "track" || typeof entry.trackName !== "string") return [];
      const artist = typeof entry.artistName === "string" ? entry.artistName : "";
      return [{ id: String(entry.trackId ?? entry.trackName), title: entry.trackName, subtitle: artist || undefined, imageUrl: typeof entry.artworkUrl100 === "string" ? entry.artworkUrl100.replace("100x100", "300x300") : undefined, previewUrl: typeof entry.previewUrl === "string" ? entry.previewUrl : undefined, appleMusicUrl: typeof entry.trackViewUrl === "string" ? entry.trackViewUrl : undefined, spotifyUrl: spotifySearchUrl(`${artist} ${entry.trackName}`) }];
    }
    if (entry.wrapperType !== "collection" || typeof entry.collectionName !== "string") return [];
    const year = typeof entry.releaseDate === "string" ? entry.releaseDate.slice(0, 4) : "";
    const artist = typeof payload.artistName === "string" ? payload.artistName : "";
    return [{ id: String(entry.collectionId ?? entry.collectionName), title: entry.collectionName, subtitle: year || undefined, imageUrl: typeof payload.artistImageUrl === "string" ? payload.artistImageUrl : (typeof entry.artworkUrl100 === "string" ? entry.artworkUrl100.replace("100x100", "300x300") : undefined), spotifyUrl: spotifySearchUrl(`${artist} ${entry.collectionName}`) }];
  });
}

async function loadItunesAlbumTrackMetadata(albumTitle: string, artistName: string) {
  try {
    const searchParams = new URLSearchParams({ term: `${albumTitle} ${artistName}`.trim(), entity: "album", limit: "5", country: "IT" });
    const search = await itunesJson<{ results?: Array<Record<string, unknown>> }>(`${ITUNES}/search?${searchParams}`);
    const wantedAlbum = normalizeMusicText(albumTitle);
    const wantedArtist = normalizeMusicText(artistName);
    const match = (search.results ?? []).find((entry) => typeof entry.collectionId === "number" && normalizeMusicText(String(entry.collectionName ?? "")) === wantedAlbum && (!wantedArtist || normalizeMusicText(String(entry.artistName ?? "")) === wantedArtist));
    if (!match || typeof match.collectionId !== "number") return new Map<string, { previewUrl?: string; appleMusicUrl?: string }>();
    const lookupParams = new URLSearchParams({ id: String(match.collectionId), entity: "song", limit: "200", country: "IT" });
    const lookup = await itunesJson<{ results?: Array<Record<string, unknown>> }>(`${ITUNES}/lookup?${lookupParams}`);
    const metadata = new Map<string, { previewUrl?: string; appleMusicUrl?: string }>();
    for (const track of lookup.results ?? []) {
      if (track.wrapperType !== "track" || typeof track.trackName !== "string") continue;
      metadata.set(normalizeMusicText(track.trackName), { previewUrl: typeof track.previewUrl === "string" ? track.previewUrl : undefined, appleMusicUrl: typeof track.trackViewUrl === "string" ? track.trackViewUrl : undefined });
    }
    return metadata;
  } catch { return new Map<string, { previewUrl?: string; appleMusicUrl?: string }>(); }
}

async function loadMusicBrainzItems(payload: Record<string, unknown>, contentType: string): Promise<MusicItem[]> {
  if (contentType === "Album") {
    const id = payload.releaseGroupId;
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid MusicBrainz release-group identifier");
    const params = new URLSearchParams({ "release-group": id, inc: "recordings", fmt: "json", limit: "1" });
    const data = await musicBrainzJson<{ releases?: Array<{ media?: Array<{ tracks?: Array<{ id?: string; position?: number; title?: string; recording?: { id?: string; title?: string } }> }> }> }>(`${MUSICBRAINZ}/release?${params}`);
    const tracks = data.releases?.[0]?.media?.flatMap((medium) => medium.tracks ?? []) ?? [];
    const albumTitle = typeof payload.albumTitle === "string" ? payload.albumTitle : "";
    const artistName = typeof payload.artistName === "string" ? payload.artistName : "";
    const previewMetadata = albumTitle ? await loadItunesAlbumTrackMetadata(albumTitle, artistName) : new Map<string, { previewUrl?: string; appleMusicUrl?: string }>();
    return tracks.flatMap((track) => {
      const title = track.recording?.title ?? track.title;
      if (!title) return [];
      const metadata = previewMetadata.get(normalizeMusicText(title));
      return [{ id: track.recording?.id ?? track.id ?? `${track.position}-${title}`, title, subtitle: track.position ? `Traccia ${track.position}` : undefined, imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl : undefined, previewUrl: metadata?.previewUrl, appleMusicUrl: metadata?.appleMusicUrl, spotifyUrl: spotifySearchUrl(`${artistName} ${title}`) }];
    });
  }
  const id = payload.artistId;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid MusicBrainz artist identifier");
  const params = new URLSearchParams({ artist: id, type: "album|ep", fmt: "json", limit: "100" });
  const data = await musicBrainzJson<{ "release-groups"?: Array<{ id: string; title: string; "first-release-date"?: string; "primary-type"?: string }> }>(`${MUSICBRAINZ}/release-group?${params}`);
  const artistName = typeof payload.artistName === "string" ? payload.artistName : "";
  return (data["release-groups"] ?? []).map((group) => ({ id: group.id, title: group.title, subtitle: [group["primary-type"], group["first-release-date"]].filter(Boolean).join(" · ") || undefined, imageUrl: typeof payload.artistImageUrl === "string" ? payload.artistImageUrl : undefined, spotifyUrl: spotifySearchUrl(`${artistName} ${group.title}`) }));
}
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const action = params.get("action");
  const provider = params.get("provider");
  const contentType = params.get("contentType");
  if (!["itunes", "musicbrainz"].includes(provider ?? "") || !["Album", "Artisti", "Discografie"].includes(contentType ?? "")) {
    return Response.json({ error: "Unsupported music catalog request." }, { status: 400 });
  }

  try {
    if (action === "search") {
      const query = params.get("query")?.trim() ?? "";
      if (query.length < 2 || query.length > 100) return Response.json({ error: "La ricerca deve contenere da 2 a 100 caratteri." }, { status: 400 });
      const entities = provider === "itunes"
        ? await searchItunes(query, contentType!)
        : await searchMusicBrainz(query, contentType!);
      return Response.json({ entities });
    }

    if (action === "items") {
      const rawPayload = params.get("payload");
      if (!rawPayload || rawPayload.length > 2000) return Response.json({ error: "Catalog item payload is missing or invalid." }, { status: 400 });
      const payload = JSON.parse(rawPayload) as Record<string, unknown>;
      const items = provider === "itunes"
        ? await loadItunesItems(payload, contentType!)
        : await loadMusicBrainzItems(payload, contentType!);
      return Response.json({ items });
    }

    return Response.json({ error: "Unsupported catalog action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog provider error";
    const upstreamStatus = Number(message.match(/returned (\d{3})/)?.[1] ?? 0);
    const status = [403, 429, 503].includes(upstreamStatus) ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
