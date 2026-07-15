/**
 * Manually sets the tournament matchday lock (setMatchday instruction).
 * If the replay was stopped midway the tournament may stay locked; this unlocks it.
 *
 * Usage:
 *   npx tsx src/scripts/set-matchday.ts <matchday> <locked>
 *   npx tsx src/scripts/set-matchday.ts 0 false   # unlock (no match)
 */
import { loadConfig } from "../config.js";
import { loadKeypair } from "../chain/keypair.js";
import { createChainContext } from "../chain/program.js";
import { Committer } from "../chain/committer.js";
import { logger, errorMessage } from "../logger.js";

async function main(): Promise<void> {
  const matchday = Number.parseInt(process.argv[2] ?? "0", 10);
  const locked = process.argv[3] === "true";
  if (Number.isNaN(matchday)) throw new Error("matchday must be a number");

  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR required");
  const wallet = loadKeypair(cfg.ORACLE_KEYPAIR);
  const ctx = createChainContext(cfg, wallet);
  const committer = new Committer(ctx, cfg.TOURNAMENT_NAME);

  const sig = await committer.setMatchday(matchday, locked);
  logger.info("Tournament matchday updated", { matchday, locked, sig });
  process.exit(0);
}

main().catch((e: unknown) => {
  logger.error("set-matchday failed", { error: errorMessage(e) });
  process.exit(1);
});
