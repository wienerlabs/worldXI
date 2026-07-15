/**
 * Produces the tournament history: scores each played match with its matchday and
 * returns MatchdayPlayerResult[]. Shared by loadHistory (in-memory leaderboard) and
 * backfill (onchain commit).
 *
 * The scoring truth comes from the ESPN box score. If `txline` is provided, the
 * goal/card events extracted from the TxLINE snapshot for each match also
 * contribute to scoring (TxLINE-core: events provided by TxLINE count toward the
 * score, with ESPN filling the gaps).
 */
import type { MatchdayPlayerResult, PlayerUniverseEntry } from "../domain.js";
import { logger } from "../logger.js";
import { fetchEspnSchedule, tournamentStartDay, matchdayOf } from "./schedule.js";
import { fetchBoxScore } from "./boxscore.js";
import { scoreEspnMatch } from "../scoring/espnScorer.js";
import type { TxlineClient } from "../txline/client.js";
import { extractTxlineEvents } from "../txline/events.js";
import { bridgeFixtures } from "./bridge.js";
import { discoverWorldCupFixtures } from "../pipeline/universe.js";
import { loadConfig } from "../config.js";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface MatchdayResults {
  matchday: number;
  fixtureId: number;
  results: MatchdayPlayerResult[];
}

/** Scores all played WC matches with the ESPN box score (+ optional TxLINE events). */
export async function loadEspnHistory(
  universe: Map<number, PlayerUniverseEntry>,
  txline?: TxlineClient
): Promise<MatchdayResults[]> {
  const fixtures = await fetchEspnSchedule();
  const startDay = tournamentStartDay(fixtures);
  const completed = fixtures.filter((f) => f.completed).sort((a, b) => a.dateMs - b.dateMs);

  // Optional TxLINE bridge: espnEventId -> TxLINE FixtureId
  const txByEvent = new Map<string, number>();
  if (txline) {
    try {
      const txFixtures = await discoverWorldCupFixtures(txline, loadConfig());
      for (const b of await bridgeFixtures(txFixtures)) txByEvent.set(b.espnEventId, b.txFixtureId);
      logger.info("TxLINE event bridge ready", { bridged: txByEvent.size });
    } catch (e) {
      logger.warn("TxLINE bridge could not be built, continuing ESPN-only", { error: String(e).slice(0, 100) });
    }
  }

  const out: MatchdayResults[] = [];
  let txScored = 0;
  for (const fx of completed) {
    const box = await fetchBoxScore(fx.eventId);
    await sleep(100);
    if (!box) continue;

    // TxLINE events (if any) -> include in scoring
    let txEvents;
    const txFid = txByEvent.get(fx.eventId);
    if (txline && txFid !== undefined) {
      const snap = await txline.getScoresSnapshot(txFid).catch(() => []);
      if (snap.length > 0) {
        txEvents = extractTxlineEvents(snap, universe);
        if (txEvents.size > 0) txScored += 1;
      }
    }

    const fixtureId = Number.parseInt(fx.eventId, 10);
    const results = scoreEspnMatch(fixtureId, box, universe, txEvents);
    if (results.length > 0) out.push({ matchday: matchdayOf(fx, startDay), fixtureId, results });
  }
  logger.info("Tournament history prepared", {
    matches: out.length,
    playerResults: out.reduce((n, m) => n + m.results.length, 0),
    txlineScoredMatches: txScored,
  });
  return out;
}
