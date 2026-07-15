/**
 * Client that connects to the WorldXI Anchor program + PDA derivers.
 * The seeds are exactly identical to the on-chain `constants.rs`.
 */
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import type { Config } from "../config.js";
import idl from "./idl/worldxi.json" with { type: "json" };
import type { Worldxi } from "./idl/worldxi.js";

const TOURNAMENT_SEED = Buffer.from("tournament");
const PLAYER_SEED = Buffer.from("player");
const SQUAD_SEED = Buffer.from("squad");
const SCORE_SEED = Buffer.from("score");
const PROFILE_SEED = Buffer.from("profile");
const CARD_SEED = Buffer.from("card");
const LEAGUE_SEED = Buffer.from("league");

export function u32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}
export function u16le(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}

export interface ChainContext {
  connection: Connection;
  provider: AnchorProvider;
  program: Program<Worldxi>;
  wallet: Keypair;
  programId: PublicKey;
}

export function createChainContext(cfg: Config, wallet: Keypair): ChainContext {
  const connection = new Connection(cfg.RPC_URL, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(wallet), {
    commitment: "confirmed",
  });
  const program = new Program<Worldxi>(idl as Worldxi, provider);
  return { connection, provider, program, wallet, programId: program.programId };
}

// --- PDA derivers ---
export function tournamentPda(programId: PublicKey, name: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [TOURNAMENT_SEED, Buffer.from(name)],
    programId
  )[0];
}
export function playerPda(programId: PublicKey, tournament: PublicKey, playerId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [PLAYER_SEED, tournament.toBuffer(), u32le(playerId)],
    programId
  )[0];
}
export function scorePda(
  programId: PublicKey,
  tournament: PublicKey,
  matchday: number,
  playerId: number
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SCORE_SEED, tournament.toBuffer(), u16le(matchday), u32le(playerId)],
    programId
  )[0];
}
export function squadPda(programId: PublicKey, tournament: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SQUAD_SEED, tournament.toBuffer(), owner.toBuffer()],
    programId
  )[0];
}
export function profilePda(programId: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([PROFILE_SEED, owner.toBuffer()], programId)[0];
}
export function cardPda(
  programId: PublicKey,
  tournament: PublicKey,
  owner: PublicKey,
  playerId: number
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [CARD_SEED, tournament.toBuffer(), owner.toBuffer(), u32le(playerId)],
    programId
  )[0];
}
export function leaguePda(programId: PublicKey, tournament: PublicKey, name: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [LEAGUE_SEED, tournament.toBuffer(), Buffer.from(name)],
    programId
  )[0];
}

export { BN };
