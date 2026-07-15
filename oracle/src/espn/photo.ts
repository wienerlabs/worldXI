/**
 * Player photo resolver: finds a real photo URL for each player.
 *  1) ESPN headshot (high-quality sports photo) - if available (HEAD 200)
 *  2) Wikidata P18 (image) -> Wikimedia Commons - broad coverage (~85%)
 * If none exist, returns "" (frontend falls back to the jersey image). No fabrication.
 *
 * Note: Wikimedia APIs require a descriptive User-Agent; they reject requests without one.
 */
import { logger } from "../logger.js";

const UA = { "User-Agent": "WorldXI/1.0 (worldxi.fantasy WC2026 fantasy; makinci473@gmail.com)" };
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Rate-limit-resilient fetch (429/503): retries a few times with exponential backoff. */
async function fetchRetry(url: string, opts: RequestInit, retries = 4): Promise<Response | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, opts);
      if (r.status === 429 || r.status === 503) {
        await sleep(800 * (i + 1));
        continue;
      }
      return r;
    } catch {
      if (i === retries) return null;
      await sleep(500 * (i + 1));
    }
  }
  return null;
}

interface WdSearch {
  search?: Array<{ id: string; description?: string }>;
}
interface WdEntity {
  entities?: Record<string, { claims?: { P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> } }>;
}

/** Searches Wikidata by name and returns the P18 (image) -> Commons photo URL. */
async function wikidataPhoto(name: string): Promise<string | null> {
  try {
    const s = await fetchRetry(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&type=item&limit=5`,
      { headers: UA }
    );
    if (!s || !s.ok) return null;
    const sj = (await s.json()) as WdSearch;
    const hits = sj.search ?? [];
    // Prioritize candidates whose description mentions football/soccer (higher chance of the right person).
    const ordered = [...hits.filter((h) => /foot|soccer/i.test(h.description ?? "")), ...hits];
    const seen = new Set<string>();
    for (const hit of ordered.slice(0, 3)) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      const e = await fetchRetry(`https://www.wikidata.org/wiki/Special:EntityData/${hit.id}.json`, { headers: UA });
      if (!e || !e.ok) continue;
      const ej = (await e.json()) as WdEntity;
      const file = ej.entities?.[hit.id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (file) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=400`;
    }
    return null;
  } catch {
    return null;
  }
}

interface WpSummary {
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
}

/** Returns a photo from the Wikipedia REST summary (name = title) (Wikidata fallback). */
async function wikipediaPhoto(name: string): Promise<string | null> {
  const r = await fetchRetry(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}?redirect=true`,
    { headers: { ...UA, accept: "application/json" } }
  );
  if (!r || !r.ok) return null;
  try {
    const j = (await r.json()) as WpSummary;
    return j.originalimage?.source ?? j.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

/** Resolves the best photo URL for a player (ESPN -> Wikidata -> Wikipedia -> ""). */
export async function resolvePhoto(name: string, espnUrl: string): Promise<string> {
  try {
    const r = await fetch(espnUrl, { method: "HEAD" });
    if (r.ok) return espnUrl;
  } catch {
    /* No ESPN -> try Wikidata */
  }
  const wd = await wikidataPhoto(name);
  if (wd) return wd;
  return (await wikipediaPhoto(name)) ?? "";
}

/**
 * Resolves all players' photos (updates in place). Uses small batches with waits in
 * between to avoid hitting the Wikimedia rate limit (together with retry backoff).
 */
export async function resolveAllPhotos<T extends { name: string; photo: string }>(
  players: T[],
  batchSize = 3
): Promise<void> {
  let done = 0;
  let withPhoto = 0;
  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (p) => {
        p.photo = await resolvePhoto(p.name, p.photo);
        if (p.photo) withPhoto += 1;
      })
    );
    done += batch.length;
    if (done % 120 === 0 || done >= players.length) {
      logger.info("photo resolution", { done, total: players.length, withPhoto });
    }
    await sleep(300);
  }
}
