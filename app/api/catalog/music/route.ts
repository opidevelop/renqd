import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountAccess } from "@/lib/supabase/authorization";

type MusicEntity = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  spotifyUrl?: string;
  provider: "itunes" | "musicbrainz";
  payload?: Record<string, unknown>;
};

type MusicItem = { id: string; title: string; subtitle?: string; imageUrl?: string; previewUrl?: string; appleMusicUrl?: string; spotifyUrl?: string };
type MusicBrainzTrack = { id?: string; position?: number; title?: string; recording?: { id?: string; title?: string } };
type MusicBrainzRelease = { id?: string; title?: string; date?: string; country?: string; "release-group"?: { "primary-type"?: string }; media?: Array<{ tracks?: MusicBrainzTrack[] }> };

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

async function browseMusicBrainzReleases(artistId:string,include:string):Promise<MusicBrainzRelease[]>{
  const all:MusicBrainzRelease[]=[];
  let offset=0;
  for(let page=0;page<10;page++){
    const params=new URLSearchParams({artist:artistId,inc:include,fmt:"json",limit:"100",offset:String(offset)});
    const data=await musicBrainzJson<{releases?:MusicBrainzRelease[];"release-count"?:number}>(`${MUSICBRAINZ}/release?${params}`);
    const releases=data.releases??[];
    if(!releases.length)break;
    all.push(...releases);
    offset+=releases.length;
    const total=Number(data["release-count"]??0);
    if(total&&offset>=total)break;
  }
  return all;
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
  const countries = ["IT", "US", "GB"];
  const artistResponses = await Promise.allSettled(countries.map(async (country) => {
    const params = new URLSearchParams({ term: query, entity: "musicArtist", limit: "50", country });
    const data = await itunesJson<{ results?: Array<Record<string, unknown>> }>(`${ITUNES}/search?${params}`);
    return data.results ?? [];
  }));
  const artistResults = artistResponses.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const artistsById = new Map<string, Record<string, unknown>>();
  for (const artist of artistResults) {
    if (typeof artist.artistId === "number" && typeof artist.artistName === "string" && !artistsById.has(String(artist.artistId))) {
      artistsById.set(String(artist.artistId), artist);
    }
  }
  const artists = [...artistsById.values()];
  const normalizedQuery = normalizeMusicText(query);
  const exactArtists = artists.filter(artist => normalizeMusicText(String(artist.artistName)) === normalizedQuery);
  const selectedArtists = (exactArtists.length ? exactArtists : artists).slice(0, isAlbum ? 5 : 25);

  if (isAlbum) {
    const artistNames=selectedArtists.map(artist=>normalizeMusicText(String(artist.artistName))).sort((x,y)=>y.length-x.length);let residualQuery=normalizedQuery;
    for(const artistName of artistNames)residualQuery=residualQuery.replace(artistName," ").replace(/\s+/g," ").trim();
    const directAlbums:MusicEntity[]=[];
    if(residualQuery&&residualQuery!==normalizedQuery){const directParams=new URLSearchParams({term:residualQuery,entity:"album",limit:"50",country:"IT"});const direct=await itunesJson<{results?:Array<Record<string,unknown>>}>(`${ITUNES}/search?${directParams}`);for(const entry of direct.results??[]){if(typeof entry.collectionId!=="number"||typeof entry.collectionName!=="string")continue;const artistName=typeof entry.artistName==="string"?entry.artistName:"Artista sconosciuto",year=typeof entry.releaseDate==="string"?entry.releaseDate.slice(0,4):"";directAlbums.push({id:String(entry.collectionId),title:entry.collectionName,subtitle:[artistName,year].filter(Boolean).join(" · "),imageUrl:typeof entry.artworkUrl100==="string"?entry.artworkUrl100.replace(/\d+x\d+bb\./,"600x600bb."):undefined,provider:"itunes",payload:{collectionId:entry.collectionId,artistId:entry.artistId,artistName},spotifyUrl:spotifySearchUrl(`${artistName} ${entry.collectionName}`)});}}
    // Album mode intentionally returns the same complete artist discography
    // as Discography mode, instead of relying on iTunes' sparse album search.
    const discographies = await Promise.allSettled(selectedArtists.map(async artist => {
      const artistId = artist.artistId as number;
      const artistName = String(artist.artistName);
      const params = new URLSearchParams({ id: String(artistId), entity: "album", limit: "200", country: "IT" });
      const data = await itunesJson<{ results?: Array<Record<string, unknown>> }>(`${ITUNES}/lookup?${params}`);
      return (data.results ?? []).flatMap<MusicEntity>(entry => {
        if (entry.wrapperType !== "collection" || typeof entry.collectionId !== "number" || typeof entry.collectionName !== "string") return [];
        const year = typeof entry.releaseDate === "string" ? entry.releaseDate.slice(0, 4) : "";
        return [{
          id: String(entry.collectionId),
          title: entry.collectionName,
          subtitle: [artistName, year].filter(Boolean).join(" · "),
          imageUrl: typeof entry.artworkUrl100 === "string" ? entry.artworkUrl100.replace(/\d+x\d+bb\./, "600x600bb.") : undefined,
          provider: "itunes" as const,
          payload: { collectionId: entry.collectionId, artistId, artistName },
          spotifyUrl: spotifySearchUrl(`${artistName} ${entry.collectionName}`),
        }];
      });
    }));
    const albums = discographies.flatMap(result => result.status === "fulfilled" ? result.value : []);
    const uniqueAlbums = new Map<string, MusicEntity>();
    for (const album of albums) if (!uniqueAlbums.has(album.id)) uniqueAlbums.set(album.id, album);
    if (uniqueAlbums.size) { const merged=new Map<string,MusicEntity>();for(const album of directAlbums)merged.set(album.id,album);for(const album of uniqueAlbums.values())if(!merged.has(album.id))merged.set(album.id,album);return [...merged.values()]; }

    // Keep direct album-title search as a fallback when the query is not an artist.
    const fallbackParams = new URLSearchParams({ term: query, entity: "album", limit: "50", country: "IT" });
    const fallback = await itunesJson<{ results?: Array<Record<string, unknown>> }>(`${ITUNES}/search?${fallbackParams}`);
    return (fallback.results ?? []).flatMap(entry => {
      if (typeof entry.collectionId !== "number" || typeof entry.collectionName !== "string") return [];
      const artistName = typeof entry.artistName === "string" ? entry.artistName : "Artista sconosciuto";
      const year = typeof entry.releaseDate === "string" ? entry.releaseDate.slice(0, 4) : "";
      return [{
        id: String(entry.collectionId), title: entry.collectionName,
        subtitle: [artistName, year].filter(Boolean).join(" · "),
        imageUrl: typeof entry.artworkUrl100 === "string" ? entry.artworkUrl100.replace(/\d+x\d+bb\./, "600x600bb.") : undefined,
        provider: "itunes" as const,
        payload: { collectionId: entry.collectionId, artistId: entry.artistId, artistName },
        spotifyUrl: spotifySearchUrl(`${artistName} ${entry.collectionName}`),
      }];
    });
  }

  return Promise.all(selectedArtists.map(async artist => {
    const artistId = artist.artistId as number;
    const artistName = String(artist.artistName);
    const imageUrl = await resolveArtistImage(artistName);
    return {
      id: String(artistId), title: artistName,
      subtitle: typeof artist.primaryGenreName === "string" ? artist.primaryGenreName : "Artista",
      imageUrl, provider: "itunes" as const,
      payload: { artistId, artistImageUrl: imageUrl, artistName },
      spotifyUrl: spotifySearchUrl(artistName),
    };
  }));
}

