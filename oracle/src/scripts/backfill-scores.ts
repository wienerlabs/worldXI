/**
 * Retroactive backfill: scores all played WC 2026 matches from the REAL ESPN box
 * score (id-based) and writes each player's matchday raw points to the chain via
 * commit_score. Replays the live experience (leaderboard movement) for the demo.
 *
 * Scoring is matched 100% by ESPN athlete id (no name matching). Goals/assists/cards/
 * clean sheet/appearances are all real. RPC-friendly: batch + throttle (no 429s).
 *
 * Usage: npm run backfill [-- --matchday N]
 */
import { loadConfig } from "../config.js";
import { logger, errorMessage } from "../logger.js";
import { loadKeypair } from "../chain/keypair.js";
import { createChainContext } from "../chain/program.js";
import { Committer } from "../chain/committer.js";
import { TxlineClient } from "../txline/client.js";
import { OracleState } from "../state.js";
import { loadEspnHistory } from "../espn/history.js";
import { resolve } from "node:path";

const DATA_DIR = resolve(process.cwd(), "..", "data");
const THROTTLE_MS = 500; // wait between batches (RPC-friendly)
const BATCH_SIZE = 5; // commit_score count per tx

// The public RPC confirm stage sometimes throws an uncatchable callback error;
// log it and continue without crashing the process (missed commits complete on the second run).
process.on("unhandledRejection", (reason) => {
  logger.warn("unhandledRejection (ignored)", { reason: String(reason).slice(0, 120) });
});
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR is required");

  const mdArgIdx = process.argv.indexOf("--matchday");
  const onlyMatchday =
    mdArgIdx >= 0 ? Number.parseInt(process.argv[mdArgIdx + 1] ?? "", 10) : undefined;

  const oracleWallet = loadKeypair(cfg.ORACLE_KEYPAIR);
  const ctx = createChainContext(cfg, oracleWallet);
  const committer = new Committer(ctx, cfg.TOURNAMENT_NAME);

  const state = new OracleState();
  state.loadDataset(DATA_DIR);

  // TxLINE core feed: fixtures + live goal/card events participate in scoring.
  // (If it cannot connect, continues ESPN-only - handled safely inside loadEspnHistory.)
  let txline: TxlineClient | undefined;
  try {
    const txWallet = loadKeypair(cfg.TXLINE_WALLET_KEYPAIR ?? cfg.ORACLE_KEYPAIR);
    txline = new TxlineClient(cfg, txWallet);
    await txline.init();
  } catch (e: unknown) {
    logger.warn("TxLINE init failed, ESPN-only backfill", { error: errorMessage(e) });
    txline = undefined;
  }

  // ESPN box score (+ TxLINE events) -> matchday results
  const history = await loadEspnHistory(state.universe, txline);
  const ordered = history.sort((a, b) => a.matchday - b.matchday);

  let committed = 0;
  for (const { matchday, fixtureId, results } of ordered) {
    if (onlyMatchday !== undefined && matchday !== onlyMatchday) continue;
    for (const r of results) state.upsertResult(matchday, r);

    const commits = results.map((r) => ({
      matchday,
      playerId: r.playerId,
      rawPoints: r.rawPoints,
      wasMvp: r.wasMvp,
    }));
    for (const batch of chunk(commits, BATCH_SIZE)) {
      try {
        committed += await committer.commitScoreBatch(batch);
      } catch (e: unknown) {
        logger.error("batch commit failed", { error: errorMessage(e) });
        await sleep(1500);
      }
      await sleep(THROTTLE_MS);
    }
    logger.info("fixture backfill", { fixtureId, matchday, players: results.length, committed });
  }
  logger.info("Backfill complete", { committed });
}

main().catch((error: unknown) => {
  logger.error("backfill failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
