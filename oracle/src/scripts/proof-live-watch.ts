/**
 * LIVE PROOF: samples the France-Spain match (FixtureId 18237038) at fixed intervals
 * and shows the change. Watches two sources side by side:
 *   1) TxLINE raw live snapshot (source feed): event count, match time, score, Seq
 *   2) The system's /live/matchday output (the points we process)
 * As the match progresses live the values increase -> proof that "we pull and show live data".
 *
 * Usage: npx tsx src/scripts/proof-live-watch.ts [sampleCount] [intervalSec]
 */
import { loadConfig } from "../config.js";
import { loadKeypair } from "../chain/keypair.js";
import { TxlineClient } from "../txline/client.js";
import { errorMessage } from "../logger.js";

const API = "http://localhost:8787";
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function goals(score: unknown, side: "Participant1" | "Participant2"): number {
  const s = score as Record<string, Record<string, Record<string, number>>> | undefined;
  return s?.[side]?.Total?.Goals ?? 0;
}
function yellows(score: unknown, side: "Participant1" | "Participant2"): number {
  const s = score as Record<string, Record<string, Record<string, number>>> | undefined;
  return s?.[side]?.Total?.YellowCards ?? 0;
}

async function main(): Promise<void> {
  const FID = Number.parseInt(process.argv[2] ?? "18237038", 10);
  const samples = Number.parseInt(process.argv[3] ?? "7", 10);
  const gapSec = Number.parseInt(process.argv[4] ?? "20", 10);

  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR required");
  const wallet = loadKeypair(cfg.TXLINE_WALLET_KEYPAIR ?? cfg.ORACLE_KEYPAIR);
  const tx = new TxlineClient(cfg, wallet);
  await tx.init();

  console.log("t(sec) | TxLINE: event  match_min  FRA-ESP  yellow(F/E)  lastSeq | System: activeMD  playerCount");
  console.log("------|-----------------------------------------------------|------------------------------");

  const first: { events?: number; seq?: number } = {};
  for (let i = 0; i < samples; i++) {
    const t = i * gapSec;
    let line = `${String(t).padStart(4)}s | `;
    try {
      const snap = (await tx.getScoresSnapshot(FID)) as unknown as Record<string, unknown>[];
      const sorted = [...snap].sort((a, b) => Number(a.Seq ?? 0) - Number(b.Seq ?? 0));
      const last = sorted[sorted.length - 1] as Record<string, unknown> | undefined;
      const clock = (last?.Clock as Record<string, number> | undefined)?.Seconds ?? 0;
      const mac_dk = Math.floor(clock / 60);
      const g1 = goals(last?.Score, "Participant1");
      const g2 = goals(last?.Score, "Participant2");
      const y1 = yellows(last?.Score, "Participant1");
      const y2 = yellows(last?.Score, "Participant2");
      const seq = Number(last?.Seq ?? 0);
      if (first.events === undefined) { first.events = snap.length; first.seq = seq; }
      line += `event=${String(snap.length).padStart(3)}  ${String(mac_dk).padStart(2)}min  ${g1}-${g2}  ${y1}/${y2}  Seq=${seq} | `;
    } catch (e) {
      line += `TxLINE error: ${errorMessage(e)} | `;
    }
    try {
      const live = (await fetch(`${API}/live/matchday`).then((r) => r.json())) as { matchday?: number; players?: unknown[] };
      line += `md=${live.matchday ?? "-"}  player=${live.players?.length ?? 0}`;
    } catch {
      line += `system: unreachable`;
    }
    console.log(line);
    if (i < samples - 1) await sleep(gapSec * 1000);
  }

  console.log("\nPROOF: if match_min and Seq/event are increasing, live data is coming from TxLINE.");
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error("proof error:", errorMessage(e));
  process.exit(1);
});
