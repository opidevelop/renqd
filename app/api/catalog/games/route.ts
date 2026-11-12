import type { NextRequest } from "next/server";
import type { CatalogItem } from "@/lib/catalog/types";

type IgdbImage = { image_id?: string };
type IgdbPlatform = { name?: string };
type IgdbGame = {
  id: number;
  name: string;
  cover?: IgdbImage;
  first_release_date?: number;
  platforms?: IgdbPlatform[];
  genres?: Array<{ name?: string }>;
  games?: Array<{ id?: number; name?: string; cover?: IgdbImage; first_release_date?: number; platforms?: IgdbPlatform[] }>;
  mug_shot?: IgdbImage;
  slug?: string;
  franchises?: Array<{ id?: number }>;
  collections?: Array<{ id?: number }>;
};
type IgdbEntity = { id: number; name: string; games?: IgdbGame[]; mug_shot?: IgdbImage };

const IGDB = "https://api.igdb.com/v4";
let cachedAccessToken: string | undefined;
let tokenExpiresAt = 0;

function imageUrl(imageId: string | undefined, size: "cover_big" | "thumb" = "cover_big") {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg` : undefined;
}
function safeSearch(value: string) {
  return value.replace(/["\\\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
}
function releaseYear(timestamp?: number) {
  return timestamp ? String(new Date(timestamp * 1000).getUTCFullYear()) : "";
}
function gameSubtitle(game: IgdbGame) {
  const platforms = (game.platforms ?? []).map((platform) => platform.name).filter(Boolean).slice(0, 3);
  return [releaseYear(game.first_release_date), platforms.join(", ")].filter(Boolean).join(" · ") || "Videogioco";
}
function gameItem(game: IgdbGame): Omit<CatalogItem, "selected" | "source"> {
  return { id: String(game.id), title: game.name, subtitle: gameSubtitle(game), imageUrl: imageUrl(game.cover?.image_id), payload: { igdbId: game.id, slug: game.slug } };
}
async function getAccessToken() {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("IGDB_NOT_CONFIGURED");
  if (cachedAccessToken && tokenExpiresAt > Date.now() + 60_000) return { token: cachedAccessToken, clientId };
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" });
  const response = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  if (!response.ok) throw new Error(`Twitch authentication returned ${response.status}`);
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token || !data.expires_in) throw new Error("Invalid Twitch access token response");
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return { token: cachedAccessToken, clientId };
}
async function igdbRequest<T>(endpoint: string, query: string): Promise<T> {
  const { token, clientId } = await getAccessToken();
  const response = await fetch(`${IGDB}/${endpoint}`, {
    method: "POST",
    headers: { "Client-ID": clientId, Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "text/plain" },
    body: query,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`IGDB returned ${response.status}`);
  return response.json() as Promise<T>;
}
async function searchGames(query: string) {
  return igdbRequest<IgdbGame[]>("games", `search "${safeSearch(query)}"; fields id,name,cover.image_id,first_release_date,platforms.name,genres.name,slug,franchises.id,collections.id; where version_parent = null; limit 50;`);
}
function searchAliases(query: string) {
  const normalized = query.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
  if (normalized === "pokemon") return [query, "Pokémon"];
  return [query];
}
async function searchCollections(query: string) {
  const results = await Promise.all(searchAliases(query).map((term) => igdbRequest<IgdbEntity[]>("collections", `search "${safeSearch(term)}"; fields id,name,games.name,games.cover.image_id; limit 20;`)));
  return [...new Map(results.flat().map((entity) => [entity.id, entity])).values()].filter((entity) => (entity.games?.length ?? 0) > 0);
}
async function searchFranchises(query: string) {
  const results = await Promise.all(searchAliases(query).map((term) => igdbRequest<IgdbEntity[]>("franchises", `where name ~ *"${safeSearch(term)}"*; fields id,name,games.name,games.cover.image_id; limit 30;`)));
  return [...new Map(results.flat().map((entity) => [entity.id, entity])).values()].filter((entity) => (entity.games?.length ?? 0) > 0);
}
async function searchCharacters(query: string) {
  const direct = await igdbRequest<IgdbEntity[]>("characters", `search "${safeSearch(query)}"; fields id,name,mug_shot.image_id,games.name; limit 50;`);
  const isPokemonSearch = searchAliases(query).some((term) => term === "Pokémon");
  if (!isPokemonSearch) return direct;
  const franchises = await searchFranchises("Pokémon");
  const franchiseIds = franchises.map((entity) => entity.id).filter(Number.isSafeInteger);
  if (!franchiseIds.length) return direct;
  const games = await igdbRequest<IgdbGame[]>("games", `fields id; where franchises = (${franchiseIds.join(",")}); limit 500;`);
  const gameIds = games.map((game) => game.id).filter(Number.isSafeInteger);
  if (!gameIds.length) return direct;
  const related = await igdbRequest<IgdbEntity[]>("characters", `fields id,name,mug_shot.image_id,games.name; where games = (${gameIds.join(",")}); limit 100;`);
  return [...new Map([...direct, ...related].map((entity) => [entity.id, entity])).values()];
}
function entityFromGame(game: IgdbGame) {
  return { id: String(game.id), title: game.name, subtitle: gameSubtitle(game), imageUrl: imageUrl(game.cover?.image_id), provider: "igdb", payload: { igdbId: game.id, slug: game.slug } };
}
function entityFromCollection(entity: IgdbEntity) {
  const firstGame = entity.games?.find((game) => game.cover?.image_id);
  return { id: String(entity.id), title: entity.name, subtitle: `Saga videoludica · ${entity.games?.length ?? 0} titoli`, imageUrl: imageUrl(firstGame?.cover?.image_id), provider: "igdb", payload: { igdbId: entity.id } };
}
function entityFromFranchise(entity: IgdbEntity) {
  const firstGame = entity.games?.find((game) => game.cover?.image_id);
  return { id: String(entity.id), title: entity.name, subtitle: `Franchise · ${entity.games?.length ?? 0} titoli`, imageUrl: imageUrl(firstGame?.cover?.image_id), provider: "igdb", payload: { igdbId: entity.id } };
}
function entityFromCharacter(entity: IgdbEntity) {
  const games = (entity.games ?? []).map((game) => game.name).filter(Boolean);
  return { id: String(entity.id), title: entity.name, subtitle: games.slice(0, 2).join(", ") || "Personaggio videoludico", imageUrl: imageUrl(entity.mug_shot?.image_id, "thumb"), provider: "igdb", payload: { igdbId: entity.id } };
}
async function searchEntities(query: string, contentType: string) {
  if (contentType === "Giochi") return (await searchGames(query)).map(entityFromGame);
  if (contentType === "Saghe") return (await searchCollections(query)).map(entityFromCollection);
  if (contentType === "Franchise") return (await searchFranchises(query)).map(entityFromFranchise);
  if (contentType === "Personaggi") return (await searchCharacters(query)).map(entityFromCharacter);
  throw new Error("Unsupported videogame content type");
}
async function loadRelatedGames(payload: Record<string, unknown>, contentType: string) {
  const id = Number(payload.igdbId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid IGDB entity identifier");
  const relation = contentType === "Saghe" ? "collections" : contentType === "Franchise" ? "franchises" : null;
  if (!relation) throw new Error("Unsupported videogame catalog action");
  const relationField = relation === "franchises" ? "franchises" : "collections";
  const games = await igdbRequest<IgdbGame[]>("games", `fields id,name,cover.image_id,first_release_date,platforms.name,genres.name,slug,${relationField}.id; where ${relationField} = ${id}; sort first_release_date asc; limit 500;`);
  const related = games.filter((game) => (game[relationField] ?? []).some((entry) => entry.id === id));
  return [...new Map(related.map((game) => [game.id, game])).values()].map(gameItem);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const action = params.get("action");
  const contentType = params.get("contentType");
  if (params.get("provider") !== "igdb" || !["Giochi", "Saghe", "Franchise", "Personaggi"].includes(contentType ?? "")) {
    return Response.json({ error: "Unsupported videogame catalog request." }, { status: 400 });
  }
  try {
    if (action === "search") {
      const query = params.get("query")?.trim() ?? "";
      if (query.length < 2 || query.length > 100) return Response.json({ error: "La ricerca deve contenere da 2 a 100 caratteri." }, { status: 400 });
      const entities = await searchEntities(query, contentType!);
      return Response.json({ entities }, { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } });
    }
    if (action === "items") {
      const rawPayload = params.get("payload");
      if (!rawPayload || rawPayload.length > 2000) return Response.json({ error: "Catalog item payload is missing or invalid." }, { status: 400 });
      const payload = JSON.parse(rawPayload) as Record<string, unknown>;
      const items = await loadRelatedGames(payload, contentType!);
      return Response.json({ items }, { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } });
    }
    return Response.json({ error: "Unsupported catalog action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "IGDB provider error";
    if (message === "IGDB_NOT_CONFIGURED") return Response.json({ error: "Catalogo videogiochi non configurato: mancano le credenziali IGDB su Vercel." }, { status: 503 });
    const upstreamStatus = Number(message.match(/returned (\d{3})/)?.[1] ?? 0);
    const status = upstreamStatus === 429 ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
