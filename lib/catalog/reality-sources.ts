type WikiSource = "wikipedia" | "fandom";
export type RealityContestant = {
  id: string;
  title: string;
  subtitle: string;
  sourceUrl: string;
  sourceProvider: WikiSource;
};

type WikiSearchResponse = { query?: { search?: Array<{ title: string }> } };
type WikiParseResponse = { parse?: { title?: string; wikitext?: { "*"?: string }; sections?: Array<{ index: string; line: string }> } };

const WIKIS: Record<WikiSource, string> = {
  wikipedia: "https://it.wikipedia.org/w",
  fandom: "https://bigbrother.fandom.com/api.php",
};

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function decodeWikiTitle(value: string) {
  return value.replace(/_/g, " ").trim();
}

function extractNames(wikitext: string) {
  const lines = wikitext.split("\n");
  const candidates: string[] = [];
  const ignored = /^(file|immagine|category|categoria|template|special|help|wikipedia|portale|s|cite|ref|nowrap|small|flag|sortname):/i;
  const roleNoise = /^(conduttor|presentator|opinionist|inviat|giudic|autore|regist|speaker|voice|voce narrante|host\b)/i;
  for (const line of lines) {
    if (!/^\s*[|!#*;]/.test(line)) continue;
    const links = [...line.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)];
    if (!links.length) continue;
    const raw = decodeWikiTitle(links[0][1]);
    if (!raw || ignored.test(raw) || roleNoise.test(raw) || raw.length > 80) continue;
    if (/^(concorrenti|partecipanti|cast|nome|personaggio|ruolo|posizione|classifica|eliminat|vincitor|finalist|ospit|giuria|giudici)$/i.test(raw)) continue;
    candidates.push(raw);
  }
  const unique = new Map<string, string>();
  for (const name of candidates) {
    const key = normalize(name);
    if (key && key.length > 2 && !unique.has(key)) unique.set(key, name);
  }
  return [...unique.values()];
}

async function wikiRequest<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Renqd/1.0 (reality catalog; attribution: https://renqd.app/attributions)" },
    next: { revalidate: 86400 },
  });
  if (!response.ok) throw new Error("Wiki provider returned " + response.status);
  return response.json() as Promise<T>;
}

async function findPage(source: WikiSource, query: string) {
  const endpoint = WIKIS[source];
  const result = await wikiRequest<WikiSearchResponse>(endpoint, {
    action: "query", list: "search", srsearch: query, srlimit: "5", format: "json",
  });
  return result.query?.search?.[0]?.title ?? null;
}

async function readPage(source: WikiSource, title: string, showTitle: string, seasonNumber?: number) {
  const endpoint = WIKIS[source];
  const parsed = await wikiRequest<WikiParseResponse>(endpoint, {
    action: "parse", page: title, prop: "wikitext|sections", format: "json",
  });
  const fullText = parsed.parse?.wikitext?.["*"] ?? "";
  if (!fullText) return [];
  const sections = parsed.parse?.sections ?? [];
  const section = sections.find((item) => /concorrent|partecipant|housemate|cast|classifica/i.test(item.line));
  let sourceText = fullText;
  if (section) {
    const sectionResult = await wikiRequest<WikiParseResponse>(endpoint, {
      action: "parse", page: title, prop: "wikitext", section: section.index, format: "json",
    });
    sourceText = sectionResult.parse?.wikitext?.["*"] ?? fullText;
  }
  const names = extractNames(sourceText);
  if (!names.length) return [];
  const url = source === "wikipedia"
    ? "https://it.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_"))
    : "https://bigbrother.fandom.com/wiki/" + encodeURIComponent(title.replace(/ /g, "_"));
  return names.map((name, index) => ({
    id: `wiki-${source}-${normalize(name).replace(/\s+/g, "-")}-${index}`,
    title: name,
    subtitle: seasonNumber ? `${showTitle} · Stagione ${seasonNumber}` : showTitle,
    sourceUrl: url,
    sourceProvider: source,
  } satisfies RealityContestant));
}

export async function loadRealityContestants(showTitle: string, seasonNumber?: number) {
  const seasonLabel = seasonNumber ? ` ${seasonNumber}` : "";
  const queries = [
    `"${showTitle}"${seasonLabel} concorrenti`,
    `"${showTitle}"${seasonLabel} partecipanti`,
    `"${showTitle}"${seasonLabel} cast`,
  ];
  for (const source of ["wikipedia", "fandom"] as const) {
    for (const query of queries) {
      try {
        const title = await findPage(source, query);
        if (!title) continue;
        const items = await readPage(source, title, showTitle, seasonNumber);
        if (items.length >= 2) return items;
      } catch {
        // Try the next query/provider; the caller retains TMDB as a final fallback.
      }
    }
  }
  return [];
}
