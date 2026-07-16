/**
 * Admin wallets. Connected wallets in this list unlock elevated UI controls
 * (e.g. a custom budget override on the Build page). This is a client-side
 * convenience gate only — on-chain rules (submit_squad budget validation) are
 * unchanged and still enforced by the program.
 */
export const ADMIN_WALLETS: readonly string[] = [
  "7imsPo1owz6arqjqHpHvEfNgTepXnm9vtjmHQoVWmABX",
];

/** True when the given wallet public key is an admin wallet. */
export function isAdminWallet(pubkey?: { toBase58(): string } | null): boolean {
  if (!pubkey) return false;
  return ADMIN_WALLETS.includes(pubkey.toBase58());
}
