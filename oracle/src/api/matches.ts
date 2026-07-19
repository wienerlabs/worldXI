/**
 * Match hub API: World Cup fixture list + single match detail.
 * Data source is 100% real: TxLINE fixtures snapshot (which matches, time, teams)
 * + TxLINE scores snapshot (live score, minute, events, lineups). Points come from
 * our own state (calculated with ESPN+TxLINE). No mock.
 *
 * Endpoints:
 *   GET /matches?day=<epochDay>  -> that day's WC matches (summary: score/status/minute)
 *   GET /match/:fixtureId        -> single match detail (events, lineup, player points)
 */
import type { Request, Response } from "express";
import type { Config } from "../config.js";
import type { OracleState, StoredMatchEvent } from "../state.js";
import type { TxlineClient } from "../txline/client.js";
import type { TxFixture, TxScores, TxParticipantScore } from "../txline/types.js";
import { toIsoAlpha3 } from "../pipeline/countries.js";
import { discoverWorldCupFixtures } from "../pipeline/universe.js";
import { fetchEspnSummary, type EspnMatchEvent, type EspnStatus, type EspnSummary, type EspnTeamStats } from "../espn/matchEvents.js";
import { logger, errorMessage } from "../logger.js";

const WC_COMPETITION_ID = 72;
const DAY_MS = 86_400_000;
const MATCH_OVER_MS = 2.6 * 3_600_000; // consider finished ~2.6 hours after start
const CACHE_TTL_MS = 8_000;

export type MatchStatus = "scheduled" | "live" | "halftime" | "finished";

interface MatchTeam {
  iso: string | null;
  name: string;
  flag: string | null;
}
interface MatchScore {
  home: number;
  away: number;
}
export interface MatchSummary {
  fixtureId: number;
  competition: string;
  startTime: number;
  status: MatchStatus;
  minute: number | null;
  home: MatchTeam;
  away: MatchTeam;
  score: MatchScore | null;
}
export interface MatchEvent {
  type: "goal" | "own_goal" | "yellow_card" | "red_card" | "substitution" | "penalty" | "halftime";
  minute: number | null;
  team: "home" | "away" | null;
  playerId: number | null;
  playerInId: number | null;
  playerOutId: number | null;
  /** Name directly from ESPN (shown if present): scorer/carded/substituted-in. */
  primary: string | null;
  /** From ESPN: assist / substituted-out. */
  secondary: string | null;
  /** ESPN description text (e.g. "Goal! France 0, Spain 2..."). */
  text: string | null;
}
export interface MatchPlayerRating {
  playerId: number;
  name: string;
  team: "home" | "away" | null;
  position: string;
  rawPoints: number;
  wasMvp: boolean;
  photo: string;
}
export interface MatchDetail extends MatchSummary {
  events: MatchEvent[];
  lineups: Array<{ team: "home" | "away"; players: Array<{ playerId: number; name: string; number: string; starter: boolean }> }>;
  playerRatings: MatchPlayerRating[];
  /** Per-team match statistics (possession, shots, passes, ...) from the ESPN box score. */
  teamStats: EspnTeamStats | null;
}

/** A participant's total goals (from period-based Score). */
function totalGoals(p: TxParticipantScore | undefined): number {
  return p?.Total?.Goals ?? 0;
}

/** Derives match status/score/minute from fixture + (if present) live snapshot.
 *  Primary status source is TxLINE (StatusId); espnStatus is AUXILIARY confirmation (optional). */
