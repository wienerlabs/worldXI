/**
 * Matchday Orchestrator - live onchain settlement (the project's main originality move).
 *
 * Architecture: TxLINE remains the hackathon's mandatory CORE feed (which matches,
 * when, live score stream); the scoring truth comes from the ESPN box score (id-based,
 * rich). Each TxLINE fixture is bound to an ESPN event via `bridgeFixtures`.
 *
 * Two modes:
 *  1) REPLAY (demo): played matches are replayed live during their matchday
 *     - each matchday lock -> score -> commit -> WS broadcast -> unlock.
 *     The leaderboard moves live as if during a match (simulates the experience even
 *     if the jury cannot see a live match - a hackathon demo requirement).
 *  2) LIVE SSE: TxLINE event stream during a real match; on each event the relevant fixture
 *     is re-scored from the ESPN box score and committed instantly.
 *
 * At matchday start tournament.locked=true (lineup lock), at end locked=false +
 * ready for final settle. commit_score is idempotent (committer cache) -> on a rerun
 * the same values are not re-sent.
 */
import type { Config } from "./config.js";
import { logger, errorMessage } from "./logger.js";
import type { TxlineClient } from "./txline/client.js";
import type { Committer } from "./chain/committer.js";
import type { OracleState, StoredMatchEvent } from "./state.js";
import type { TxScores } from "./txline/types.js";
import { discoverWorldCupFixtures } from "./pipeline/universe.js";
import { bridgeFixtures, type BridgedFixture } from "./espn/bridge.js";
import { fetchBoxScore } from "./espn/boxscore.js";
import { scoreEspnMatch } from "./scoring/espnScorer.js";
import { extractTxlineEvents } from "./txline/events.js";