async function searchMusicBrainz(query: string, contentType: string): Promise<MusicEntity[]> {
  const isAlbum = contentType === "Album";
  const params = new URLSearchParams({ query, fmt: "json", limit: "50" });
  const data = await musicBrainzJson<Record<string, unknown>>(`${MUSICBRAINZ}/artist?${params}`);
  const artists = ((data.artists ?? []) as Array<Record<string, unknown>>).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
  const normalizedQuery = normalizeMusicText(query);
  const exactArtists = artists.filter(artist => typeof artist.name === "string" && normalizeMusicText(artist.name) === normalizedQuery);
  const selectedArtists = (exactArtists.length ? exactArtists : artists).slice(0, isAlbum ? 5 : 25);

  if (isAlbum) {
    const discographies = await Promise.allSettled(selectedArtists.flatMap(artist => {
      const artistId = artist.id, artistName = artist.name;
      if (typeof artistId !== "string" || typeof artistName !== "string") return [];
      return [loadMusicBrainzItems({ artistId, artistName }, "Discografie").then(items => items.map(item => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        imageUrl: item.imageUrl,
        provider: "musicbrainz" as const,
        payload: { releaseId: item.id, imageUrl: item.imageUrl, albumTitle: item.title, artistName },
        spotifyUrl: spotifySearchUrl(`${artistName} ${item.title}`),
      })))];
    }));
    const albums = discographies.flatMap(result => result.status === "fulfilled" ? result.value : []);
    const uniqueAlbums = new Map<string, MusicEntity>();
    for (const album of albums) if (!uniqueAlbums.has(album.id)) uniqueAlbums.set(album.id, album);
    if (uniqueAlbums.size) return [...uniqueAlbums.values()];

    // If no artist matches, retain direct release-group title search.
    const releaseParams = new URLSearchParams({ query, fmt: "json", limit: "50" });
    const releaseData = await musicBrainzJson<Record<string, unknown>>(`${MUSICBRAINZ}/release-group?${releaseParams}`);
    const groups = ((releaseData["release-groups"] ?? []) as Array<Record<string, unknown>>)
      .filter(group => group["primary-type"] === "Album")
      .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
    return groups.flatMap<MusicEntity>(group => {
      if (typeof group.id !== "string" || typeof group.title !== "string") return [];
      const credits = group["artist-credit"] as Array<{ name?: string; artist?: { name?: string } }> | undefined;
      const artistName = artistCredit(credits);
      const date = typeof group["first-release-date"] === "string" ? group["first-release-date"] : "";
      return [{
        id: group.id, title: group.title, subtitle: [artistName, date].filter(Boolean).join(" · "),
        imageUrl: "https://coverartarchive.org/release-group/" + group.id + "/front-250",
        provider: "musicbrainz" as const,
        payload: { releaseGroupId: group.id, imageUrl: "https://coverartarchive.org/release-group/" + group.id + "/front-250", albumTitle: group.title, artistName },
        spotifyUrl: spotifySearchUrl(`${artistName} ${group.title}`),
      }];
    });
  }

  return Promise.all(selectedArtists.flatMap(artist => {
    const artistId = artist.id, artistName = artist.name;
    if (typeof artistId !== "string" || typeof artistName !== "string") return [];
    const disambiguation = typeof artist.disambiguation === "string" ? artist.disambiguation : "";
    const country = typeof artist.country === "string" ? artist.country : "";
    return [resolveArtistImage(artistName).then(imageUrl => ({
      id: artistId, title: artistName,
      subtitle: [disambiguation, country].filter(Boolean).join(" · ") || "Artista",
      imageUrl, provider: "musicbrainz" as const,
      payload: { artistId, artistImageUrl: imageUrl, artistName },
      spotifyUrl: spotifySearchUrl(artistName),
    }))];
  }));
}

