/**
 * Updates the tournament's squad budget (set_budget). Usage:
 *   npm run set-budget -- 25
 */
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { loadConfig } from "../config.js";
import { logger, errorMessage } from "../logger.js";
import { loadKeypair } from "../chain/keypair.js";
import { BN, createChainContext, tournamentPda } from "../chain/program.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR required");
  const sol = Number.parseFloat(process.argv[2] ?? "25");
  const wallet = loadKeypair(cfg.ORACLE_KEYPAIR);
  const ctx = createChainContext(cfg, wallet);
  const tPda = tournamentPda(ctx.programId, cfg.TOURNAMENT_NAME);

  const sig = await ctx.program.methods
    .setBudget(new BN(Math.round(sol * LAMPORTS_PER_SOL)))
    .accountsPartial({ tournament: tPda, authority: wallet.publicKey })
    .rpc();
  logger.info("Budget updated", { sol, sig });
}

main().catch((e: unknown) => {
  logger.error("set-budget failed", { error: errorMessage(e) });
  process.exitCode = 1;
});
