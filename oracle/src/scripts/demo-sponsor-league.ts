/**
 * Creates a demo sponsor league (create_sponsor_league). The sponsor prize is
 * deposited into the league PDA on chain; there is NO user entry fee (risk-free design:
 * no shared pool/betting). So a real sponsor league appears in the frontend.
 *
 * Usage: npm run demo-league
 */
import { SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { loadConfig } from "../config.js";
import { logger, errorMessage } from "../logger.js";
import { loadKeypair } from "../chain/keypair.js";
import { BN, createChainContext, leaguePda, tournamentPda } from "../chain/program.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR required");
  const wallet = loadKeypair(cfg.ORACLE_KEYPAIR);
  const ctx = createChainContext(cfg, wallet);
  const tPda = tournamentPda(ctx.programId, cfg.TOURNAMENT_NAME);

  const leagues: Array<{ name: string; prizeSol: number }> = [
    { name: "Community Cup", prizeSol: 0.5 },
    { name: "Solana Fan League", prizeSol: 1.0 },
  ];

  for (const { name, prizeSol } of leagues) {
    const lPda = leaguePda(ctx.programId, tPda, name);
    if (await ctx.connection.getAccountInfo(lPda)) {
      logger.info("sponsor league already exists", { name });
      continue;
    }
    const sig = await ctx.program.methods
      .createSponsorLeague(name, new BN(Math.round(prizeSol * LAMPORTS_PER_SOL)))
      .accountsPartial({ tournament: tPda, sponsor: wallet.publicKey, systemProgram: SystemProgram.programId })
      .rpc();
    logger.info("Sponsor league created", { name, prizeSol, pda: lPda.toBase58(), sig });
  }
}

main().catch((error: unknown) => {
  logger.error("demo-sponsor-league failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
