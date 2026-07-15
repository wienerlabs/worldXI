/**
 * Fixture discovery + tier/price assignment. The player universe is now built from
 * the ESPN roster (build-dataset.ts); this module only (a) discovers WC fixtures from
 * TxLINE (the live orchestrator's core feed) and (b) assigns tier/price/rarity based on
 * retroactive total points.
 */
import type { Config } from "../config.js";
import { logger } from "../logger.js";
import type { TxlineClient } from "../txline/client.js";
import type { TxFixture } from "../txline/types.js";
import type { PlayerUniverseEntry, Tier } from "../domain.js";
import { TIER_PRICE_SOL, TIER_RARITY } from "../domain.js";

/** Discovers WC fixtures: filters by competitionId if present, otherwise by "world cup" name. */
export async function discoverWorldCupFixtures(
  txline: TxlineClient,
  cfg: Config
): Promise<TxFixture[]> {
  const seen = new Map<number, TxFixture>();
  const startEpochRaw = process.env.TXLINE_START_EPOCH_DAY;
  const baseEpoch = startEpochRaw
    ? Number.parseInt(startEpochRaw, 10)
    : Math.floor(Date.now() / 86_400_000) - 45;

  // Tournament is ~6 weeks; scan in 30-day windows.
  for (const offset of [0, 30, 60]) {
    const fixtures = await txline.getFixtures(baseEpoch + offset, cfg.TXLINE_COMPETITION_ID);
    for (const f of fixtures) {
      const isWc =
        cfg.TXLINE_COMPETITION_ID !== undefined
          ? f.CompetitionId === cfg.TXLINE_COMPETITION_ID
          : /world\s*cup|dünya\s*kupas/i.test(f.Competition);
      if (isWc) seen.set(f.FixtureId, f);
    }
  }
  const list = [...seen.values()].sort((a, b) => a.StartTime - b.StartTime);
  logger.info("WC fixtures discovered", { count: list.length });
  return list;
}

/** Tier distribution (1246 players): ~3% Legendary, 12% Star, 25% Solid, 35% Rotation,
 *  25% Budget. Cumulative top-percentile thresholds. */
const TIER_QUANTILES: Array<{ tier: Tier; topFraction: number }> = [
  { tier: "Legendary", topFraction: 0.03 },
  { tier: "Star", topFraction: 0.15 },
  { tier: "Solid", topFraction: 0.40 },
  { tier: "Rotation", topFraction: 0.75 },
  { tier: "Budget", topFraction: 1.0 },
];

/**
 * Assigns tier/price/rarity. Ranking score = retroactive fantasy points + (optional)
 * manual star boost. The boost pulls known world stars (even if their past points are
 * low due to injury etc.) into a guaranteed top tier - so that price reflects the
 * "forward-looking" expectation. Without a boost, it relies purely on performance.
 */
export function assignTiers(
  universe: Map<number, PlayerUniverseEntry>,
  points: Map<number, number>,
  boost?: (name: string) => number
): Map<number, PlayerUniverseEntry> {
  const ids = [...universe.keys()];
  const ranked = ids
    .map((id) => {
      const base = universe.get(id);
      const score = (points.get(id) ?? 0) + (boost && base ? boost(base.name) : 0);
      return { id, score };
    })
    .sort((a, b) => b.score - a.score);
  const n = ranked.length;

  const out = new Map<number, PlayerUniverseEntry>();
  ranked.forEach((r, index) => {
    const rankFraction = (index + 1) / n;
    const tier = TIER_QUANTILES.find((q) => rankFraction <= q.topFraction)?.tier ?? "Budget";
    const base = universe.get(r.id);
    if (!base) return;
    out.set(r.id, {
      ...base,
      priceTier: tier,
      priceSol: TIER_PRICE_SOL[tier],
      rarity: TIER_RARITY[tier],
    });
  });
  return out;
}
