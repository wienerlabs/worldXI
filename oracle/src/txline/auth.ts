/**
 * TxLINE authentication flow (mirrors the OpenAPI v1.5.2 quickstart exactly):
 *
 *  1) POST /auth/guest/start  -> guest JWT (valid for 30 days)
 *  2) The wallet signs the `${txSig}:${leagues.join(",")}:${jwt}` message (detached, base64)
 *  3) POST /api/token/activate (txSig + walletSignature + leagues, Bearer JWT) -> API token
 *  4) Data requests: Authorization: Bearer <jwt> + X-Api-Token: <apiToken>
 *
 * Two modes are supported:
 *  - Manual: ready-made tokens provided via TXLINE_JWT + TXLINE_API_TOKEN env.
 *  - Automatic: guest/start + activate (requires the TXLINE_SUBSCRIBE_TXSIG on-chain subscribe signature).
 *
 * NOTE: the on-chain `subscribe` transaction (to TxLINE's own Solana program) is done separately;
 * its signature is provided as TXLINE_SUBSCRIBE_TXSIG (see scripts/txline-subscribe.ts).
 */
import nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";
import type { Config } from "../config.js";
import { logger } from "../logger.js";
import type { TxGuestStartResponse, TxActivateResponse } from "./types.js";

export interface TxlineCredentials {
  jwt: string;
  apiToken: string;
}

async function postJson<T>(url: string, body: unknown, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TxLINE POST ${url} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

/** POST /auth/guest/start -> guest JWT. */
export async function startGuestSession(cfg: Config): Promise<string> {
  const url = `${cfg.TXLINE_BASE_URL}/auth/guest/start`;
  const data = await postJson<TxGuestStartResponse>(url, {}, {});
  logger.info("TxLINE guest session obtained");
  return data.token;
}

/**
 * Signs the activation message with the wallet's secret key (detached, base64).
 * Message binding: `${txSig}:${leagues.join(",")}:${jwt}`.
 */
export function signActivationMessage(
  wallet: Keypair,
  txSig: string,
  leagues: number[],
  jwt: string
): string {
  const message = `${txSig}:${leagues.join(",")}:${jwt}`;
  const signature = nacl.sign.detached(new TextEncoder().encode(message), wallet.secretKey);
  return Buffer.from(signature).toString("base64");
}

/** POST /api/token/activate -> API token. */
export async function activateToken(
  cfg: Config,
  jwt: string,
  txSig: string,
  walletSignature: string,
  leagues: number[]
): Promise<string> {
  const url = `${cfg.TXLINE_BASE_URL}/api/token/activate`;
  const data = await postJson<TxActivateResponse>(
    url,
    { txSig, walletSignature, leagues },
    { Authorization: `Bearer ${jwt}` }
  );
  logger.info("TxLINE API token activated");
  return data.token;
}

/**
 * Produces usable credentials based on the configuration.
 * Priority: ready-made env tokens -> otherwise guest/start + activate.
 */
export async function resolveCredentials(cfg: Config, wallet: Keypair): Promise<TxlineCredentials> {
  if (cfg.TXLINE_JWT && cfg.TXLINE_API_TOKEN) {
    logger.info("Using TxLINE credentials from env (manual mode)");
    return { jwt: cfg.TXLINE_JWT, apiToken: cfg.TXLINE_API_TOKEN };
  }

  const jwt = cfg.TXLINE_JWT ?? (await startGuestSession(cfg));

  // If there is no subscribe txSig: try with the guest JWT only (the free WC tier
  // may be accessible with a guest). If data endpoints return 403, activation is required.
  if (!cfg.TXLINE_SUBSCRIBE_TXSIG) {
    logger.warn(
      "TXLINE_API_TOKEN and TXLINE_SUBSCRIBE_TXSIG missing - trying with guest JWT only"
    );
    return { jwt, apiToken: "" };
  }

  const walletSignature = signActivationMessage(
    wallet,
    cfg.TXLINE_SUBSCRIBE_TXSIG,
    cfg.TXLINE_LEAGUES,
    jwt
  );
  const apiToken = await activateToken(
    cfg,
    jwt,
    cfg.TXLINE_SUBSCRIBE_TXSIG,
    walletSignature,
    cfg.TXLINE_LEAGUES
  );
  return { jwt, apiToken };
}