async function loadItunesDiscographyTracks(payload:Record<string,unknown>):Promise<MusicItem[]>{const id=payload.artistId;if(typeof id!=="number"||!Number.isSafeInteger(id))throw new Error("Invalid iTunes artist identifier");const params=new URLSearchParams({id:String(id),entity:"song",limit:"200",country:"IT"});const data=await itunesJson<{results?:Array<Record<string,unknown>>}>(`${ITUNES}/lookup?${params}`);const artist=typeof payload.artistName==="string"?payload.artistName:"";return(data.results??[]).flatMap(entry=>{if(entry.wrapperType!=="track"||typeof entry.trackName!=="string")return[];return[{id:String(entry.trackId??entry.trackName),title:entry.trackName,subtitle:typeof entry.collectionName==="string"?entry.collectionName:artist,imageUrl:typeof entry.artworkUrl100==="string"?entry.artworkUrl100.replace("100x100","300x300"):undefined,previewUrl:typeof entry.previewUrl==="string"?entry.previewUrl:undefined,appleMusicUrl:typeof entry.trackViewUrl==="string"?entry.trackViewUrl:undefined,spotifyUrl:spotifySearchUrl(`${artist} ${entry.trackName}`)}];});}

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
    return [{ id: String(entry.collectionId ?? entry.collectionName), title: entry.collectionName, subtitle: year || undefined, imageUrl: typeof entry.artworkUrl100 === "string" ? entry.artworkUrl100.replace("100x100", "300x300") : undefined, spotifyUrl: spotifySearchUrl(`${artist} ${entry.collectionName}`) }];
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

