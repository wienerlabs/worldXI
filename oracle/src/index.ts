/**
 * Oracle main entry point: loads the dataset, starts the leaderboard API, and
 * listens to the TxLINE live stream to commit points to the chain during a match.
 * State is shared between the orchestrator (writer) and the API (reader); on every update
 * a live tick is broadcast to the frontend over WS.
 */
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { logger, errorMessage } from "./logger.js";
import { loadKeypair } from "./chain/keypair.js";
import { createChainContext } from "./chain/program.js";
import { Committer } from "./chain/committer.js";
import { TxlineClient } from "./txline/client.js";
import { OracleState } from "./state.js";
import { Orchestrator } from "./orchestrator.js";
import { startApiServer } from "./api/server.js";
import { loadEspnHistory } from "./espn/history.js";

const DATA_DIR = resolve(process.cwd(), "..", "data");

/** Computes tournament history from the REAL ESPN box score (id-based) and loads it
 *  into state. Fast, RPC-independent in-memory leaderboard/player-breakdown view. */
async function loadHistory(state: OracleState): Promise<void> {
  for (const { matchday, results } of await loadEspnHistory(state.universe)) {
    for (const r of results) state.upsertResult(matchday, r);
  }
  logger.info("Tournament history loaded into state", { players: state.playerTotals.size });
}

// The public RPC confirm phase can emit an uncatchable async rejection during live commit.
// Tolerate ONLY those known-transient RPC errors (warn); surface anything else as an error so
// real bugs are no longer silently masked. The process stays up either way (oracle uptime is
// critical), but unexpected rejections are now visible instead of hidden.
const TRANSIENT_RPC =
  /confirmTransaction|block height exceeded|Blockhash not found|Too many requests|\b429\b|TransactionExpired|node is behind|fetch failed|ECONNRESET|ETIMEDOUT/i;
process.on("unhandledRejection", (reason) => {
  const msg = String(reason);
  if (TRANSIENT_RPC.test(msg)) {
    logger.warn("transient RPC rejection (ignored)", { reason: msg.slice(0, 160) });
  } else {
    logger.error("unexpected unhandledRejection", { reason: msg.slice(0, 300) });
  }
});

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR is required");

  const state = new OracleState();
  state.loadDataset(DATA_DIR);

  const oracleWallet = loadKeypair(cfg.ORACLE_KEYPAIR);
  const ctx = createChainContext(cfg, oracleWallet);
  const committer = new Committer(ctx, cfg.TOURNAMENT_NAME);

  // Set up TxLINE BEFORE the API: the match hub endpoints (/matches, /match/:id) use it
  // for live fixtures+scores. If it fails, the match hub stays disabled (503),
  // the other endpoints keep working.
  let txline: TxlineClient | null = null;
  try {
    const txlineWallet = loadKeypair(cfg.TXLINE_WALLET_KEYPAIR ?? cfg.ORACLE_KEYPAIR);
    txline = new TxlineClient(cfg, txlineWallet);
    await txline.init();
  } catch (error: unknown) {
    logger.warn("TxLINE could not start - match hub disabled", { error: errorMessage(error) });
    txline = null;
  }

  const api = startApiServer(cfg, state, ctx, txline);

  // Load history into state for leaderboard + player match breakdown (ESPN, without RPC/TxLINE).
  await loadHistory(state);
  api.broadcast();

  // API-only mode: serves only leaderboard/metadata + match hub (no live commit).
  if (process.env.ORACLE_API_ONLY === "true" || !txline) {
    logger.info("Oracle in API-only mode (live commit disabled)");
    return;
  }

  // Live stream: TxLINE real feed (fixtures + SSE + on-chain subscribe).
  const orchestrator = new Orchestrator(cfg, state, txline, committer, () => api.broadcast(), (goal) => api.broadcastGoal(goal));
  await orchestrator.init();

  const abort = new AbortController();
  const shutdown = (): void => {
    logger.info("shutting down...");
    abort.abort();
    void api.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  logger.info("Oracle live stream starting");
  await orchestrator.runLive(abort.signal);
}

main().catch((error: unknown) => {
  logger.error("oracle could not start", { error: errorMessage(error) });
  process.exitCode = 1;
});
