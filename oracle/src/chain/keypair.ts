/**
 * Loads Solana keypairs (JSON number[64]) from either an inline secret or a file path.
 *
 * Local development points at a Solana CLI keypair FILE. Managed hosts (Railway, Render,
 * Fly) have no such file and only allow environment variables, so the same setting may
 * instead carry the key array itself. Both forms are accepted.
 */
import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

export function loadKeypair(pathOrInlineJson: string): Keypair {
  const value = pathOrInlineJson.trim();
  // A value starting with "[" is the key array itself, not a path.
  const inline = value.startsWith("[");
  const raw = inline ? value : readFileSync(value, "utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Never echo the value itself: when inline it is a private key.
    throw new Error(inline ? "Invalid inline keypair JSON" : `Invalid keypair file: ${value}`);
  }

  if (!Array.isArray(parsed) || parsed.length !== 64) {
    throw new Error(
      inline
        ? "Invalid inline keypair (expected a 64 byte JSON array)"
        : `Invalid keypair file: ${value} (expected 64 bytes)`
    );
  }
  return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
}
