/**
 * Settles a matchday for all squads: writes the final total to the chain
 * (rarity bonus + captain 2x applied onchain). A non-playing starter is replaced
 * with the first eligible bench player in the same position (spec: automatic substitute).
 *
 * Usage: npm run backfill:settle -- --matchday N
 */
import { loadConfig } from "../config.js";
import { logger, errorMessage } from "../logger.js";
import { loadKeypair } from "../chain/keypair.js";
import { createChainContext, scorePda } from "../chain/program.js";
import { Committer } from "../chain/committer.js";
import { OracleState } from "../state.js";
import type { Position } from "../domain.js";
import { resolve } from "node:path";

const DATA_DIR = resolve(process.cwd(), "..", "data");

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR required for settle");
  const mdArg = process.argv.indexOf("--matchday");
  if (mdArg < 0) throw new Error("--matchday N required");
  const matchday = Number.parseInt(process.argv[mdArg + 1] ?? "", 10);
  if (!Number.isFinite(matchday)) throw new Error("invalid matchday");

  const wallet = loadKeypair(cfg.ORACLE_KEYPAIR);
  const ctx = createChainContext(cfg, wallet);
  const committer = new Committer(ctx, cfg.TOURNAMENT_NAME);
  const tournament = committer.tournamentAddress;

  const state = new OracleState();
  state.loadDataset(DATA_DIR);

  // Unlock the matchday (finalization phase)
  await committer.setMatchday(matchday, false);

  const played = new Map<number, boolean>();
  const hasPlayed = async (playerId: number): Promise<boolean> => {
    const cached = played.get(playerId);
    if (cached !== undefined) return cached;
    const info = await ctx.connection.getAccountInfo(
      scorePda(ctx.programId, tournament, matchday, playerId)
    );
    const ok = info !== null;
    played.set(playerId, ok);
    return ok;
  };

  const positionOf = (id: number): Position => state.universe.get(id)?.position ?? "MID";

  const squads = await ctx.program.account.squad.all();
  logger.info("settle starting", { matchday, squads: squads.length });

  let settled = 0;
  for (const s of squads) {
    const squad = s.account;
    const starters: number[] = [...squad.starters];
    const bench: number[] = squad.players.filter((p: number) => !starters.includes(p));

    // Effective 11: playing starters + a same-position bench player who played, replacing non-playing starters
    const usedBench = new Set<number>();
    const effective: number[] = [];
    for (const sid of starters) {
      if (await hasPlayed(sid)) {
        effective.push(sid);
        continue;
      }
      const pos = positionOf(sid);
      let replacement: number | undefined;
      for (const b of bench) {
        if (usedBench.has(b)) continue;
        if (positionOf(b) === pos && (await hasPlayed(b))) {
          replacement = b;
          break;
        }
      }
      if (replacement !== undefined) {
        usedBench.add(replacement);
        effective.push(replacement);
      }
      // if the bench player also did not play, that position stays without points
    }

    if (effective.length === 0) {
      logger.debug("settle skipped (no effective players)", { owner: squad.owner.toBase58() });
      continue;
    }
    try {
      await committer.settleSquadMatchday(matchday, squad.owner, effective);
      settled++;
    } catch (error: unknown) {
      logger.error("settle failed", {
        owner: squad.owner.toBase58(),
        error: errorMessage(error),
      });
    }
  }
  logger.info("settle completed", { matchday, settled, total: squads.length });
}

main().catch((error: unknown) => {
  logger.error("settle-matchday failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
