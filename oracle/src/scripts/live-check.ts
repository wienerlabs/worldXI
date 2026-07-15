/**
 * Live match diagnostics: lists matches on neighboring days and the live/ongoing
 * ones from the TxLINE fixtures snapshot. Answers "is there a match being played
 * right now?" from the REAL feed (no mock). Also searches for team matchups like France/Spain.
 *
 * Usage: npx tsx src/scripts/live-check.ts
 */
import { loadConfig } from "../config.js";
import { loadKeypair } from "../chain/keypair.js";
import { TxlineClient } from "../txline/client.js";
import { errorMessage } from "../logger.js";

const DAY_MS = 86_400_000;

/** Heuristically infers whether a fixture is live from its status/minute fields. */
function isLive(f: Record<string, unknown>): boolean {
  const s = JSON.stringify(f).toLowerCase();
  return /"(status|state|phase)"\s*:\s*"?(live|in.?play|1h|2h|first|second|ht|half|playing)/.test(s)
    || /"(minute|elapsed|clock)"\s*:\s*"?\d/.test(s);
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ORACLE_KEYPAIR) throw new Error("ORACLE_KEYPAIR required");
  const wallet = loadKeypair(cfg.TXLINE_WALLET_KEYPAIR ?? cfg.ORACLE_KEYPAIR);
  const tx = new TxlineClient(cfg, wallet);
  await tx.init();

  const now = Date.now();
  const today = Math.floor(now / DAY_MS);
  console.log(`NOW: ${new Date(now).toISOString()} (epochDay ${today})`);

  // Collect World Cup matches (CompetitionId 72) across neighboring days.
  const wc: Record<string, unknown>[] = [];
  for (const d of [today - 1, today, today + 1]) {
    try {
      const fx = (await tx.getFixtures(d)) as unknown as Record<string, unknown>[];
      for (const f of fx) if (f.CompetitionId === 72) wc.push(f);
    } catch (e) {
      console.log(`epochDay ${d}: ERROR ${errorMessage(e)}`);
    }
  }

  console.log(`\n=== World Cup matches (${wc.length}) - GameState + start ===`);
  for (const f of wc) {
    const start = Number(f.StartTime);
    const started = now >= start;
    const startsIn = Math.round((start - now) / 60000);
    console.log(
      `GameState=${f.GameState} | ${f.Participant1} vs ${f.Participant2} | ` +
      `start=${new Date(start).toISOString()} | ${started ? "STARTED" : `in ${startsIn} min`} | id=${f.FixtureId}`
    );
  }

  // France-Spain live score snapshot (is there real live data?).
  const fraEsp = wc.find((f) => /fran/i.test(String(f.Participant1)) && /spa|espa/i.test(String(f.Participant2)));
  if (fraEsp) {
    const id = Number(fraEsp.FixtureId);
    console.log(`\n=== France-Spain (id ${id}) LIVE SCORE SNAPSHOT ===`);
    const snap = await tx.getScoresSnapshot(id).catch((e) => { console.log("snapshot error:", errorMessage(e)); return []; });
    console.log(`snapshot event count: ${snap.length}`);
    console.log(JSON.stringify(snap).slice(0, 900));
  } else {
    console.log("\nFrance-Spain not found (name match).");
  }
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error("live-check error:", errorMessage(e));
  process.exit(1);
});