const PROCESS_INTERVAL_MS = 3_000;
const REPLAY_STEP_MS = 800; // wait between matchdays (live-movement feel)
const COMMIT_BATCH = 5;
const COMMIT_THROTTLE_MS = 400;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class Orchestrator {
  private bridged: BridgedFixture[] = [];
  private readonly byTxId = new Map<number, BridgedFixture>();
  private readonly dirty = new Set<number>();

  constructor(
    private readonly cfg: Config,
    private readonly state: OracleState,
    private readonly txline: TxlineClient,
    private readonly committer: Committer,
    private readonly onUpdate?: () => void
  ) {}

  async init(): Promise<void> {
    // TxLINE CORE: which matches are in the tournament (fixtures discovered from TxLINE).
    const txFixtures = await discoverWorldCupFixtures(this.txline, this.cfg);
    // Bridge each TxLINE fixture to an ESPN event (scoring truth from ESPN).
    this.bridged = await bridgeFixtures(txFixtures);
    for (const b of this.bridged) {
      this.byTxId.set(b.txFixtureId, b);
      // TxLINE->ESPN+matchday bridge for player fantasy points in match detail.
      this.state.matchBridge.set(b.txFixtureId, { espnEventId: Number.parseInt(b.espnEventId, 10), matchday: b.matchday });
    }
    logger.info("Orchestrator ready", { txFixtures: txFixtures.length, bridged: this.bridged.length });
  }

  /** Starts the live stream: first replay (demo), then real-time TxLINE SSE.
   *  ORCHESTRATOR_SKIP_REPLAY=true -> replay is skipped, live SSE is listened to directly
   *  (for a real match day; no need to replay history). */
  async runLive(signal: AbortSignal): Promise<void> {
    if (process.env.ORCHESTRATOR_SKIP_REPLAY !== "true") {
      await this.replay(signal);
    } else {
      logger.info("Replay skipped (ORCHESTRATOR_SKIP_REPLAY) - direct live stream");
    }
    if (signal.aborted) return;

    // Real match: listen to the TxLINE live event stream -> score with ESPN box score.
    const timer = setInterval(() => void this.processDirty(), PROCESS_INTERVAL_MS);
    signal.addEventListener("abort", () => clearInterval(timer));
    logger.info("Listening to live TxLINE stream (real match events)");
    try {
      await this.txline.streamScores((event) => {
        const fid = event.FixtureId ?? event.fixtureId;
        if (fid !== undefined && this.byTxId.has(fid)) {
          this.dirty.add(fid);
          this.recordSseEvent(fid, event); // accumulate live event for the full timeline
        }
      }, signal);
    } catch (error: unknown) {
      logger.warn("TxLINE SSE ended", { error: errorMessage(error) });
    }
    clearInterval(timer);
  }

  /** Replays played matches live during their matchday (demo). */
  private async replay(signal: AbortSignal): Promise<void> {
    const byMd = new Map<number, BridgedFixture[]>();
    for (const b of this.bridged) {
      const arr = byMd.get(b.matchday) ?? [];
      arr.push(b);
      byMd.set(b.matchday, arr);
    }
    const matchdays = [...byMd.keys()].sort((a, b) => a - b);
    logger.info("Replay starting", { matchdays: matchdays.length });

    for (const md of matchdays) {
      if (signal.aborted) return;
      await this.committer.setMatchday(md, true).catch((e) => logger.debug("setMatchday(lock)", { error: errorMessage(e) }));
      this.state.activeMatchday = md;

      const commits: Array<{ matchday: number; playerId: number; rawPoints: number; wasMvp: boolean }> = [];
      for (const b of byMd.get(md) ?? []) {
        const results = await this.processFixture(b.txFixtureId, md);
        for (const r of results) commits.push({ matchday: md, playerId: r.playerId, rawPoints: r.rawPoints, wasMvp: r.wasMvp });
      }
      this.onUpdate?.(); // WS broadcast - leaderboard moves live

      // On-chain live settle (idempotent; passes fast via cache after backfill).
      for (let i = 0; i < commits.length; i += COMMIT_BATCH) {
        try {
          await this.committer.commitScoreBatch(commits.slice(i, i + COMMIT_BATCH));
        } catch (e: unknown) {
          logger.debug("commit batch skipped", { error: errorMessage(e) });
        }
        await sleep(COMMIT_THROTTLE_MS);
      }

      await this.committer.setMatchday(md, false).catch(() => undefined);
      logger.info("matchday replay done", { matchday: md, players: commits.length });
      await sleep(REPLAY_STEP_MS);
    }
    this.state.activeMatchday = 0;
    logger.info("Replay completed");
  }

  /** Converts a live SSE event into a meaningful match event and writes it to the state timeline. */
  private recordSseEvent(fid: number, event: TxScores): void {
    const action = String(event.Action ?? event.Data?.Action ?? "");
    const TYPES: Record<string, StoredMatchEvent["type"]> = {
      goal: "goal",
      yellow_card: "yellow_card",
      red_card: "red_card",
      substitution: "substitution",
      penalty: "penalty",
    };
    const n = event.Data?.New;
    let type: StoredMatchEvent["type"] | undefined = TYPES[action];
    if (action === "goal" && n?.GoalType === "OwnGoal") type = "own_goal";
    if (!type) return;
    this.state.recordMatchEvent(fid, {
      seq: Number(event.Seq ?? 0),
      type,
      minute: event.Clock?.Seconds ? Math.floor(event.Clock.Seconds / 60) : null,
      participant: event.Participant ?? null,
      playerId: n?.PlayerId ?? null,
      playerInId: n?.PlayerInId ?? null,
      playerOutId: n?.PlayerOutId ?? null,
    });
  }

  private async processDirty(): Promise<void> {
    const ids = [...this.dirty];
    this.dirty.clear();
    for (const fixtureId of ids) {
      const b = this.byTxId.get(fixtureId);
      if (!b) continue;
      try {
        this.state.activeMatchday = b.matchday;
        const results = await this.processFixture(fixtureId, b.matchday);
        // RPC-friendly: batch + throttle instead of one-by-one. Thanks to the cache, after
        // the first round only CHANGED player points are sent (public RPC load drops).
        const commits = results.map((r) => ({
          matchday: b.matchday,
          playerId: r.playerId,
          rawPoints: r.rawPoints,
          wasMvp: r.wasMvp,
        }));
        for (let i = 0; i < commits.length; i += COMMIT_BATCH) {
          try {
            await this.committer.commitScoreBatch(commits.slice(i, i + COMMIT_BATCH));
          } catch (e: unknown) {
            logger.debug("live commit batch skipped", { error: errorMessage(e) });
          }
          await sleep(COMMIT_THROTTLE_MS);
        }
        // Refresh the API after each fixture (leaderboard moves live without waiting for on-chain).
        this.onUpdate?.();
      } catch (error: unknown) {
        logger.error("could not process fixture", { fixtureId, error: errorMessage(error) });
      }
    }
  }

  /** Scores a TxLINE fixture: ESPN box score + TxLINE live goal/card events
   *  (from the TxLINE snapshot). The event TxLINE provides contributes to the points. */
  private async processFixture(txFixtureId: number, matchday: number): Promise<ReturnType<typeof scoreEspnMatch>> {
    const b = this.byTxId.get(txFixtureId);
    if (!b) return [];
    const box = await fetchBoxScore(b.espnEventId);
    if (!box) return [];
    // TxLINE live event data (goal/card) - factor the core feed into scoring.
    const snap = await this.txline.getScoresSnapshot(txFixtureId).catch(() => []);
    const txEvents = snap.length > 0 ? extractTxlineEvents(snap, this.state.universe) : undefined;
    const results = scoreEspnMatch(Number.parseInt(b.espnEventId, 10), box, this.state.universe, txEvents);
    for (const r of results) this.state.upsertResult(matchday, r);
    return results;
  }
}
