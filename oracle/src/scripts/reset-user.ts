/**
 * Resets the configured wallet's own WorldXI data on chain: closes its player cards,
 * matchday snapshots, squad and profile, refunding the rent to that wallet.
 *
 * The program gates every close on `has_one = owner` plus the owner's signature, so this
 * can only ever delete data belonging to the signing wallet. League membership is left
 * untouched by design (joining a friend league is permanent).
 *
 * Usage:
 *   npm run reset-user            # dry run, only reports what would be closed
 *   npm run reset-user -- --yes   # actually closes the accounts
 */
import { PublicKey, Transaction } from "@solana/web3.js";
import { loadConfig } from "../config.js";
import { logger, errorMessage } from "../logger.js";
import { loadKeypair } from "../chain/keypair.js";
import { createChainContext, profilePda, squadPda, tournamentPda } from "../chain/program.js";

/** Close instructions per transaction; keeps each tx comfortably under the size limit. */
const PER_TX = 8;

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR required");
  const apply = process.argv.includes("--yes");

  const wallet = loadKeypair(cfg.ORACLE_KEYPAIR);
  const ctx = createChainContext(cfg, wallet);
  const owner = wallet.publicKey;
  const tournament = tournamentPda(ctx.programId, cfg.TOURNAMENT_NAME);

  // PlayerCard layout: disc(8) + tournament(32) -> owner at 40. SquadSnapshot: owner at 8.
  const cards = await ctx.program.account.playerCard.all([
    { memcmp: { offset: 8 + 32, bytes: owner.toBase58() } },
  ]);
  const snapshots = await ctx.program.account.squadSnapshot.all([
    { memcmp: { offset: 8, bytes: owner.toBase58() } },
  ]);
  const squad = await ctx.program.account.squad.fetchNullable(squadPda(ctx.programId, tournament, owner));
  const profile = await ctx.program.account.userProfile.fetchNullable(profilePda(ctx.programId, owner));

  logger.info("accounts found", {
    owner: owner.toBase58(),
    playerCards: cards.length,
    snapshots: snapshots.length,
    squad: squad ? 1 : 0,
    profile: profile ? 1 : 0,
  });

  if (!apply) {
    logger.info("dry run: nothing closed. Re-run with --yes to close these accounts.");
    return;
  }

  // Cards and snapshots first, then squad, then the profile last (it holds the total score).
  const ixs = [
    ...(await Promise.all(
      cards.map((c) =>
        ctx.program.methods
          .closePlayerCard()
          .accountsPartial({ card: c.publicKey, owner })
          .instruction()
      )
    )),
    ...(await Promise.all(
      snapshots.map((s) =>
        ctx.program.methods
          .closeSquadSnapshot()
          .accountsPartial({ snapshot: s.publicKey, owner })
          .instruction()
      )
    )),
  ];

  if (squad) {
    ixs.push(
      await ctx.program.methods
        .closeSquad()
        .accountsPartial({ squad: squadPda(ctx.programId, tournament, owner), owner })
        .instruction()
    );
  }
  if (profile) {
    ixs.push(
      await ctx.program.methods
        .closeProfile()
        .accountsPartial({ profile: profilePda(ctx.programId, owner), owner })
        .instruction()
    );
  }

  if (ixs.length === 0) {
    logger.info("nothing to close");
    return;
  }

  let sent = 0;
  for (let i = 0; i < ixs.length; i += PER_TX) {
    const tx = new Transaction().add(...ixs.slice(i, i + PER_TX));
    const sig = await ctx.provider.sendAndConfirm!(tx, []);
    sent += Math.min(PER_TX, ixs.length - i);
    logger.info("closed batch", { closed: sent, total: ixs.length, sig });
  }
  logger.info("reset complete", { owner: owner.toBase58(), accountsClosed: ixs.length });
}

main().catch((error: unknown) => {
  logger.error("reset-user failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
