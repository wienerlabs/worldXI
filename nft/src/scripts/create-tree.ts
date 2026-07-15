/**
 * Creates a merkle tree for all player cards. Write the output tree address
 * to the MERKLE_TREE field in .env.
 *
 * Usage: npm run create-tree
 */
import "dotenv/config";
import { makeUmi, createMerkleTree } from "../mint.js";

async function main(): Promise<void> {
  const rpc = process.env.RPC_URL ?? "https://api.devnet.solana.com";
  const keypair = process.env.NFT_KEYPAIR;
  if (!keypair) throw new Error("NFT_KEYPAIR required");

  const umi = makeUmi(rpc, keypair);
  process.stderr.write("Creating merkle tree...\n");
  const tree = await createMerkleTree(umi);
  process.stdout.write(`\nMERKLE_TREE=${tree.toString()}\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`create-tree failed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