async function loadMusicBrainzDiscographyTracks(payload:Record<string,unknown>):Promise<MusicItem[]>{
 const id=payload.artistId;
 if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))throw new Error("Invalid MusicBrainz artist identifier");
 const artist=typeof payload.artistName==="string"?payload.artistName:"";
 if(artist){
  try{
   const params=new URLSearchParams({term:artist,entity:"musicArtist",limit:"5",country:"IT"});
   const search=await itunesJson<{results?:Array<Record<string,unknown>>}>(`${ITUNES}/search?${params}`);
   const match=(search.results??[]).find(entry=>entry.wrapperType==="artist"&&typeof entry.artistId==="number"&&normalizeMusicText(String(entry.artistName??""))===normalizeMusicText(artist));
   if(match&&typeof match.artistId==="number"){
    const tracks=await loadItunesDiscographyTracks({artistId:match.artistId,artistName:artist});
    if(tracks.length)return tracks;
   }
  }catch{}
 }
 try{
  const releaseData=await browseMusicBrainzReleases(id,"recordings+release-groups");
  const releases=releaseData.filter(release=>{const type=release["release-group"]?.["primary-type"];return !type||type==="Album"||type==="EP";});
  const tracks=releases.flatMap(release=>(release.media??[]).flatMap(medium=>(medium.tracks??[]).flatMap(track=>{
   const title=track.recording?.title??track.title;
   if(!title||!release.id)return[];
   const idPart=track.recording?.id??track.id??String(track.position??title);
   return[{id:release.id+":"+idPart,title,subtitle:release.title||artist||undefined,imageUrl:"https://coverartarchive.org/release/"+release.id+"/front-250",spotifyUrl:spotifySearchUrl(`${artist} ${title}`)}];
  })));
  if(tracks.length)return tracks;
 }catch{}
 const params=new URLSearchParams({query:"arid:"+id,fmt:"json",limit:"100"});
 const data=await musicBrainzJson<{recordings?:Array<{id?:string;title?:string}>}>(`${MUSICBRAINZ}/recording?${params}`);
 return(data.recordings??[]).flatMap(recording=>recording.id&&recording.title?[{id:recording.id,title:recording.title,subtitle:artist||undefined,spotifyUrl:spotifySearchUrl(`${artist} ${recording.title}`)}]:[]);
}

