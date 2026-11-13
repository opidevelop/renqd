import type { NextRequest } from "next/server";
import type { CatalogEntity, CatalogItem } from "@/lib/catalog/types";

type SearchDoc = {
  key: string;
  title: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  cover_i?: number;
  edition_count?: number;
};
type AuthorDoc = { key: string; name: string; top_work?: string; work_count?: number; birth_date?: string; death_date?: string };
type WorkDoc = { key: string; title: string; authors?: Array<{ author?: { key?: string } }>; covers?: number[]; first_publish_date?: string };
type SearchResponse<T> = { docs?: T[]; numFound?: number; num_found?: number; start?: number };

const API = "https://openlibrary.org";
const COVER = "https://covers.openlibrary.org";
function clean(value: string) { return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 100); }
function workId(key: string) { return key.split("/").filter(Boolean).at(-1) ?? key; }
function coverUrl(id?: number) { return id && id > 0 ? `${COVER}/b/id/${id}-M.jpg` : undefined; }
function bookEntity(doc: SearchDoc): CatalogEntity {
  return {
    id: workId(doc.key), title: doc.title,
    subtitle: [doc.author_name?.slice(0, 2).join(", "), doc.first_publish_year].filter(Boolean).join(" · ") || "Libro",
    imageUrl: coverUrl(doc.cover_i), provider: "openlibrary",
    payload: { workKey: doc.key },
  };
}
function bookItem(doc: SearchDoc): Omit<CatalogItem, "selected" | "source"> {
  return { id: workId(doc.key), title: doc.title, subtitle: [doc.author_name?.slice(0, 2).join(", "), doc.first_publish_year].filter(Boolean).join(" · ") || "Libro", imageUrl: coverUrl(doc.cover_i), payload: { workKey: doc.key } };
}
async function openLibrary<T>(path: string): Promise<T> {
  const response = await fetch(API + path, {
    headers: { "User-Agent": "Renqd/1.0 (https://renqd.app)" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`Open Library returned ${response.status}`);
  return response.json() as Promise<T>;
}
async function searchBooks(query: string, offset: number) {
  const params = new URLSearchParams({ q: query, limit: "30", offset: String(offset), fields: "key,title,author_name,author_key,first_publish_year,cover_i,edition_count", lang: "it" });
  const data = await openLibrary<SearchResponse<SearchDoc>>(`/search.json?${params}`);
  const docs = data.docs ?? [];
  const total = data.numFound ?? data.num_found ?? 0;
  return { entities: docs.map(bookEntity), hasMore: offset + docs.length < total, nextOffset: offset + docs.length };
}
async function searchAuthors(query: string, offset: number) {
  const params = new URLSearchParams({ q: query, limit: "30", offset: String(offset) });
  const data = await openLibrary<SearchResponse<AuthorDoc>>(`/search/authors.json?${params}`);
  const docs = data.docs ?? [];
  const total = data.numFound ?? data.num_found ?? 0;
  return {
    entities: docs.map((author) => ({
      id: workId(author.key), title: author.name,
      subtitle: [author.top_work ? `Opera più nota: ${author.top_work}` : "", author.work_count ? `${author.work_count} opere` : "", author.birth_date].filter(Boolean).join(" · ") || "Autore",
      imageUrl: `${COVER}/a/olid/${workId(author.key)}-M.jpg`, provider: "openlibrary",
      payload: { authorKey: author.key },
    })),
    hasMore: offset + docs.length < total, nextOffset: offset + docs.length,
  };
}
async function loadAuthorWorks(authorKey: string) {
  const id = workId(authorKey);
  if (!/^OL\d+A$/.test(id)) throw new Error("Invalid Open Library author identifier");
  const data = await openLibrary<{ entries?: WorkDoc[] }>(`/authors/${id}/works.json?limit=50`);
  return (data.entries ?? []).map((work) => ({
    id: workId(work.key), title: work.title,
    subtitle: work.first_publish_date ?? "Opera dell'autore",
    imageUrl: coverUrl(work.covers?.[0]),
    payload: { workKey: work.key },
  }));
}
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const action = params.get("action");
  const contentType = params.get("contentType") ?? "";
  if (params.get("provider") !== "openlibrary" || !["Libri", "Autori"].includes(contentType)) {
    return Response.json({ error: "Unsupported book catalog request." }, { status: 400 });
  }
  try {
    if (action === "search") {
      const query = clean(params.get("query") ?? "");
      if (query.length < 2) return Response.json({ error: "La ricerca deve contenere almeno 2 caratteri." }, { status: 400 });
      const offset = Math.max(0, Math.min(10000, Number(params.get("offset") ?? 0) || 0));
      const result = contentType === "Autori" ? await searchAuthors(query, offset) : await searchBooks(query, offset);
      return Response.json(result, { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } });
    }
    if (action === "items" && contentType === "Autori") {
      const raw = params.get("payload");
      if (!raw || raw.length > 2000) return Response.json({ error: "Catalog item payload is missing or invalid." }, { status: 400 });
      const payload = JSON.parse(raw) as { authorKey?: string };
      if (!payload.authorKey) return Response.json({ error: "Author identifier is missing." }, { status: 400 });
      const items = await loadAuthorWorks(payload.authorKey);
      return Response.json({ items }, { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } });
    }
    return Response.json({ error: "Unsupported catalog action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Open Library provider error";
    const upstreamStatus = Number(message.match(/returned (\d{3})/)?.[1] ?? 0);
    return Response.json({ error: message }, { status: upstreamStatus === 429 ? 503 : 502 });
  }
}