function summarize(
  fx: TxFixture,
  snap: TxScores[] | null,
  now: number,
  countries: OracleState["countries"],
  espnStatus?: EspnStatus | null
): MatchSummary {
  const iso1 = toIsoAlpha3(fx.Participant1);
  const iso2 = toIsoAlpha3(fx.Participant2);
  const country = (iso: string | null): MatchTeam["flag"] =>
    iso ? countries.find((c) => c.isoCode === iso)?.flagEmoji ?? null : null;

  // Participant1IsHome: which participant is the home team.
  const p1Home = fx.Participant1IsHome !== false;
  const home: MatchTeam = p1Home
    ? { iso: iso1, name: fx.Participant1, flag: country(iso1) }
    : { iso: iso2, name: fx.Participant2, flag: country(iso2) };
  const away: MatchTeam = p1Home
    ? { iso: iso2, name: fx.Participant2, flag: country(iso2) }
    : { iso: iso1, name: fx.Participant1, flag: country(iso1) };

  const started = now >= fx.StartTime;
  let status: MatchStatus = started ? "live" : "scheduled";
  let minute: number | null = null;
  let score: MatchScore | null = null;

  if (started && snap && snap.length > 0) {
    // Finish: StatusId>=100 is a definite finish signal (observed feed) OR match
    // duration exceeded (no match lasts longer than 2.6 hours). anyRunning is ignored:
    // even a finished match's snapshot contains old live events (Running=true) - misleading.
    const maxStatusId = Math.max(0, ...snap.map((s) => s.StatusId ?? 0));
    // PRIMARY SOURCE TxLINE: StatusId 100=finish (2=1st half, 3=halftime, 4=2nd half). maxStatusId
    // is used - the "most recent event" (max Seq) fluctuates. AUXILIARY ESPN: if TxLINE sends the
    // finish/halftime signal late (observed: StatusId=100 arrived ~minutes later,
    // "stuck at 101") it is confirmed with ESPN completed/halftime. Decision favors TxLINE first.
    const txFinished = maxStatusId >= 100 || now - fx.StartTime > MATCH_OVER_MS;
    const finished = txFinished || espnStatus?.completed === true;
    const halftime = !finished && (maxStatusId === 3 || espnStatus?.halftime === true);
    // Minute: do not show at finish/halftime (avoid a frozen minute); while live, the highest match clock.
    const maxSecs = Math.max(0, ...snap.map((s) => s.Clock?.Seconds ?? 0));
    minute = finished || halftime ? null : maxSecs > 0 ? Math.floor(maxSecs / 60) : null;
    // Score: the most recent (highest Seq) event containing Score.Total.
    const scored = [...snap]
      .filter((s) => s.Score?.Participant1?.Total || s.Score?.Participant2?.Total)
      .sort((a, b) => Number(a.Seq ?? 0) - Number(b.Seq ?? 0))
      .pop();
    const g1 = totalGoals(scored?.Score?.Participant1);
    const g2 = totalGoals(scored?.Score?.Participant2);
    score = p1Home ? { home: g1, away: g2 } : { home: g2, away: g1 };
    status = finished ? "finished" : halftime ? "halftime" : "live";
  } else if (started && now - fx.StartTime > MATCH_OVER_MS) {
    status = "finished";
  }

  return { fixtureId: fx.FixtureId, competition: fx.Competition, startTime: fx.StartTime, status, minute, home, away, score };
}

/** Converts an accumulated (live) StoredMatchEvent into an API MatchEvent (participant->team). */
function storedToEvent(e: StoredMatchEvent, p1Home: boolean): MatchEvent {
  const team: MatchEvent["team"] =
    e.participant == null ? null : (e.participant === 1) === p1Home ? "home" : "away";
  return {
    type: e.type,
    minute: e.minute,
    team,
    playerId: e.playerId,
    playerInId: e.playerInId,
    playerOutId: e.playerOutId,
    primary: null,
    secondary: null,
    text: null,
  };
}

/** Converts an ESPN keyEvent into an API MatchEvent (name + description come directly). */
function espnToEvent(e: EspnMatchEvent): MatchEvent {
  return {
    type: e.type,
    minute: e.minute,
    team: e.team,
    playerId: e.playerId,
    playerInId: null,
    playerOutId: null,
    primary: e.primary,
    secondary: e.secondary,
    text: e.text,
  };
}

