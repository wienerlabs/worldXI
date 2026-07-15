/**
 * Demo squad: picks a valid 15-player squad within budget from players.json and
 * calls create_profile + submit_squad with the oracle wallet (so the manager shows
 * up on the leaderboard). Squad rules are validated on-chain.
 *
 * Usage: npm run demo-squad
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SystemProgram, LAMPORTS_PER_SOL, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { loadConfig } from "../config.js";
import { logger, errorMessage } from "../logger.js";
import { loadKeypair } from "../chain/keypair.js";
import { BN, cardPda, createChainContext, playerPda, profilePda, tournamentPda } from "../chain/program.js";
import type { PlayerUniverseEntry, Position } from "../domain.js";

const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const DATA_DIR = resolve(process.cwd(), "..", "data");

/** Picks a valid 15-player squad for 4-3-3 (budget + max 3 per country). */
function pickSquad(players: PlayerUniverseEntry[], budget: number): PlayerUniverseEntry[] {
  const need: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
  const chosen: PlayerUniverseEntry[] = [];
  const countryCount = new Map<string, number>();
  let spent = 0;

  for (const pos of ["GK", "DEF", "MID", "FWD"] as Position[]) {
    // cheapest to most expensive (so the budget covers all positions)
    const pool = players.filter((p) => p.position === pos).sort((a, b) => a.priceSol - b.priceSol);
    let taken = 0;
    for (const p of pool) {
      if (taken >= need[pos]) break;
      const cc = countryCount.get(p.nationalTeam) ?? 0;
      if (cc >= 3) continue;
      if (spent + p.priceSol > budget) continue;
      chosen.push(p);
      spent += p.priceSol;
      countryCount.set(p.nationalTeam, cc + 1);
      taken++;
    }
    if (taken < need[pos]) throw new Error(`Could not pick enough players for ${pos} (budget/country constraint)`);
  }
  return chosen;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR is required");
  const wallet = loadKeypair(cfg.ORACLE_KEYPAIR);
  const ctx = createChainContext(cfg, wallet);
  const tPda = tournamentPda(ctx.programId, cfg.TOURNAMENT_NAME);

  const t = await ctx.program.account.tournament.fetch(tPda);
  const budget = (t.budgetLamports as { toNumber(): number }).toNumber() / LAMPORTS_PER_SOL;

  const all = JSON.parse(readFileSync(resolve(DATA_DIR, "players.json"), "utf-8")) as PlayerUniverseEntry[];
  const squad = pickSquad(all, budget);
  const players = squad.map((p) => p.playerId);
  // starters: 4-3-3 -> GK + 4 DEF + 3 MID + 3 FWD
  const by = (pos: Position) => squad.filter((p) => p.position === pos).map((p) => p.playerId);
  const starters = [...by("GK").slice(0, 1), ...by("DEF").slice(0, 4), ...by("MID").slice(0, 3), ...by("FWD").slice(0, 3)];
  const captain = by("FWD")[0];
  if (captain === undefined || starters.length !== 11) throw new Error("could not pick a valid starting 11/captain");
  const spent = squad.reduce((s, p) => s + p.priceSol, 0);
  logger.info("Demo squad selected", { players: players.length, spent: `${spent.toFixed(1)}/${budget} SOL`, captain });

  // create_profile (if missing)
  if (!(await ctx.connection.getAccountInfo(profilePda(ctx.programId, wallet.publicKey)))) {
    await ctx.program.methods
      .createProfile("WorldXI Demo", Array.from(Buffer.from("TUR")))
      .accountsPartial({ owner: wallet.publicKey, systemProgram: SystemProgram.programId })
      .rpc();
    logger.info("Profile created");
  }

  // submit_squad
  const sig = await ctx.program.methods
    .submitSquad(players, starters, { f433: {} } as never, captain)
    .accountsPartial({ tournament: tPda, owner: wallet.publicKey, systemProgram: SystemProgram.programId })
    .remainingAccounts(players.map((id) => ({ pubkey: playerPda(ctx.programId, tPda, id), isSigner: false, isWritable: false })))
    .rpc();
  logger.info("Demo squad sent to chain", { sig });

  // Living cards: mint an on-chain PlayerCard (performance mirror) for each player.
  // These are "living cards" - settle_squad_matchday accumulates performance over time.
  const cardPdas = players.map((id) => cardPda(ctx.programId, tPda, wallet.publicKey, id));
  const existing = await ctx.connection.getMultipleAccountsInfo(cardPdas);
  const toMint = players.filter((_, i) => !existing[i]);
  let minted = 0;
  for (const batch of chunk(toMint, 4)) {
    const ixs = await Promise.all(
      batch.map((id) =>
        ctx.program.methods
          .createPlayerCard(id, PublicKey.default)
          .accountsPartial({ tournament: tPda, player: playerPda(ctx.programId, tPda, id), owner: wallet.publicKey, systemProgram: SystemProgram.programId })
          .instruction()
      )
    );
    try {
      await sendAndConfirmTransaction(ctx.connection, new Transaction().add(...ixs), [wallet], { commitment: "confirmed" });
      minted += batch.length;
    } catch (e: unknown) {
      logger.warn("card batch failed", { error: errorMessage(e) });
    }
  }
  logger.info("Living cards minted", { minted, alreadyExisted: players.length - toMint.length });
}

main().catch((e: unknown) => {
  logger.error("demo-squad failed", { error: errorMessage(e) });
  process.exitCode = 1;
});
