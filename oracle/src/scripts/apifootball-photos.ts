/**
 * Fetches clean player portraits from API-Football and writes them to players.json.
 * Players are found by name + national team (nationality) match; the photo URL is
 * on the api-sports CDN (permanently accessible without auth - once written, no
 * key is needed).
 *
 * The free plan allows 100 requests per day; it scales with multiple keys (key rotation).
 * Usage: APIFOOTBALL_KEYS="key1,key2,..." npx tsx src/scripts/apifootball-photos.ts [--limit N] [--all]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger, errorMessage } from "../logger.js";
import type { Country, PlayerUniverseEntry } from "../domain.js";

const DATA_DIR = resolve(process.cwd(), "..", "data");
const PER_KEY = 95; // safe share within the daily 100 limit
const THROTTLE_MS = 350;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, "").trim();

interface AfPlayer {
  id: number;
  name: string;
  firstname: string | null;
  lastname: string | null;
  nationality: string | null;
  photo: string | null;
}

async function searchPlayer(key: string, query: string): Promise<AfPlayer[]> {
  const res = await fetch(`https://v3.football.api-sports.io/players/profiles?search=${encodeURIComponent(query)}`, {
    headers: { "x-apisports-key": key },
  });
  if (!res.ok) return [];
  const j = (await res.json()) as { response?: Array<{ player: AfPlayer }>; errors?: unknown };
  return (j.response ?? []).map((r) => r.player);
}

/** Picks the best player from the candidate list by name + country match. */
function bestMatch(players: AfPlayer[], fullName: string, countryEn: string): AfPlayer | null {
  const nn = norm(fullName);
  const words = nn.split(/\s+/).filter(Boolean);
  const byCountry = players.filter((p) => norm(p.nationality ?? "") === norm(countryEn));
  const pool = byCountry.length > 0 ? byCountry : players;
  // A match if most of the name words appear in the candidate
  const scored = pool
    .map((p) => {
      const cand = norm(`${p.firstname ?? ""} ${p.lastname ?? ""} ${p.name}`);
      const hits = words.filter((w) => cand.includes(w)).length;
      return { p, hits, country: norm(p.nationality ?? "") === norm(countryEn) };
    })
    .sort((a, b) => (b.country ? 1 : 0) - (a.country ? 1 : 0) || b.hits - a.hits);
  const top = scored[0];
  return top && top.hits > 0 ? top.p : null;
}

async function main(): Promise<void> {
  const keys = (process.env.APIFOOTBALL_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (keys.length === 0) throw new Error("APIFOOTBALL_KEYS env is required (comma-separated)");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number.parseInt(process.argv[limitArg + 1] ?? "", 10) : Infinity;
  const doAll = process.argv.includes("--all");

  const playersPath = resolve(DATA_DIR, "players.json");
  const players = JSON.parse(readFileSync(playersPath, "utf-8")) as PlayerUniverseEntry[];
  const countries = JSON.parse(readFileSync(resolve(DATA_DIR, "countries.json"), "utf-8")) as Country[];
  const enByIso = new Map(countries.map((c) => [c.isoCode, c.countryNameEn]));

  // Skip those that already have an API-Football portrait. Priority: those without a photo.
  const isApif = (p: PlayerUniverseEntry): boolean => p.photo.includes("api-sports.io");
  const targets = players
    .filter((p) => (doAll ? !isApif(p) : !p.photo || !isApif(p)))
    .sort((a, b) => (a.photo ? 1 : 0) - (b.photo ? 1 : 0)); // those without a photo first

  logger.info("API-Football photo fetch", { keys: keys.length, dailyBudget: keys.length * PER_KEY, targets: targets.length });

  let keyIdx = 0;
  let usedThisKey = 0;
  let updated = 0;
  let processed = 0;

  for (const p of targets) {
    if (processed >= limit) break;
    if (usedThisKey >= PER_KEY) { keyIdx += 1; usedThisKey = 0; }
    if (keyIdx >= keys.length) {
      logger.warn("Daily request budget exhausted - remaining players on the next run", { kalan: targets.length - processed });
      break;
    }
    const key = keys[keyIdx] as string;
    const surname = norm(p.name).split(/\s+/).filter(Boolean).slice(-1)[0] ?? "";
    const query = surname.length >= 4 ? surname : norm(p.name);
    usedThisKey += 1;
    processed += 1;
    try {
      const results = await searchPlayer(key, query);
      const match = bestMatch(results, p.name, enByIso.get(p.nationalTeam) ?? p.nationalTeam);
      if (match?.photo) {
        p.photo = match.photo;
        updated += 1;
      }
    } catch (e: unknown) {
      logger.debug("search error", { name: p.name, error: errorMessage(e) });
    }
    if (processed % 25 === 0) {
      logger.info("progress", { processed, updated, key: keyIdx + 1 });
      writeFileSync(playersPath, JSON.stringify(players, null, 2)); // intermediate save
    }
    await sleep(THROTTLE_MS);
  }

  writeFileSync(playersPath, JSON.stringify(players, null, 2));
  const withApif = players.filter(isApif).length;
  logger.info("API-Football photos complete", { processed, updated, totalApifPhoto: withApif });
}

main().catch((error: unknown) => {
  logger.error("apifootball-photos failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
