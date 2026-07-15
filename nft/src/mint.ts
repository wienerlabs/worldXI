/**
 * Compressed NFT (cNFT) minting with Metaplex Bubblegum - cheap player card issuance.
 *
 * Flow: create a merkle tree (for all cards), then on each player selection
 * mint that player's cNFT. The card's onchain performance history is also
 * kept in the PlayerCard account of the WorldXI program (create_player_card).
 */
import { readFileSync } from "node:fs";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  generateSigner,
  keypairIdentity,
  none,
  publicKey,
  type Umi,
  type PublicKey as UmiPublicKey,
} from "@metaplex-foundation/umi";
import { createTree, mintV1, mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import {
  displayName,
  metadataUri,
  type CardPerformance,
  type CardPlayer,
} from "./metadata.js";

/** Sets up umi with a Solana CLI keypair (JSON) + the Bubblegum plugin. */
export function makeUmi(rpcUrl: string, keypairPath: string): Umi {
  const umi = createUmi(rpcUrl).use(mplBubblegum());
  const secret = Uint8Array.from(JSON.parse(readFileSync(keypairPath, "utf-8")) as number[]);
  const kp = umi.eddsa.createKeypairFromSecretKey(secret);
  umi.use(keypairIdentity(kp));
  return umi;
}

/**
 * Creates a merkle tree for all player cards.
 * maxDepth=14 -> 2^14 = 16,384 card capacity (more than enough for 1170 players).
 */
export async function createMerkleTree(umi: Umi): Promise<UmiPublicKey> {
  const merkleTree = generateSigner(umi);
  await (
    await createTree(umi, { merkleTree, maxDepth: 14, maxBufferSize: 64 })
  ).sendAndConfirm(umi);
  return merkleTree.publicKey;
}

/**
 * Mints a player card (cNFT) to the given owner.
 * The NFT name is limited to 32 and the uri to 200 characters (Token Metadata) -> the uri
 * must be a short URL (NFT_METADATA_BASE). Returns: the leaf/asset transaction signature.
 */
export async function mintPlayerCard(
  umi: Umi,
  merkleTree: string,
  ownerPubkey: string,
  player: CardPlayer,
  perf: CardPerformance,
  metadataBase: string | undefined
): Promise<string> {
  const uri = metadataUri(player, perf, metadataBase);
  if (uri.length > 200) {
    throw new Error(
      "Metadata URI exceeds 200 characters - set NFT_METADATA_BASE (a short URL) (a data URI cannot be used)."
    );
  }
  const name = `${displayName(player.name)} #${player.jerseyNumber}`.slice(0, 32);
  const result = await mintV1(umi, {
    leafOwner: publicKey(ownerPubkey),
    merkleTree: publicKey(merkleTree),
    metadata: {
      name,
      uri,
      sellerFeeBasisPoints: 500, // 5% secondary market commission (revenue model)
      collection: none(),
      creators: [{ address: umi.identity.publicKey, verified: false, share: 100 }],
    },
  }).sendAndConfirm(umi);
  return Buffer.from(result.signature).toString("base64");
}
