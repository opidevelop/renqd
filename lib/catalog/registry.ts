import type { CatalogCategory, CatalogEntity, CatalogItem, CatalogProvider } from "./types";

async function requestMusicCatalog<T>(provider: string, action: "search" | "items", contentType: string, values: Record<string, string>): Promise<T> {
  const params = new URLSearchParams({ provider, action, contentType, ...values });
  const response = await fetch(`/api/catalog/music?${params.toString()}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Catalog request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function musicProvider(id: "itunes" | "musicbrainz"): CatalogProvider {
  return {
    id,
    supports: (category, contentType) => category === "music" && ["Album", "Artisti", "Discografie"].includes(contentType),
    async search(query, _category, contentType) {
      const result = await requestMusicCatalog<{ entities: CatalogEntity[] }>(id, "search", contentType, { query });
      return result.entities;
    },
    async getItems(entity, _category, contentType) {
      const result = await requestMusicCatalog<{ items: Omit<CatalogItem, "selected" | "source">[] }>(
        id,
        "items",
        contentType,
        { payload: JSON.stringify(entity.payload ?? {}) },
      );
      return result.items;
    },
  };
}

const providers: CatalogProvider[] = [musicProvider("itunes"), musicProvider("musicbrainz")];

export async function searchCatalog(query: string, category: CatalogCategory, contentType: string) {
  const matching = providers.filter((provider) => provider.supports(category, contentType));
  if (!matching.length) return { status: "unavailable" as const, entities: [] as CatalogEntity[] };

  const results = await Promise.allSettled(matching.map((provider) => provider.search(query, category, contentType)));
  const entities = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const allFailed = results.every((result) => result.status === "rejected");
  const unique = new Map<string, CatalogEntity>();
  for (const entity of entities) {
    const key = `${entity.provider}:${entity.id}`;
    if (!unique.has(key)) unique.set(key, entity);
  }
  return {
    status: unique.size ? "ready" as const : allFailed ? "error" as const : "ready" as const,
    entities: [...unique.values()],
  };
}

export async function loadCatalogItems(entity: CatalogEntity, category: CatalogCategory, contentType: string) {
  const provider = providers.find((candidate) => candidate.id === entity.provider && candidate.supports(category, contentType));
  if (!provider) return { status: "unavailable" as const, items: [] as Omit<CatalogItem, "selected" | "source">[] };
  try {
    return { status: "ready" as const, items: await provider.getItems(entity, category, contentType) };
  } catch {
    return { status: "error" as const, items: [] as Omit<CatalogItem, "selected" | "source">[] };
  }
}
