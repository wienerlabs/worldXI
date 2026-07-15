/**
 * Loads Solana CLI keypair files (JSON number[64]).
 */
import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

export function loadKeypair(path: string): Keypair {
  const raw = readFileSync(path, "utf-8");
  const bytes = JSON.parse(raw) as number[];
  if (!Array.isArray(bytes) || bytes.length !== 64) {
    throw new Error(`Invalid keypair file: ${path} (expected 64 bytes)`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}