async function loadMusicBrainzItems(payload:Record<string,unknown>,contentType:string):Promise<MusicItem[]>{
 if(contentType==="Album"){
  const releaseId=payload.releaseId;
  let tracks:MusicBrainzTrack[]=[];
  if(typeof releaseId==="string"&&/^[0-9a-f-]{36}$/i.test(releaseId)){
   const release=await musicBrainzJson<{media?:Array<{tracks?:MusicBrainzTrack[]}>}>(`${MUSICBRAINZ}/release/${releaseId}?inc=recordings&fmt=json`);
   tracks=release.media?.flatMap(medium=>medium.tracks??[])??[];
  }else{
   const id=payload.releaseGroupId;
   if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))throw new Error("Invalid MusicBrainz release-group identifier");
   const params=new URLSearchParams({"release-group":id,inc:"recordings",fmt:"json",limit:"1"});
   const data=await musicBrainzJson<{releases?:Array<{media?:Array<{tracks?:MusicBrainzTrack[]}>}>}>(`${MUSICBRAINZ}/release?${params}`);
   tracks=data.releases?.[0]?.media?.flatMap(medium=>medium.tracks??[])??[];
  }
  const albumTitle=typeof payload.albumTitle==="string"?payload.albumTitle:"";
  const artistName=typeof payload.artistName==="string"?payload.artistName:"";
  const previewMetadata=albumTitle?await loadItunesAlbumTrackMetadata(albumTitle,artistName):new Map<string,{previewUrl?:string;appleMusicUrl?:string}>();
  return tracks.flatMap(track=>{
   const title=track.recording?.title??track.title;
   if(!title)return[];
   const metadata=previewMetadata.get(normalizeMusicText(title));
   return[{id:track.recording?.id??track.id??`${track.position}-${title}`,title,subtitle:track.position?`Traccia ${track.position}`:undefined,imageUrl:typeof payload.imageUrl==="string"?payload.imageUrl:undefined,previewUrl:metadata?.previewUrl,appleMusicUrl:metadata?.appleMusicUrl,spotifyUrl:spotifySearchUrl(`${artistName} ${title}`)}];
  });
 }
 const id=payload.artistId;
 if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))throw new Error("Invalid MusicBrainz artist identifier");
 const data=await browseMusicBrainzReleases(id,"release-groups");
 const artistName=typeof payload.artistName==="string"?payload.artistName:"";
 return data.filter(release=>Boolean(release.id&&release.title)&&(()=>{const type=release["release-group"]?.["primary-type"];return !type||type==="Album"||type==="EP";})()).map(release=>({
  id:release.id as string,title:release.title as string,subtitle:[release["release-group"]?.["primary-type"],release.date?.slice(0,4),release.country].filter(Boolean).join(" · ")||undefined,
  imageUrl:"https://coverartarchive.org/release/"+release.id+"/front-250",spotifyUrl:spotifySearchUrl(`${artistName} ${release.title}`)
 }));
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { user, status } = await getAccountAccess(supabase);
  if (!user) return Response.json({ error: "Sessione scaduta." }, { status: 401 });
  if (status !== "APPROVED") return Response.json({ error: "Account non ancora abilitato." }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const action = params.get("action");
  const provider = params.get("provider");
  const contentType = params.get("contentType");
  if (!["itunes", "musicbrainz"].includes(provider ?? "") || !["Album", "Artisti", "Discografie", "Discografia brani"].includes(contentType ?? "")) {
    return Response.json({ error: "Unsupported music catalog request." }, { status: 400 });
  }

  try {
    if (action === "search") {
      const query = params.get("query")?.trim() ?? "";
      if (query.length < 2 || query.length > 100) return Response.json({ error: "La ricerca deve contenere da 2 a 100 caratteri." }, { status: 400 });
      const entities = provider === "itunes" ? await searchItunes(query, contentType!) : await searchMusicBrainz(query, contentType!);
      return Response.json({ entities });
    }

    if (action === "items") {
      const rawPayload = params.get("payload");
      if (!rawPayload || rawPayload.length > 2000) return Response.json({ error: "Catalog item payload is missing or invalid." }, { status: 400 });
      const payload = JSON.parse(rawPayload) as Record<string, unknown>;
      const items = contentType==="Discografia brani"?(provider==="itunes"?await loadItunesDiscographyTracks(payload):await loadMusicBrainzDiscographyTracks(payload)):(provider === "itunes" ? await loadItunesItems(payload, contentType!) : await loadMusicBrainzItems(payload, contentType!));
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
