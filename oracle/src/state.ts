/**
 * The oracle's shared in-memory state. The orchestrator writes, the leaderboard API
 * reads. The persistent truth (final totals) lives on chain; the live state here is a
 * derived view for fast leaderboard/provisional calculations during a match.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Country, MatchdayPlayerResult, PlayerUniverseEntry } from "./domain.js";

/** A single match event accumulated from the live SSE (for the match detail timeline). */
export interface StoredMatchEvent {
  seq: number;
  type: "goal" | "own_goal" | "yellow_card" | "red_card" | "substitution" | "penalty";
  minute: number | null;
  participant: number | null; // TxLINE Participant (1 or 2)
  playerId: number | null;
  playerInId: number | null;
  playerOutId: number | null;
}

export class OracleState {
  readonly universe = new Map<number, PlayerUniverseEntry>();
  countries: Country[] = [];
  /** playerId -> live tournament total raw points. */
  readonly playerTotals = new Map<number, number>();
  /** matchday -> (playerId -> result for that matchday). */
  readonly matchdayResults = new Map<number, Map<number, MatchdayPlayerResult>>();
  /** The currently live (ongoing) matchday. */
  activeMatchday = 0;
  /** TxLINE fixtureId -> ESPN event + matchday (for player points in the match detail). */
  readonly matchBridge = new Map<number, { espnEventId: number; matchday: number }>();
  /** TxLINE fixtureId -> events accumulated from the live SSE (full timeline). Since TxLINE
   *  does not provide a historical timeline for finished matches, only live-watched matches fill this. */
  readonly matchEvents = new Map<number, StoredMatchEvent[]>();

  /** Adds a live SSE event to the match timeline (deduplicated by seq). */
  recordMatchEvent(txFixtureId: number, ev: StoredMatchEvent): void {
    let list = this.matchEvents.get(txFixtureId);
    if (!list) { list = []; this.matchEvents.set(txFixtureId, list); }
    if (list.some((e) => e.seq === ev.seq && e.type === ev.type)) return; // already present
    list.push(ev);
    list.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || a.seq - b.seq);
  }

  /** Returns the player results (fantasy points + MVP) of a TxLINE match. */
  matchPlayerResults(txFixtureId: number): MatchdayPlayerResult[] {
    const bridge = this.matchBridge.get(txFixtureId);
    if (!bridge) return [];
    const md = this.matchdayResults.get(bridge.matchday);
    if (!md) return [];
    return [...md.values()].filter((r) => r.fixtureId === bridge.espnEventId);
  }

  loadDataset(dataDir: string): void {
    const players = JSON.parse(
      readFileSync(resolve(dataDir, "players.json"), "utf-8")
    ) as PlayerUniverseEntry[];
    for (const p of players) this.universe.set(p.playerId, p);
    this.countries = JSON.parse(
      readFileSync(resolve(dataDir, "countries.json"), "utf-8")
    ) as Country[];
  }

  /** Records a matchday result and recomputes the player's tournament total. */
  upsertResult(matchday: number, result: MatchdayPlayerResult): void {
    let md = this.matchdayResults.get(matchday);
    if (!md) {
      md = new Map();
      this.matchdayResults.set(matchday, md);
    }
    md.set(result.playerId, result);
    // Total = this player's results across all matchdays
    let total = 0;
    for (const m of this.matchdayResults.values()) {
      const r = m.get(result.playerId);
      if (r) total += r.rawPoints;
    }
    this.playerTotals.set(result.playerId, total);
  }

  /** Returns all of a player's matchday results in chronological order. */
  playerHistory(playerId: number): Array<{ matchday: number; result: MatchdayPlayerResult }> {
    const out: Array<{ matchday: number; result: MatchdayPlayerResult }> = [];
    for (const [md, m] of this.matchdayResults) {
      const r = m.get(playerId);
      if (r) out.push({ matchday: md, result: r });
    }
    return out.sort((a, b) => a.matchday - b.matchday);
  }

  /**
   * Player leaderboard: the ENTIRE universe (48x26) sorted by points. Players who
   * have not played a match yet (0 points) are also listed - so the user can see the
   * whole roster.
   */
  playerLeaderboard(): Array<{ playerId: number; totalPoints: number; rank: number }> {
    const rows = [...this.universe.keys()]
      .map((playerId) => ({ playerId, totalPoints: this.playerTotals.get(playerId) ?? 0 }))
      .sort((a, b) => b.totalPoints - a.totalPoints || a.playerId - b.playerId);
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  /** A player's live raw points (for the provisional user score). */
  playerLivePoints(playerId: number): number {
    return this.playerTotals.get(playerId) ?? 0;
  }

  /** The latest (highest) settled matchday number. */
  latestMatchday(): number {
    let max = 0;
    for (const md of this.matchdayResults.keys()) if (md > max) max = md;
    return max;
  }

  /** A player's raw points in a specific matchday (for the daily leaderboard). */
  playerMatchdayPoints(matchday: number, playerId: number): number {
    return this.matchdayResults.get(matchday)?.get(playerId)?.rawPoints ?? 0;
  }
}
