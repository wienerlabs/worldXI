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
import type { GoalEvent, OracleState, StoredMatchEvent } from "./state.js";
import type { TxFixture, TxScores } from "./txline/types.js";
import { discoverWorldCupFixtures } from "./pipeline/universe.js";
import { toIsoAlpha3 } from "./pipeline/countries.js";
import { bridgeFixtures, type BridgedFixture } from "./espn/bridge.js";
import { fetchBoxScore } from "./espn/boxscore.js";
import { fetchEspnSummary, type EspnSummary } from "./espn/matchEvents.js";
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
  private readonly fxById = new Map<number, TxFixture>();
  private readonly dirty = new Set<number>();
  private readonly espnCache = new Map<string, { data: EspnSummary; ts: number }>();
  /** Fixture -> finished, filled in while scoring so finalization does not refetch. */
  private readonly fixtureFinished = new Map<number, boolean>();
  /** Matchday currently locked on chain, so the lock tx is not resent every cycle. */
  private lockedMatchday: number | null = null;
  /** Matchdays already unlocked and settled in this process. */
  private readonly finalizedMatchdays = new Set<number>();

  constructor(
    private readonly cfg: Config,
    private readonly state: OracleState,
    private readonly txline: TxlineClient,
    private readonly committer: Committer,
    private readonly onUpdate?: () => void,
    private readonly onGoal?: (goal: GoalEvent) => void
  ) {}

  async init(): Promise<void> {
    // TxLINE CORE: which matches are in the tournament (fixtures discovered from TxLINE).
    const txFixtures = await discoverWorldCupFixtures(this.txline, this.cfg);
    for (const f of txFixtures) this.fxById.set(f.FixtureId, f);
    // Bridge each TxLINE fixture to an ESPN event (scoring truth from ESPN).
    this.bridged = await bridgeFixtures(txFixtures);
    for (const b of this.bridged) {
      this.byTxId.set(b.txFixtureId, b);
      // TxLINE->ESPN+matchday bridge for player fantasy points in match detail.
      this.state.matchBridge.set(b.txFixtureId, { espnEventId: Number.parseInt(b.espnEventId, 10), matchday: b.matchday });
    }
    logger.info("Orchestrator ready", { txFixtures: txFixtures.length, bridged: this.bridged.length });
  }

  /** ESPN summary (keyEvents + status) with a short cache to avoid hammering ESPN. */
  private async espnSummaryFor(espnEventId: string): Promise<EspnSummary> {
    const now = Date.now();
    const hit = this.espnCache.get(espnEventId);
    if (hit && now - hit.ts < 15_000) return hit.data;
    const data = await fetchEspnSummary(espnEventId);
    this.espnCache.set(espnEventId, { data, ts: now });
    return data;
  }

  /** Resolves an ESPN scorer to our universe playerId: first by ESPN athlete id (== our id),
   *  then by name (exact, else last-name). Returns null if no confident match. */
  private resolvePlayer(espnId: number | null, name: string | null): number | null {
    if (espnId != null && this.state.universe.has(espnId)) return espnId;
    if (!name) return null;
    const norm = (s: string): string =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
    const target = norm(name);
    if (!target) return null;
    const targetLast = target.split(" ").pop() as string;
    // Exact full-name match wins. The last-name fallback is accepted ONLY when it is
    // unambiguous across the whole universe (exactly one player has that surname);
    // a shared surname (Silva, Nunez, Gomez) would otherwise mis-attribute the goal.
    const lastMatches: number[] = [];
    for (const [id, p] of this.state.universe) {
      const pn = norm(p.name);
      if (pn === target) return id;
      if (pn.split(" ").pop() === targetLast) lastMatches.push(id);
    }
    return lastMatches.length === 1 ? lastMatches[0] ?? null : null;
  }

  /** Builds goal celebration events for a fixture and broadcasts only the new ones
   *  (deduplicated by id). TxLINE is the trigger (its snapshot change re-processes the
   *  fixture); ESPN keyEvents are the auxiliary detail for WHO scored (scorer + minute).
   *  The scorer's national team decides which side scored, so the running score and the
   *  red number are always correct. Own goals credit the opponent. */
  private async emitGoals(fixtureId: number): Promise<void> {
    const fx = this.fxById.get(fixtureId);
    const b = this.byTxId.get(fixtureId);
    if (!fx || !b) return;
    const summary = await this.espnSummaryFor(b.espnEventId);
    const goals = summary.events.filter((e) => e.type === "goal" || e.type === "own_goal" || e.type === "penalty");
    if (goals.length === 0) return;

    const iso1 = toIsoAlpha3(fx.Participant1);
    const iso2 = toIsoAlpha3(fx.Participant2);
    const flagOf = (iso: string | null): string | null =>
      iso ? this.state.countries.find((c) => c.isoCode === iso)?.flagEmoji ?? null : null;
    const p1Home = fx.Participant1IsHome !== false;
    const home = p1Home
      ? { iso: iso1, name: fx.Participant1, flag: flagOf(iso1) }
      : { iso: iso2, name: fx.Participant2, flag: flagOf(iso2) };
    const away = p1Home
      ? { iso: iso2, name: fx.Participant2, flag: flagOf(iso2) }
      : { iso: iso1, name: fx.Participant1, flag: flagOf(iso1) };

    let h = 0;
    let a = 0;
    goals.forEach((ev, i) => {
      const own = ev.type === "own_goal";
      const playerId = this.resolvePlayer(ev.playerId, ev.primary);
      const scorerIso = playerId != null ? this.state.universe.get(playerId)?.nationalTeam ?? null : null;
      // The player's own side (whose shirt the scorer wears). Prefer national team; fall back to ESPN.
      const playerTeam: "home" | "away" | null = scorerIso
        ? scorerIso === home.iso ? "home" : scorerIso === away.iso ? "away" : null
        : ev.team;
      // The side whose score goes up (and whose number flashes red). Own goal -> the opponent.
      const scoringTeam: "home" | "away" | null = own
        ? playerTeam === "home" ? "away" : playerTeam === "away" ? "home" : ev.team
        : playerTeam;
      if (scoringTeam === "home") h += 1;
      else if (scoringTeam === "away") a += 1;
      const goal: GoalEvent = {
        id: `${fixtureId}:${ev.type}:${ev.minute ?? i}:${ev.team ?? "x"}:${ev.primary ?? i}`,
        fixtureId,
        playerId,
        scorerPoints: playerId != null ? this.state.playerLivePoints(playerId) : 0,
        minute: ev.minute,
        scorerTeam: scoringTeam,
        ownGoal: own,
        home,
        away,
        score: { home: h, away: a },
        ts: Date.now(),
      };
      if (this.state.recordGoal(goal)) this.onGoal?.(goal);
    });
  }

  /** Starts the live stream. Default = LIVE mode: wait for real matches on the TxLINE SSE
   *  and score/commit/celebrate them as they happen. Set ORCHESTRATOR_REPLAY=true to first
   *  replay finished matches (demo: leaderboard + goal celebrations move as if live). */
  async runLive(signal: AbortSignal): Promise<void> {
    if (process.env.ORCHESTRATOR_REPLAY === "true") {
      await this.replay(signal);
    } else {
      logger.info("Live mode - waiting for real matches (set ORCHESTRATOR_REPLAY=true to simulate)");
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
      await this.committer.setMatchday(md, true).catch((e) => logger.warn("setMatchday(lock) failed", { error: errorMessage(e) }));
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
          logger.warn("commit batch failed", { matchday: md, error: errorMessage(e) });
        }
        await sleep(COMMIT_THROTTLE_MS);
      }

      await this.committer
        .setMatchday(md, false)
        .catch((e) => logger.warn("setMatchday(unlock) failed", { matchday: md, error: errorMessage(e) }));
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
        // A matchday in play locks squads on chain, so nobody can change a line-up mid-match.
        await this.lockMatchday(b.matchday);
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
            logger.warn("live commit batch failed", { matchday: b.matchday, error: errorMessage(e) });
          }
          await sleep(COMMIT_THROTTLE_MS);
        }
        // Refresh the API after each fixture (leaderboard moves live without waiting for on-chain).
        this.onUpdate?.();
        // Once every fixture of this matchday is over, unlock it and write the final totals.
        await this.finalizeMatchdayIfDone(b.matchday);
      } catch (error: unknown) {
        logger.error("could not process fixture", { fixtureId, error: errorMessage(error) });
      }
    }
  }

  /** Locks the matchday on chain once (lineups frozen while it is being played). */
  private async lockMatchday(matchday: number): Promise<void> {
    if (this.lockedMatchday === matchday || this.finalizedMatchdays.has(matchday)) return;
    try {
      await this.committer.setMatchday(matchday, true);
      this.lockedMatchday = matchday;
    } catch (error: unknown) {
      logger.warn("setMatchday(lock) failed", { matchday, error: errorMessage(error) });
    }
  }

  /**
   * When every fixture of a matchday has finished, unlocks it and settles all squads, so the
   * live provisional score becomes a final, verifiable total on chain. Runs at most once per
   * matchday per process; the per-matchday snapshot account makes a repeat harmless anyway.
   */
  private async finalizeMatchdayIfDone(matchday: number): Promise<void> {
    if (this.finalizedMatchdays.has(matchday)) return;
    const fixtures = this.bridged.filter((b) => b.matchday === matchday);
    if (fixtures.length === 0) return;
    if (!fixtures.every((f) => this.fixtureFinished.get(f.txFixtureId) === true)) return;

    this.finalizedMatchdays.add(matchday);
    logger.info("matchday finished, finalizing on chain", { matchday, fixtures: fixtures.length });
    try {
      // Settle requires the tournament to be unlocked, so this has to come first.
      await this.committer.setMatchday(matchday, false);
      this.lockedMatchday = null;
      await this.committer.settleMatchday(matchday, this.state.universe);
      this.onUpdate?.();
    } catch (error: unknown) {
      // Allow a later cycle to retry rather than leaving the matchday half finalized.
      this.finalizedMatchdays.delete(matchday);
      logger.error("matchday finalization failed", { matchday, error: errorMessage(error) });
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

    // Match clock and completion drive per-player minutes and gate the full-time bonuses.
    // TxLINE is the primary clock/finish signal; ESPN confirms the finish when TxLINE is late.
    const summary = await this.espnSummaryFor(b.espnEventId);
    const maxStatusId = Math.max(0, ...snap.map((x) => x.StatusId ?? 0));
    const maxSecs = Math.max(0, ...snap.map((x) => x.Clock?.Seconds ?? 0));
    // ESPN gets a veto on finish. TxLINE's StatusId can flip to "finished" (>=100) during
    // extra time while the match is still being played; trusting it alone would settle the
    // matchday on chain too early. If ESPN still reports the match as "in", it is not over.
    const espnSaysLive = summary.status?.state === "in";
    const finished = !espnSaysLive && (maxStatusId >= 100 || summary.status?.completed === true);
    this.fixtureFinished.set(txFixtureId, finished);
    const elapsedMinutes = finished ? Math.max(90, Math.floor(maxSecs / 60)) : Math.floor(maxSecs / 60);
    const subs = summary.events
      .filter((e) => e.type === "substitution")
      .map((e) => ({ inId: e.playerId, outId: e.secondaryPlayerId, minute: e.minute }));

    const results = scoreEspnMatch(Number.parseInt(b.espnEventId, 10), box, this.state.universe, txEvents, {
      elapsedMinutes,
      finished,
      subs,
    });
    for (const r of results) this.state.upsertResult(matchday, r);
    // Goal celebration feed AFTER scores are upserted, so the scorer's points are current.
    await this.emitGoals(txFixtureId);
    return results;
  }
}