/** Extracts meaningful match events (goal/card/substitution) from snapshot events. */
function extractEvents(snap: TxScores[], p1Home: boolean): MatchEvent[] {
  const teamOf = (participant: number | undefined): MatchEvent["team"] => {
    if (participant === undefined) return null;
    const isP1 = participant === 1;
    return (isP1 && p1Home) || (!isP1 && !p1Home) ? "home" : "away";
  };
  const out: MatchEvent[] = [];
  const base = (minute: number | null, team: MatchEvent["team"]) => ({
    minute, team, playerId: null, playerInId: null, playerOutId: null, primary: null, secondary: null, text: null,
  });
  for (const s of snap) {
    const action = String(s.Action ?? s.Data?.Action ?? "");
    const n = s.Data?.New;
    const minute = s.Clock?.Seconds ? Math.floor(s.Clock.Seconds / 60) : null;
    const team = teamOf(s.Participant);
    if (action === "goal") {
      const own = n?.GoalType === "OwnGoal";
      out.push({ ...base(minute, team), type: own ? "own_goal" : "goal", playerId: n?.PlayerId ?? null });
    } else if (action === "yellow_card") {
      out.push({ ...base(minute, team), type: "yellow_card", playerId: n?.PlayerId ?? null });
    } else if (action === "red_card") {
      out.push({ ...base(minute, team), type: "red_card", playerId: n?.PlayerId ?? null });
    } else if (action === "substitution") {
      out.push({ ...base(minute, team), type: "substitution", playerInId: n?.PlayerInId ?? null, playerOutId: n?.PlayerOutId ?? null });
    } else if (action === "penalty") {
      out.push({ ...base(minute, team), type: "penalty", playerId: n?.PlayerId ?? null });
    }
  }
  return out.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

/** Short TTL cache to reduce load on TxLINE (fixtures + per-fixture snapshot). */
class TtlCache<T> {
  private readonly store = new Map<string, { data: T; ts: number }>();
  constructor(private readonly now: () => number, private readonly ttl = CACHE_TTL_MS) {}
  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (hit && this.now() - hit.ts < this.ttl) return hit.data;
    return undefined;
  }
  set(key: string, data: T): void {
    this.store.set(key, { data, ts: this.now() });
  }
}

export interface MatchesApi {
  listMatches: (req: Request, res: Response) => Promise<void>;
  matchDetail: (req: Request, res: Response) => Promise<void>;
  listDays: (req: Request, res: Response) => Promise<void>;
}

