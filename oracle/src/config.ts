/**
 * Configuration from environment variables; validated with zod, failing fast at
 * startup if anything is missing/invalid. Secrets are never hardcoded in source.
 */
import "dotenv/config";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const intList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => Number.parseInt(s, 10))
  );

const schema = z.object({
  RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  PROGRAM_ID: z.string().min(32),
  TOURNAMENT_NAME: z.string().min(1).max(32),
  ORACLE_KEYPAIR: z.string().optional(),

  TXLINE_BASE_URL: z.string().url().default("https://txline.txodds.com"),
  TXLINE_COMPETITION_ID: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? Number.parseInt(v, 10) : undefined)),
  TXLINE_LEAGUES: intList,
  TXLINE_JWT: z.string().optional(),
  TXLINE_API_TOKEN: z.string().optional(),
  TXLINE_SUBSCRIBE_TXSIG: z.string().optional(),
  TXLINE_WALLET_KEYPAIR: z.string().optional(),
  TXLINE_SERVICE_LEVEL: z
    .string()
    .default("1")
    .transform((v) => Number.parseInt(v, 10)),

  API_PORT: z
    .string()
    .default("8787")
    .transform((v) => Number.parseInt(v, 10)),
});

export type Config = z.infer<typeof schema> & { programId: PublicKey };

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${issues}`);
  }
  cached = { ...parsed.data, programId: new PublicKey(parsed.data.PROGRAM_ID) };
  return cached;
}
