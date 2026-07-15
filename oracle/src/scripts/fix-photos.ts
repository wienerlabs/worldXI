/**
 * Re-resolves only player photos (players.json) - does not touch points.
 * ESPN headshot -> Wikidata P18, rate-limit friendly (retry + backoff). Box score
 * is not re-fetched, so it is fast.
 *
 * Usage: npx tsx src/scripts/fix-photos.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger, errorMessage } from "../logger.js";
import type { PlayerUniverseEntry } from "../domain.js";
import { resolveAllPhotos } from "../espn/photo.js";
import { espnHeadshotUrl } from "../espn/roster.js";

const DATA_DIR = resolve(process.cwd(), "..", "data");

async function main(): Promise<void> {
  const path = resolve(DATA_DIR, "players.json");
  const players = JSON.parse(readFileSync(path, "utf-8")) as PlayerUniverseEntry[];
  const reset = process.argv.includes("--all");
  // Default: resolve only players without photos (keep existing photos, fast).
  // --all: re-resolve everything from scratch.
  const targets = reset ? players : players.filter((p) => !p.photo);
  for (const p of targets) p.photo = espnHeadshotUrl(p.playerId);
  logger.info("players to resolve", { targets: targets.length, mode: reset ? "all" : "missing-only" });
  await resolveAllPhotos(targets);
  writeFileSync(path, JSON.stringify(players, null, 2));
  const withPhoto = players.filter((p) => p.photo).length;
  logger.info("Photos updated", { players: players.length, withPhoto: `${withPhoto}/${players.length}` });
}

main().catch((error: unknown) => {
  logger.error("photo update failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
