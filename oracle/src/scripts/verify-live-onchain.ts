/**
 * LIVE ON-CHAIN PROOF: takes the active matchday's players from /live/matchday,
 * for each one REALLY reads the ScoreCommit PDA from the chain and compares the rawPoints
 * value against the API. If the on-chain account exists, "it is being written live to the chain" is proven.
 *
 * Usage: npx tsx src/scripts/verify-live-onchain.ts
 */
import { loadConfig } from "../config.js";
import { loadKeypair } from "../chain/keypair.js";
import { createChainContext, scorePda, tournamentPda } from "../chain/program.js";
import { errorMessage } from "../logger.js";

const API = "http://localhost:8787";

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR required");
  const wallet = loadKeypair(cfg.ORACLE_KEYPAIR);
  const ctx = createChainContext(cfg, wallet);
  const tPda = tournamentPda(ctx.programId, cfg.TOURNAMENT_NAME);

  const live = (await fetch(`${API}/live/matchday`).then((r) => r.json())) as {
    matchday: number;
    players: Array<{ playerId: number; rawPoints: number; wasMvp: boolean }>;
  };
  const md = live.matchday;
  const top = [...live.players].sort((a, b) => b.rawPoints - a.rawPoints).slice(0, 10);
  console.log(`Active matchday: ${md} | API players: ${live.players.length} | checking top 10\n`);

  let onchain = 0;
  for (const p of top) {
    const pda = scorePda(ctx.programId, tPda, md, p.playerId);
    try {
      const acc = await ctx.program.account.scoreCommit.fetch(pda);
      const chainPts = Number(acc.rawPoints);
      const match = chainPts === p.rawPoints ? "MATCH" : `DIFF (api=${p.rawPoints})`;
      console.log(`  player ${p.playerId}: ON-CHAIN rawPoints=${chainPts} mvp=${acc.wasMvp}  [${match}]  pda=${pda.toBase58().slice(0, 8)}..`);
      onchain++;
    } catch {
      console.log(`  player ${p.playerId}: NOT on chain (api rawPoints=${p.rawPoints}) - not committed yet`);
    }
  }
  console.log(`\nRESULT: ${onchain}/${top.length} players REALLY on-chain (matchday ${md}).`);
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error("verify-live-onchain error:", errorMessage(e));
  process.exit(1);
});
