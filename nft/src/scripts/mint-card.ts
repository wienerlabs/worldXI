/**
 * Mints a player card (cNFT). The player is found in players.json by playerId;
 * the owner is --owner (or the mint authority if not provided).
 *
 * Usage: npm run mint -- --player <playerId> [--owner <pubkey>]
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeUmi, mintPlayerCard } from "../mint.js";
import type { CardPlayer } from "../metadata.js";

interface PlayerRow extends CardPlayer {
  priceTier: string;
  priceSol: number;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const rpc = process.env.RPC_URL ?? "https://api.devnet.solana.com";
  const keypair = process.env.NFT_KEYPAIR;
  const tree = process.env.MERKLE_TREE;
  const base = process.env.NFT_METADATA_BASE;
  if (!keypair) throw new Error("NFT_KEYPAIR required");
  if (!tree) throw new Error("MERKLE_TREE required (run npm run create-tree first)");

  const playerId = Number.parseInt(arg("--player") ?? "", 10);
  if (!Number.isFinite(playerId)) throw new Error("--player <playerId> required");

  const players = JSON.parse(
    readFileSync(resolve(process.cwd(), "..", "data", "players.json"), "utf-8")
  ) as PlayerRow[];
  const player = players.find((p) => p.playerId === playerId);
  if (!player) throw new Error(`Player not found: ${playerId}`);

  const umi = makeUmi(rpc, keypair);
  const owner = arg("--owner") ?? umi.identity.publicKey.toString();
  const sig = await mintPlayerCard(
    umi,
    tree,
    owner,
    player,
    { matchesPlayed: 0, totalPoints: 0, mvpCount: 0, bestSingleScore: 0 },
    base
  );
  process.stdout.write(`Card minted: ${player.name} (${player.nationalTeam}) -> ${owner}\nsig=${sig}\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`mint failed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
