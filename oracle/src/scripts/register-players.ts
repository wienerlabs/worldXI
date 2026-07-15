/**
 * Registers all players from players.json on the chain (register_player).
 * RPC-friendly: bulk-checks which are already registered (getMultipleAccounts),
 * batches only the missing ones with a few instructions per tx, and waits between
 * batches (throttle). This way it completes step by step, without hitting the 429
 * rate limit.
 *
 * Usage: npm run register
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Transaction, sendAndConfirmTransaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { loadConfig } from "../config.js";
import { logger, errorMessage } from "../logger.js";
import { loadKeypair } from "../chain/keypair.js";
import { BN, createChainContext, playerPda, tournamentPda } from "../chain/program.js";
import {
  POSITION_TO_ANCHOR,
  RARITY_TO_ANCHOR,
  type PlayerUniverseEntry,
} from "../domain.js";

const DATA_DIR = resolve(process.cwd(), "..", "data");
const BATCH_SIZE = 6; // register_player instruction count per tx
const THROTTLE_MS = 400; // wait between batches (RPC-friendly)
const CHECK_CHUNK = 100; // accounts per getMultipleAccounts

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
const countryBytes = (iso3: string): number[] => Array.from(Buffer.from(iso3, "ascii")).slice(0, 3);

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR is required");
  const wallet = loadKeypair(cfg.ORACLE_KEYPAIR);
  const ctx = createChainContext(cfg, wallet);
  const tPda = tournamentPda(ctx.programId, cfg.TOURNAMENT_NAME);

  const players = JSON.parse(
    readFileSync(resolve(DATA_DIR, "players.json"), "utf-8")
  ) as PlayerUniverseEntry[];
  logger.info("register starting", { players: players.length, tournament: tPda.toBase58() });

  // Create the tournament if it does not exist
  if (!(await ctx.connection.getAccountInfo(tPda))) {
    await ctx.program.methods
      .initTournament(cfg.TOURNAMENT_NAME, new BN(10 * LAMPORTS_PER_SOL), wallet.publicKey)
      .accountsPartial({ authority: wallet.publicKey })
      .rpc();
    logger.info("Tournament set up on-chain");
  }

  // Bulk-detect which are already registered
  const missing: PlayerUniverseEntry[] = [];
  for (const c of chunk(players, CHECK_CHUNK)) {
    const pdas = c.map((p) => playerPda(ctx.programId, tPda, p.playerId));
    const infos = await ctx.connection.getMultipleAccountsInfo(pdas);
    c.forEach((p, i) => {
      if (!infos[i]) missing.push(p);
    });
    await sleep(THROTTLE_MS);
  }
  logger.info("registration status", { toplam: players.length, registered: players.length - missing.length, eksik: missing.length });

  // Register the missing ones in batches
  let done = 0;
  for (const batch of chunk(missing, BATCH_SIZE)) {
    const tx = new Transaction();
    for (const p of batch) {
      const ix = await ctx.program.methods
        .registerPlayer(
          p.playerId,
          p.name.slice(0, 40),
          countryBytes(p.nationalTeam),
          POSITION_TO_ANCHOR[p.position] as never,
          RARITY_TO_ANCHOR[p.rarity] as never,
          new BN(Math.round(p.priceSol * LAMPORTS_PER_SOL))
        )
        .accountsPartial({ tournament: tPda, authority: wallet.publicKey, systemProgram: SystemProgram.programId })
        .instruction();
      tx.add(ix);
    }
    try {
      await sendAndConfirmTransaction(ctx.connection, tx, [wallet], { commitment: "confirmed" });
      done += batch.length;
      if (done % 60 === 0 || done === missing.length) {
        logger.info("register progress", { saved: done, kalan: missing.length - done });
      }
    } catch (error: unknown) {
      logger.error("batch failed, will retry", { ids: batch.map((p) => p.playerId), error: errorMessage(error) });
      await sleep(2000);
    }
    await sleep(THROTTLE_MS);
  }
  logger.info("register complete", { totalSaved: done });
}

main().catch((error: unknown) => {
  logger.error("register failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
