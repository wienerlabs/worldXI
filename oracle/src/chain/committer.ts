/**
 * Onchain committer: writes raw fantasy points to the chain via commit_score.
 *
 * Idempotency: the same raw+mvp value for the same (matchday, playerId) is not sent
 * twice (avoids unnecessary tx). On-chain, thanks to the delta logic, re-writing the
 * same value is safe, but the cache lowers cost.
 *
 * NOTE (roadmap): in the MVP the oracle is the sole signing authority. In the future,
 * merkle-commit + a challenge window will be added to minimize trust.
 */
import { SystemProgram, Transaction, sendAndConfirmTransaction, type PublicKey } from "@solana/web3.js";
import { logger, errorMessage } from "../logger.js";
import {
  cardPda,
  playerPda,
  profilePda,
  scorePda,
  squadPda,
  tournamentPda,
  type ChainContext,
} from "./program.js";

interface CommitState {
  raw: number;
  mvp: boolean;
}

export class Committer {
  private readonly tournament: PublicKey;
  private readonly cache = new Map<string, CommitState>();

  constructor(
    private readonly ctx: ChainContext,
    private readonly tournamentName: string
  ) {
    this.tournament = tournamentPda(ctx.programId, tournamentName);
  }

  get tournamentAddress(): PublicKey {
    return this.tournament;
  }

  /** Sets the matchday lock (orchestrator: true at the start, false at the end). */
  async setMatchday(matchday: number, locked: boolean): Promise<string> {
    const sig = await this.ctx.program.methods
      .setMatchday(matchday, locked)
      .accountsPartial({ tournament: this.tournament, oracle: this.ctx.wallet.publicKey })
      .rpc();
    logger.info("setMatchday sent", { matchday, locked, sig });
    return sig;
  }

  /** Writes/updates a player's raw points live (skips if unchanged). */
  async commitScore(
    matchday: number,
    playerId: number,
    rawPoints: number,
    wasMvp: boolean
  ): Promise<string | null> {
    const key = `${matchday}:${playerId}`;
    const prev = this.cache.get(key);
    if (prev && prev.raw === rawPoints && prev.mvp === wasMvp) {
      return null; // unchanged
    }
    try {
      const sig = await this.ctx.program.methods
        .commitScore(matchday, playerId, rawPoints, wasMvp)
        .accountsPartial({
          tournament: this.tournament,
          player: playerPda(this.ctx.programId, this.tournament, playerId),
          scoreCommit: scorePda(this.ctx.programId, this.tournament, matchday, playerId),
          oracle: this.ctx.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      this.cache.set(key, { raw: rawPoints, mvp: wasMvp });
      logger.debug("commit_score written", { matchday, playerId, rawPoints, wasMvp, sig });
      return sig;
    } catch (error: unknown) {
      logger.error("commit_score failed", { matchday, playerId, error: errorMessage(error) });
      throw error;
    }
  }

  /**
   * Commits multiple players' raw points in a SINGLE tx (RPC-friendly batch).
   * Skips unchanged ones via the cache. Returns the number of confirmed commits.
   */
  async commitScoreBatch(
    entries: Array<{ matchday: number; playerId: number; rawPoints: number; wasMvp: boolean }>
  ): Promise<number> {
    const fresh = entries.filter((e) => {
      const prev = this.cache.get(`${e.matchday}:${e.playerId}`);
      return !(prev && prev.raw === e.rawPoints && prev.mvp === e.wasMvp);
    });
    if (fresh.length === 0) return 0;

    const tx = new Transaction();
    for (const e of fresh) {
      const ix = await this.ctx.program.methods
        .commitScore(e.matchday, e.playerId, e.rawPoints, e.wasMvp)
        .accountsPartial({
          tournament: this.tournament,
          player: playerPda(this.ctx.programId, this.tournament, e.playerId),
          scoreCommit: scorePda(this.ctx.programId, this.tournament, e.matchday, e.playerId),
          oracle: this.ctx.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      tx.add(ix);
    }
    await sendAndConfirmTransaction(this.ctx.connection, tx, [this.ctx.wallet], {
      commitment: "confirmed",
    });
    for (const e of fresh) this.cache.set(`${e.matchday}:${e.playerId}`, { raw: e.rawPoints, mvp: e.wasMvp });
    return fresh.length;
  }

  /**
   * Settles one matchday for a squad. `activePlayerIds` is the player_id list of the
   * active 11 (the client must have swapped in a substitute for any starter who did not
   * play). Only players that have a ScoreCommit are passed in.
   */
  async settleSquadMatchday(
    matchday: number,
    owner: PublicKey,
    activePlayerIds: number[]
  ): Promise<string> {
    const remaining = activePlayerIds.flatMap((id) => [
      {
        pubkey: scorePda(this.ctx.programId, this.tournament, matchday, id),
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: cardPda(this.ctx.programId, this.tournament, owner, id),
        isSigner: false,
        isWritable: true,
      },
    ]);

    const sig = await this.ctx.program.methods
      .settleSquadMatchday(matchday)
      .accountsPartial({
        tournament: this.tournament,
        squad: squadPda(this.ctx.programId, this.tournament, owner),
        profile: profilePda(this.ctx.programId, owner),
        crank: this.ctx.wallet.publicKey,
      })
      .remainingAccounts(remaining)
      .rpc();
    logger.info("settle_squad_matchday sent", { matchday, owner: owner.toBase58(), sig });
    return sig;
  }
}
