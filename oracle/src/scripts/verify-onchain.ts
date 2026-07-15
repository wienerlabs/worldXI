/**
 * Chain verification: reads players' ScoreCommit PDAs from the chain for a given
 * matchday and shows raw points + MVP status. Proof that "points are really onchain"
 * (demo). Usage: npx tsx src/scripts/verify-onchain.ts <matchday> <id1,id2,...>
 */
import { loadConfig } from "../config.js";
import { logger, errorMessage } from "../logger.js";
import { loadKeypair } from "../chain/keypair.js";
import { createChainContext, scorePda, tournamentPda } from "../chain/program.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR required");
  const matchday = Number.parseInt(process.argv[2] ?? "6", 10);
  const ids = (process.argv[3] ?? "231388")
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));

  const wallet = loadKeypair(cfg.ORACLE_KEYPAIR);
  const ctx = createChainContext(cfg, wallet);
  const t = tournamentPda(ctx.programId, cfg.TOURNAMENT_NAME);

  logger.info("Chain ScoreCommit verification", { matchday, tournament: t.toBase58() });
  let found = 0;
  for (const id of ids) {
    const pda = scorePda(ctx.programId, t, matchday, id);
    const acc = await ctx.program.account.scoreCommit.fetch(pda).catch(() => null);
    if (acc) {
      found += 1;
      logger.info("onchain ScoreCommit", {
        playerId: id,
        pda: pda.toBase58(),
        rawPoints: (acc.rawPoints as number),
        wasMvp: acc.wasMvp as boolean,
      });
    } else {
      logger.warn("ScoreCommit not found (not committed in this matchday)", { playerId: id });
    }
  }
  logger.info("Verification done", { matchday, checked: ids.length, onchain: found });
}

main().catch((error: unknown) => {
  logger.error("verify-onchain failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
