/**
 * TxLINE subscription + API token activation (free World Cup tier).
 *
 * Ports TxLINE's official tx-on-chain flow:
 *  1) guest JWT (POST /auth/guest/start)
 *  2) Token-2022 user ATA (create if missing)
 *  3) subscribe(serviceLevelId, weeks) - free tier 0 token, registration only
 *  4) POST /api/token/activate - signed message `${txSig}:${leagues}:${jwt}`
 *
 * The network is chosen from TXLINE_BASE_URL (dev -> devnet program/mint, otherwise mainnet).
 * Output: JWT + API token; write these to oracle/.env (TXLINE_JWT, TXLINE_API_TOKEN).
 *
 * Usage: npm run txline:subscribe
 */
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { loadConfig } from "../config.js";
import { logger, errorMessage } from "../logger.js";
import { loadKeypair } from "../chain/keypair.js";
import txoracleIdl from "../txline/idl/txoracle.json" with { type: "json" };
import type { Txoracle } from "../txline/idl/txoracle.js";

// TxLINE network constants (tx-on-chain official addresses)
const NETWORKS = {
  devnet: {
    programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
    tokenMint: "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",
  },
  mainnet: {
    programId: "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA",
    tokenMint: "Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL",
  },
} as const;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const cfg = loadConfig();
  const walletPath = cfg.TXLINE_WALLET_KEYPAIR ?? cfg.ORACLE_KEYPAIR;
  if (!walletPath) throw new Error("TXLINE_WALLET_KEYPAIR or ORACLE_KEYPAIR is required");
  const wallet = loadKeypair(walletPath);

  const net = cfg.TXLINE_BASE_URL.includes("dev") ? NETWORKS.devnet : NETWORKS.mainnet;
  const tokenMint = new PublicKey(net.tokenMint);
  const weeks = 4;
  const serviceLevelId = cfg.TXLINE_SERVICE_LEVEL;
  const leagues = cfg.TXLINE_LEAGUES;

  // Subscribe on-chain runs on the Solana network of the selected TxLINE network:
  // devnet -> RPC_URL (devnet), mainnet -> mainnet RPC (WorldXI stays on devnet).
  const isDevnet = net === NETWORKS.devnet;
  const rpc = isDevnet
    ? cfg.RPC_URL
    : (process.env.TXLINE_MAINNET_RPC ?? "https://api.mainnet-beta.solana.com");
  const connection = new Connection(rpc, "confirmed");
  logger.info("subscribe RPC", { rpc });
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: "confirmed" });
  // The IDL address in the repo is mainnet; override it with the selected network's program id.
  const idl = { ...(txoracleIdl as Txoracle), address: net.programId };
  const program = new Program<Txoracle>(idl, provider);
  logger.info("TxLINE subscribe", {
    base: cfg.TXLINE_BASE_URL,
    program: program.programId.toBase58(),
    serviceLevelId,
    weeks,
  });

  // 1) Guest JWT
  const jwtRes = await fetch(`${cfg.TXLINE_BASE_URL}/auth/guest/start`, { method: "POST" });
  const jwt = ((await jwtRes.json()) as { token: string }).token;
  logger.info("Guest JWT received");

  // 2) Token-2022 user ATA
  const userAta = getAssociatedTokenAddressSync(
    tokenMint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const ataInfo = await connection.getAccountInfo(userAta);
  if (!ataInfo) {
    logger.info("Creating Token-2022 ATA");
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userAta,
        wallet.publicKey,
        tokenMint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet], {
      commitment: "confirmed",
    });
    await sleep(3000);
  }
  // Wait for ATA synchronization
  for (let i = 0; i < 5; i++) {
    try {
      await getAccount(connection, userAta, "confirmed", TOKEN_2022_PROGRAM_ID);
      break;
    } catch {
      await sleep(2000);
    }
  }

  // 3) subscribe
  const [pricingMatrix] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    tokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  logger.info("sending subscribe");
  const txSig = await program.methods
    .subscribe(serviceLevelId, weeks)
    .accountsPartial({
      user: wallet.publicKey,
      pricingMatrix,
      tokenMint,
      userTokenAccount: userAta,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  logger.info("subscribe confirmed", { txSig });

  // 4) activate
  const messageString = `${txSig}:${leagues.join(",")}:${jwt}`;
  const signature = nacl.sign.detached(new TextEncoder().encode(messageString), wallet.secretKey);
  const walletSignature = Buffer.from(signature).toString("base64");

  const actRes = await fetch(`${cfg.TXLINE_BASE_URL}/api/token/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ txSig, walletSignature, leagues }),
  });
  if (!actRes.ok) {
    throw new Error(`activate failed: ${actRes.status} ${await actRes.text()}`);
  }
  // The response may be a plain-text token or {token} JSON.
  const actText = await actRes.text();
  let apiToken: string;
  try {
    const parsed = JSON.parse(actText) as { token?: string } | string;
    apiToken = typeof parsed === "string" ? parsed : (parsed.token ?? actText);
  } catch {
    apiToken = actText.replace(/^"|"$/g, "").trim();
  }

  logger.info("API token received");
  // Clear output for the user to paste into .env
  process.stdout.write(
    `\n=== write to oracle/.env ===\nTXLINE_JWT=${jwt}\nTXLINE_API_TOKEN=${apiToken}\n=========================\n`
  );
}

main().catch((error: unknown) => {
  logger.error("txline:subscribe failed", { error: errorMessage(error) });
  process.exitCode = 1;
});