/** Sets up a match API with TxLINE access (if absent, endpoints return 503). */
export function createMatchesApi(cfg: Config, state: OracleState, txline: TxlineClient | null): MatchesApi {
  const now = (): number => Date.now();
  // Full tournament fixture list (rarely changes) - long TTL cache.
  const allCache = new TtlCache<TxFixture[]>(now, 5 * 60_000);
  const snapCache = new TtlCache<TxScores[]>(now);

  /** All tournament WC fixtures (discoverWorldCupFixtures: 0/30/60 day window). */
  const allFixtures = async (): Promise<TxFixture[]> => {
    const cached = allCache.get("all");
    if (cached) return cached;
    const list = await discoverWorldCupFixtures(txline!, cfg);
    allCache.set("all", list);
    return list;
  };

  const fixturesForDay = async (day: number): Promise<TxFixture[]> => {
    const all = await allFixtures();
    return all.filter((f) => Math.floor(f.StartTime / DAY_MS) === day);
  };

  const snapshotFor = async (fixtureId: number): Promise<TxScores[]> => {
    const key = `s${fixtureId}`;
    const cached = snapCache.get(key);
    if (cached) return cached;
    const snap = await txline!.getScoresSnapshot(fixtureId).catch(() => [] as TxScores[]);
    snapCache.set(key, snap);
    return snap;
  };

  // ESPN summary (events + status) - 20s cache. AUXILIARY source: event detail and
  // status confirmation if the TxLINE finish/halftime signal is delayed. Primary status source is TxLINE.
  const espnCache = new TtlCache<EspnSummary>(now, 20_000);
  const espnSummaryFor = async (espnEventId: number): Promise<EspnSummary> => {
    const key = `e${espnEventId}`;
    const cached = espnCache.get(key);
    if (cached) return cached;
    const summary = await fetchEspnSummary(String(espnEventId));
    espnCache.set(key, summary);
    return summary;
  };

  const listMatches = async (req: Request, res: Response): Promise<void> => {
    if (!txline) { res.status(503).json({ error: "live feed disabled (API-only mode)" }); return; }
    try {
      const day = req.query.day ? Number.parseInt(String(req.query.day), 10) : Math.floor(now() / DAY_MS);
      const fixtures = await fixturesForDay(day);
      const t = now();
      const summaries = await Promise.all(
        fixtures.map(async (fx) => {
          const started = t >= fx.StartTime;
          // Fetch live snapshot only for matches that have started (reduce load).
          const snap = started ? await snapshotFor(fx.FixtureId) : null;
          // ESPN status confirmation is AUXILIARY: only for matches started in the last ~5 hours
          // (live/recently-finished) - older matches are finished via overTime, future ones scheduled.
          const bridge = state.matchBridge.get(fx.FixtureId);
          const recent = started && t - fx.StartTime < 5 * 3_600_000;
          const espnStatus = recent && bridge ? (await espnSummaryFor(bridge.espnEventId)).status : undefined;
          return summarize(fx, snap, t, state.countries, espnStatus);
        })
      );
      summaries.sort((a, b) => a.startTime - b.startTime);
      res.json({ day, matches: summaries });
    } catch (error: unknown) {
      logger.error("match list error", { error: errorMessage(error) });
      res.status(500).json({ error: "could not fetch matches" });
    }
  };

  const matchDetail = async (req: Request, res: Response): Promise<void> => {
    if (!txline) { res.status(503).json({ error: "live feed disabled (API-only mode)" }); return; }
    try {
      const fixtureId = Number.parseInt(String(req.params.fixtureId ?? ""), 10);
      if (Number.isNaN(fixtureId)) { res.status(400).json({ error: "invalid fixtureId" }); return; }

      // Fixture meta: find from the full tournament list.
      const all = await allFixtures();
      const fx = all.find((f) => f.FixtureId === fixtureId);
      if (!fx) { res.status(404).json({ error: "match not found" }); return; }

      const snap = await snapshotFor(fixtureId);
      const p1Home = fx.Participant1IsHome !== false;
      // ESPN summary is AUXILIARY: event detail (name/assist) + status confirmation. Primary status is TxLINE.
      const bridge = state.matchBridge.get(fixtureId);
      const espn: EspnSummary = bridge ? await espnSummaryFor(bridge.espnEventId) : { events: [], status: null, teamStats: null };
      const summary = summarize(fx, snap, now(), state.countries, espn.status);
      // Full timeline priority order:
      //  1) ESPN keyEvents - with minute, names, including assist/sub-in-out (richest)
      //  2) events accumulated from live SSE (if ESPN is still empty, very new match)
      //  3) TxLINE snapshot summary (last resort)
      let events: MatchEvent[] = espn.events.length > 0 ? espn.events.map(espnToEvent) : [];
      if (events.length === 0) {
        const stored = state.matchEvents.get(fixtureId) ?? [];
        events = stored.length > 0 ? stored.map((e) => storedToEvent(e, p1Home)) : extractEvents(snap, p1Home);
      }

      // Lineup (Lineups from the last snapshot event, if present).
      const lineupEvent = [...snap].reverse().find((s) => (s.Lineups?.length ?? 0) > 0);
      const lineups: MatchDetail["lineups"] = (lineupEvent?.Lineups ?? []).map((lu, i) => ({
        team: (i === 0) === p1Home ? "home" : "away",
        players: (lu.lineups ?? []).map((pl) => ({
          playerId: pl.player.normativeId,
          name: pl.player.preferredName,
          number: pl.rosterNumber,
          starter: pl.starter,
        })),
      }));

      // Player ratings: our fantasy points (calculated with ESPN+TxLINE) + MVP.
      const playerRatings: MatchPlayerRating[] = state
        .matchPlayerResults(fixtureId)
        .map((r) => {
          const p = state.universe.get(r.playerId);
          const iso = p?.nationalTeam ?? null;
          const team: "home" | "away" | null =
            iso && iso === summary.home.iso ? "home" : iso && iso === summary.away.iso ? "away" : null;
          return {
            playerId: r.playerId,
            name: p?.name ?? String(r.playerId),
            team,
            position: p?.position ?? "",
            rawPoints: r.rawPoints,
            wasMvp: r.wasMvp,
            photo: p?.photo ?? "",
          };
        })
        .sort((a, b) => b.rawPoints - a.rawPoints);

      const detail: MatchDetail = { ...summary, events, lineups, playerRatings, teamStats: espn.teamStats };
      res.json(detail);
    } catch (error: unknown) {
      logger.error("match detail error", { error: errorMessage(error) });
      res.status(500).json({ error: "could not fetch match detail" });
    }
  };

  // List of days that have matches in the tournament (for the day picker) - each day + match count.
  const listDays = async (_req: Request, res: Response): Promise<void> => {
    if (!txline) { res.status(503).json({ error: "live feed disabled (API-only mode)" }); return; }
    try {
      const all = await allFixtures();
      const counts = new Map<number, number>();
      for (const f of all) {
        const d = Math.floor(f.StartTime / DAY_MS);
        counts.set(d, (counts.get(d) ?? 0) + 1);
      }
      const days = [...counts.entries()].map(([day, count]) => ({ day, count })).sort((a, b) => a.day - b.day);
      res.json({ days });
    } catch (error: unknown) {
      logger.error("day list error", { error: errorMessage(error) });
      res.status(500).json({ error: "could not fetch days" });
    }
  };

  return { listMatches, matchDetail, listDays };
}
