/**
 * Reprice: re-prices the existing players.json (PRESERVING photos).
 * Recomputes the retroactive fantasy score (ESPN box score), combines it with the
 * manual star boost, and assigns hybrid tier/price/rarity. Does NOT rebuild
 * players.json from scratch (photos are not lost).
 *
 * Usage: npx tsx src/scripts/reprice.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger, errorMessage } from "../logger.js";
import type { PlayerUniverseEntry, Tier } from "../domain.js";
import { loadEspnHistory } from "../espn/history.js";
import { assignTiers } from "../pipeline/universe.js";
import { starBoost, MANUAL_STAR_NAMES } from "../pipeline/starTiers.js";

const DATA_DIR = resolve(process.cwd(), "..", "data");

async function main(): Promise<void> {
  const path = resolve(DATA_DIR, "players.json");
  const players = JSON.parse(readFileSync(path, "utf-8")) as PlayerUniverseEntry[];
  const universe = new Map(players.map((p) => [p.playerId, p]));
  logger.info("reprice starting", { players: players.length });

  // Retroactive fantasy score (ESPN box score) - the performance basis for pricing.
  const history = await loadEspnHistory(universe);
  const points = new Map<number, number>();
  for (const { results } of history) {
    for (const r of results) points.set(r.playerId, (points.get(r.playerId) ?? 0) + r.rawPoints);
  }

  // Hybrid tier: retro points + manual star boost.
  const priced = assignTiers(universe, points, starBoost);
  const out = players.map((p) => priced.get(p.playerId) ?? p); // preserve original order

  writeFileSync(path, JSON.stringify(out, null, 2));

  // --- Reports ---
  const boostedCount = out.filter((p) => starBoost(p.name) > 0).length;
  const dist: Record<Tier, number> = { Legendary: 0, Star: 0, Solid: 0, Rotation: 0, Budget: 0 };
  for (const p of out) dist[p.priceTier] += 1;

  // Manual star match check (unmatched = not in squad / misspelled - harmless).
  const nameSet = new Set(out.filter((p) => starBoost(p.name) > 0).map((p) => p.name.toLowerCase()));
  const unmatched = MANUAL_STAR_NAMES.filter((n) => {
    const surname = n.toLowerCase().split(" ").slice(-1)[0] ?? n.toLowerCase();
    return ![...nameSet].some((pn) => pn.includes(surname));
  });

  // Budget validation (25 SOL): cheapest + balanced squad.
  const cheapest15 = [...out].sort((a, b) => a.priceSol - b.priceSol).slice(0, 15)
    .reduce((s, p) => s + p.priceSol, 0);

  logger.info("Reprice complete", {
    players: out.length,
    tierDistribution: dist,
    manualStar: `${boostedCount} matched / ${MANUAL_STAR_NAMES.length} in list`,
    cheapest15Squad: `${cheapest15.toFixed(1)} SOL (budget 25)`,
    topLegendary: out.filter((p) => p.priceTier === "Legendary").slice(0, 5).map((p) => p.name),
  });
  if (unmatched.length > 0) {
    logger.warn("Names in the manual list not found in players.json (harmless)", { unmatched: unmatched.slice(0, 20) });
  }
}

main().catch((error: unknown) => {
  logger.error("reprice failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
