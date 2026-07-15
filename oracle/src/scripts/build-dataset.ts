/**
 * Dataset builder: builds the player universe and country list from REAL ESPN
 * WC 2026 data; nothing is fabricated.
 *
 * Flow:
 *  1) ESPN roster -> 48 teams x 26 real WC squads (ESPN id, position, photo)
 *  2) ESPN schedule -> event ids of played matches
 *  3) Each match box score -> scoreEspnMatch -> player tournament total points (retro)
 *  4) Assign tier/price/rarity based on total points (grounded in real performance)
 *  5) Write players.json + countries.json
 *
 * Usage: npm run build:dataset
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger, errorMessage } from "../logger.js";
import type { Country, PlayerUniverseEntry } from "../domain.js";
import { TIER_PRICE_SOL } from "../domain.js";
import { fetchEspnUniverse } from "../espn/roster.js";
import { resolveAllPhotos } from "../espn/photo.js";
import { fetchEspnSchedule, tournamentStartDay } from "../espn/schedule.js";
import { fetchBoxScore } from "../espn/boxscore.js";
import { scoreEspnMatch } from "../scoring/espnScorer.js";
import { assignTiers } from "../pipeline/universe.js";
import { buildCountry } from "../pipeline/countries.js";

const DATA_DIR = resolve(process.cwd(), "..", "data");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  // 1) ESPN real WC squads -> player universe
  const rosterPlayers = await fetchEspnUniverse();
  const universe = new Map<number, PlayerUniverseEntry>();
  for (const p of rosterPlayers) {
    universe.set(p.playerId, {
      playerId: p.playerId,
      name: p.name,
      nationalTeam: p.nationalTeam,
      jerseyNumber: p.jerseyNumber,
      position: p.position,
      priceTier: "Budget",
      priceSol: TIER_PRICE_SOL.Budget,
      rarity: "Common",
      photo: p.photo,
    });
  }

  // 1b) Resolve real photo for each player (ESPN -> Wikidata). Updates in place.
  logger.info("resolving photos (ESPN -> Wikidata)…");
  await resolveAllPhotos([...universe.values()]);

  // 2) ESPN schedule -> played matches
  const fixtures = await fetchEspnSchedule();
  const startDay = tournamentStartDay(fixtures);
  const completed = fixtures.filter((f) => f.completed);
  logger.info("matches to score", { completed: completed.length });

  // 3) Each match box score -> retroactive total points
  const points = new Map<number, number>();
  let processed = 0;
  for (const fx of completed) {
    const box = await fetchBoxScore(fx.eventId);
    await sleep(120);
    if (!box) continue;
    const results = scoreEspnMatch(Number.parseInt(fx.eventId, 10), box, universe);
    for (const r of results) points.set(r.playerId, (points.get(r.playerId) ?? 0) + r.rawPoints);
    processed += 1;
    if (processed % 20 === 0) logger.info("box score progress", { processed, total: completed.length });
  }
  logger.info("retroactive points computed", { matches: processed, scoredPlayers: points.size });

  // 4) tier/price/rarity based on points (all fields including photo are preserved)
  const priced = assignTiers(universe, points);

  // 5) Write - players.json + countries.json
  const players = [...priced.values()].sort((a, b) => (points.get(b.playerId) ?? 0) - (points.get(a.playerId) ?? 0));
  writeFileSync(resolve(DATA_DIR, "players.json"), JSON.stringify(players, null, 2));

  const isoSet = new Set(players.map((p) => p.nationalTeam));
  const countries: Country[] = [...isoSet].sort().map((iso) => buildCountry(iso));
  writeFileSync(resolve(DATA_DIR, "countries.json"), JSON.stringify(countries, null, 2));

  // Summary
  const byTeam = new Map<string, number>();
  for (const p of players) byTeam.set(p.nationalTeam, (byTeam.get(p.nationalTeam) ?? 0) + 1);
  const teamsWith26 = [...byTeam.values()].filter((n) => n === 26).length;
  const withPhoto = players.filter((p) => p.photo).length;
  logger.info("Dataset built", {
    players: players.length,
    teams: countries.length,
    teamsWith26,
    withPhoto: `${withPhoto}/${players.length}`,
    topScorer: players[0] ? `${players[0].name} (${points.get(players[0].playerId) ?? 0}p)` : "-",
  });
  const off = [...byTeam.entries()].filter(([, n]) => n !== 26);
  if (off.length > 0) logger.warn("teams without 26 players", { teams: Object.fromEntries(off) });
}

main().catch((error: unknown) => {
  logger.error("dataset build failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
