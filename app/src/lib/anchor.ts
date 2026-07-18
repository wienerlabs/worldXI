/**
 * WorldXI Anchor program client (browser, via wallet-adapter).
 * Real onchain transactions for submit_squad and create_profile.
 */
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import idl from "../idl/worldxi.json";
import type { Worldxi } from "../idl/worldxi";
import type { Player } from "./types";
import { FORMATIONS } from "./types";

const TOURNAMENT_NAME = (import.meta.env.VITE_TOURNAMENT as string | undefined) ?? "WC2026";
const PROGRAM_ID = new PublicKey((idl as { address: string }).address);

const enc = new TextEncoder();
const u32le = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; };

const POS_ANCHOR: Record<string, object> = { GK: { goalkeeper: {} }, DEF: { defender: {} }, MID: { midfielder: {} }, FWD: { forward: {} } };
const FORM_ANCHOR: Record<string, object> = {
  F433: { f433: {} }, F442: { f442: {} }, F352: { f352: {} }, F343: { f343: {} }, F532: { f532: {} }, F541: { f541: {} }, F451: { f451: {} },
};

export function getProgram(connection: Connection, wallet: AnchorWallet): Program<Worldxi> {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program<Worldxi>(idl as Worldxi, provider);
}

export function tournamentPda(): PublicKey {
  return PublicKey.findProgramAddressSync([enc.encode("tournament"), enc.encode(TOURNAMENT_NAME)], PROGRAM_ID)[0];
}
export function playerPda(t: PublicKey, id: number): PublicKey {
  return PublicKey.findProgramAddressSync([enc.encode("player"), t.toBytes(), u32le(id)], PROGRAM_ID)[0];
}
export function profilePda(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([enc.encode("profile"), owner.toBytes()], PROGRAM_ID)[0];
}
export function cardPda(t: PublicKey, owner: PublicKey, id: number): PublicKey {
  return PublicKey.findProgramAddressSync([enc.encode("card"), t.toBytes(), owner.toBytes(), u32le(id)], PROGRAM_ID)[0];
}
export function friendLeaguePda(t: PublicKey, code: Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync([enc.encode("friend_league"), t.toBytes(), code], PROGRAM_ID)[0];
}
export function membershipPda(league: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([enc.encode("league_member"), league.toBytes(), owner.toBytes()], PROGRAM_ID)[0];
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
/** Generates a 6-character invite code (uppercase, no ambiguous characters). */
export function generateLeagueCode(): string {
  let c = "";
  for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}
/** 6-char code -> [u8; 6] bytes for the PDA seed / instruction argument. */
function codeBytes(code: string): Uint8Array {
  const bytes = enc.encode(code.toUpperCase().padEnd(6, "X").slice(0, 6));
  // Non-ASCII input encodes to more than one byte per character, which would
  // silently produce a wrong-length PDA seed. Require exactly 6 bytes.
  if (bytes.length !== 6) throw new Error("Invalid league code: must be 6 ASCII characters");
  return bytes;
}

/** Creates a private friend league; the creator becomes its first member. Returns the league pubkey. */
export async function createFriendLeague(
  program: Program<Worldxi>, owner: PublicKey, code: string, name: string
): Promise<{ signature: string; league: string; code: string }> {
  const t = tournamentPda();
  const cb = codeBytes(code);
  const league = friendLeaguePda(t, cb);
  const membership = membershipPda(league, owner);
  const signature = await program.methods
    .createFriendLeague(Array.from(cb), name)
    .accountsPartial({ tournament: t, league, membership, creator: owner, systemProgram: SystemProgram.programId })
    .rpc();
  return { signature, league: league.toBase58(), code: code.toUpperCase() };
}

/** Joins an existing friend league by its invite code. */
export async function joinFriendLeague(
  program: Program<Worldxi>, owner: PublicKey, code: string
): Promise<{ signature: string; league: string }> {
  const t = tournamentPda();
  const league = friendLeaguePda(t, codeBytes(code));
  const membership = membershipPda(league, owner);
  const signature = await program.methods
    .joinFriendLeague()
    .accountsPartial({ league, membership, owner, systemProgram: SystemProgram.programId })
    .rpc();
  return { signature, league: league.toBase58() };
}

/** On-chain "living card" performance mirror (PlayerCard account). */
export interface OnchainCard {
  playerId: number;
  rarity: string;
  matchesPlayed: number;
  totalPoints: number;
  mvpCount: number;
  bestSingleScore: number;
  mint: string;
}

/**
 * Creates on-chain PlayerCards (living cards) for the user's squad.
 * Until the cNFT (Bubblegum) mint is linked, the mint field is PublicKey.default. Cards
 * are sent in batches (tx size limit). Existing ones are skipped.
 */
export async function mintPlayerCards(program: Program<Worldxi>, owner: PublicKey, playerIds: number[]): Promise<number> {
  const t = tournamentPda();
  // Detect already existing cards (avoid recreating them).
  const pdas = playerIds.map((id) => cardPda(t, owner, id));
  const infos = await program.provider.connection.getMultipleAccountsInfo(pdas);
  const missing = playerIds.filter((_, i) => !infos[i]);

  let created = 0;
  for (let i = 0; i < missing.length; i += 4) {
    const batch = missing.slice(i, i + 4);
    const ixs = await Promise.all(
      batch.map((id) =>
        program.methods
          .createPlayerCard(id, PublicKey.default)
          // `card` is passed explicitly: Anchor cannot derive this PDA on its own here
          // (its seeds mix account keys with an instruction argument), and leaving it to
          // automatic resolution fails with "Reached maximum depth for account resolution".
          .accountsPartial({
            tournament: t,
            player: playerPda(t, id),
            card: cardPda(t, owner, id),
            owner,
            systemProgram: SystemProgram.programId,
          })
          .instruction()
      )
    );
    const tx = new Transaction().add(...ixs);
    await program.provider.sendAndConfirm!(tx);
    created += batch.length;
  }
  return created;
}

/** Reads the user's on-chain PlayerCards (living cards). */
export async function fetchMyCards(program: Program<Worldxi>, owner: PublicKey): Promise<OnchainCard[]> {
  const rows = await program.account.playerCard.all([
    { memcmp: { offset: 8 + 32, bytes: owner.toBase58() } }, // owner = after tournament(32)
  ]);
  return rows.map((r) => {
    const a = r.account as unknown as {
      playerId: number; rarity: Record<string, unknown>; matchesPlayed: number;
      totalPoints: { toNumber?: () => number } | number; mvpCount: number; bestSingleScore: number; mint: PublicKey;
    };
    const tp = typeof a.totalPoints === "number" ? a.totalPoints : (a.totalPoints.toNumber?.() ?? 0);
    return {
      playerId: a.playerId,
      rarity: Object.keys(a.rarity)[0] ?? "common",
      matchesPlayed: a.matchesPlayed,
      totalPoints: tp,
      mvpCount: a.mvpCount,
      bestSingleScore: a.bestSingleScore,
      mint: a.mint.toBase58(),
    };
  });
}

/** Picks the starting 11 based on the formation (1 GK + shape). */
export function pickStarters(picks: Player[], formation: string): number[] {
  const shape = FORMATIONS[formation] ?? FORMATIONS.F433;
  const by = (pos: string) => picks.filter((p) => p.position === pos).map((p) => p.playerId);
  return [
    ...by("GK").slice(0, 1),
    ...by("DEF").slice(0, shape.def),
    ...by("MID").slice(0, shape.mid),
    ...by("FWD").slice(0, shape.fwd),
  ];
}

/** Creates an onchain profile (first sign-in). */
export async function createProfile(program: Program<Worldxi>, owner: PublicKey, nickname: string, country?: string): Promise<string> {
  const cc = country ? Array.from(enc.encode(country)).slice(0, 3) : null;
  return program.methods
    .createProfile(nickname, cc as number[] | null)
    .accountsPartial({ owner, systemProgram: SystemProgram.programId })
    .rpc();
}

/**
 * Submits the onchain squad (submit_squad + 15 player remaining accounts). If the profile
 * does not exist yet, create_profile is prepended to the same transaction -> single signature.
 */
export async function submitSquad(
  program: Program<Worldxi>,
  owner: PublicKey,
  picks: Player[],
  starterIds: number[],
  formation: string,
  captainId: number,
  nickname?: string,
  country?: string
): Promise<string> {
  const t = tournamentPda();
  const players = picks.map((p) => p.playerId);
  const starters = starterIds;

  let builder = program.methods
    .submitSquad(players, starters, FORM_ANCHOR[formation] as never, captainId)
    .accountsPartial({ tournament: t, owner, systemProgram: SystemProgram.programId })
    .remainingAccounts(players.map((id) => ({ pubkey: playerPda(t, id), isSigner: false, isWritable: false })));

  // If no profile exists, create it in the same transaction (single wallet signature). Country is optional.
  if (nickname) {
    const cc = country ? Array.from(enc.encode(country)).slice(0, 3) : null;
    const profileIx = await program.methods
      .createProfile(nickname, cc as number[] | null)
      .accountsPartial({ owner, systemProgram: SystemProgram.programId })
      .instruction();
    builder = builder.preInstructions([profileIx]);
  }
  return builder.rpc();
}

export { BN };
