import type { CatalogCategory, CatalogEntity, CatalogItem, CatalogProvider } from "./types";

async function requestCatalog<T>(path: string, provider: string, action: "search" | "items" | "seasons, contentType: string, values: Record<string, string>): Promise<T> {
  const params = new URLSearchParams({ provider, action, contentType, ...values });
  const response = await fetch(path + "?" + params.toString());
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Catalog request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function musicProvider(id: "itunes" | "musicbrainz"): CatalogProvider {
  return {
    id,
    supports: (category, contentType) => category === "music" && ["Album", "Artisti", "Discografie", "Discografia brani"].includes(contentType),
    async search(query, _category, contentType) {
      const result = await requestCatalog<{ entities: CatalogEntity[] }>("/api/catalog/music", id, "search", contentType, { query });
      return { entities: result.entities };
    },
    async getItems(entity, _category, contentType) {
      const result = await requestCatalog<{ items: Omit<CatalogItem, "selected" | "source">[] }>(
        "/api/catalog/music", id, "items", contentType, { payload: JSON.stringify(entity.payload ?? {}) },
      );
      return result.items;
    },
  };
}

const gamesProvider: CatalogProvider = {
  id: "igdb",
  supports: (category, contentType) => category === "games" && ["Giochi", "Saghe", "Franchise", "Personaggi"].includes(contentType),
  async search(query, _category, contentType, offset = 0) {
    return requestCatalog<{ entities: CatalogEntity[]; hasMore?: boolean; nextOffset?: number }>("/api/catalog/games", "igdb", "search", contentType, { query, offset: String(offset) });
  },
  async getItems(entity, _category, contentType) {
    const result = await requestCatalog<{ items: Omit<CatalogItem, "selected" | "source">[] }>(
      "/api/catalog/games", "igdb", "items", contentType, { payload: JSON.stringify(entity.payload ?? {}) },
    );
    return result.items;
  },
};

const filmProvider: CatalogProvider = {
  id: "tmdb",
  supports: (category, contentType) => category === "film" && ["Film", "Serie TV", "Reality TV", "Reality TV - season", "Reality TV - all", "Saghe cinematografiche", "Registi", "Attori", "Creatori"].includes(contentType),
  async search(query, _category, contentType, offset = 1) {
    return requestCatalog<{ entities: CatalogEntity[]; hasMore?: boolean; nextOffset?: number }>("/api/catalog/film", "tmdb", "search", contentType, { query, offset: String(offset) });
  },
  async getItems(entity, _category, contentType) {
    const result = await requestCatalog<{ items: Omit<CatalogItem, "selected" | "source">[] }>("/api/catalog/film", "tmdb", "items", contentType, { payload: JSON.stringify(entity.payload ?? {}) });
    return result.items;
  },
};
const booksProvider: CatalogProvider = {
  id: "openlibrary",
  supports: (category, contentType) => category === "books" && ["Libri", "Autori"].includes(contentType),
  async search(query, _category, contentType, offset = 0) {
    return requestCatalog<{ entities: CatalogEntity[]; hasMore?: boolean; nextOffset?: number }>("/api/catalog/books", "openlibrary", "search", contentType, { query, offset: String(offset) });
  },
  async getItems(entity, _category, contentType) {
    const result = await requestCatalog<{ items: Omit<CatalogItem, "selected" | "source">[] }>("/api/catalog/books", "openlibrary", "items", contentType, { payload: JSON.stringify(entity.payload ?? {}) });
    return result.items;
  },
};
const providers: CatalogProvider[] = [musicProvider("itunes"), musicProvider("musicbrainz"), gamesProvider, filmProvider, booksProvider];

function normalizeMusicSearchValue(value: string) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function searchCatalog(query: string, category: CatalogCategory, contentType: string, offset = 0, discipline = "") {
  if (category === "sport") { const params = new URLSearchParams({ provider: "sports", action: "search", contentType, query, offset: String(offset), discipline }); try { const response = await fetch("/api/catalog/sport?" + params.toString()); if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error ?? "Sport catalog request failed"); } return await response.json() as { status: "ready" | "error" | "unavailable"; entities: CatalogEntity[]; hasMore?: boolean; nextOffset?: number }; } catch { return { status: "error" as const, entities: [] as CatalogEntity[] }; } }
  const matching = providers.filter((provider) => provider.supports(category, contentType));
  if (!matching.length) return { status: "unavailable" as const, entities: [] as CatalogEntity[] };
  const results = await Promise.allSettled(matching.map((provider) => provider.search(query, category, contentType, offset)));
  const entities = results.flatMap((result) => result.status === "fulfilled" ? result.value.entities : []);
  const hasMore = results.some((result) => result.status === "fulfilled" && Boolean(result.value.hasMore));
  const nextOffset = Math.max(offset, ...results.flatMap((result) => result.status === "fulfilled" ? [result.value.nextOffset ?? 0] : []));
  const allFailed = results.every((result) => result.status === "rejected");
  const unique = new Map<string, CatalogEntity>();
  for (const entity of entities) {
    const key = `${entity.provider}:${entity.id}`;
    if (!unique.has(key)) unique.set(key, entity);
  }
  return {
    status: unique.size ? "ready" as const : allFailed ? "error" as const : "ready" as const,
    entities: (() => {
      const merged = [...unique.values()];
      if (category !== "music" || contentType !== "Album") return merged;
      const normalizedQuery = normalizeMusicSearchValue(query);
      const priority = (entity: CatalogEntity) => {
        if (normalizeMusicSearchValue(entity.title) === normalizedQuery) return 0;
        const artistName = (entity.subtitle ?? "").split(" · ")[0].trim();
        if (artistName && normalizeMusicSearchValue(artistName) === normalizedQuery) return 1;
        return 2;
      };
      return merged.map((entity, index) => ({ entity, index, priority: priority(entity) }))
        .sort((a, b) => a.priority - b.priority || a.index - b.index)
        .map(({ entity }) => entity);
    })(),
    hasMore,
    nextOffset,
  };
}

export async function loadRealitySeasons(entity:CatalogEntity){
 const result=await requestCatalog<{entities:CatalogEntity[]}>("/api/catalog/film","tmdb","seasons","Reality TV",{payload:JSON.stringify(entity.payload??{})});
 return result.entities;
}

export async function loadCatalogItems(entity: CatalogEntity, category: CatalogCategory, contentType: string, discographyMode: "albums" | "tracks" = "albums") {
  const effectiveType = contentType === "Discografie" && discographyMode === "tracks" ? "Discografia brani" : contentType;
  const provider = providers.find((candidate) => candidate.id === entity.provider && candidate.supports(category, effectiveType));
  if (!provider) return { status: "unavailable" as const, items: [] as Omit<CatalogItem, "selected" | "source">[] };
  try {
    return { status: "ready" as const, items: await provider.getItems(entity, category, effectiveType) };
  } catch {
    return { status: "error" as const, items: [] as Omit<CatalogItem, "selected" | "source">[] };
  }
}
