/**
 * ESPN box score -> fantasy MatchdayPlayerResult[]. Scoring is based 100% on real
 * ESPN data and the MASTER CONTEXT rules (rules.ts); player matching is done by
 * ESPN athlete id (no name matching -> every goal counts, Mbappe included).
 *
 * Minutes: ESPN reports no minutes field, so they are derived from the match clock and the
 * substitution events. A starter is on from kick-off until they are taken off (or until the
 * current minute), a substitute from the minute they came on. This matters live: assuming a
 * full 90 minutes from the first whistle handed every starter the 60-minute bonus and every
 * defender a clean sheet before anything had actually happened.
 */
import type { MatchPlayerStat, MatchdayPlayerResult, PlayerUniverseEntry } from "../domain.js";
import type { EspnPlayerStat } from "../espn/boxscore.js";
import type { TxlineExtra } from "../txline/events.js";
import { applyMvp, computeBreakdown } from "./rules.js";

/** Full-time duration used when a finished match reports no clock. */
const FULL_MATCH_MINUTES = 90;
/** Fallback for a substitute whose entry minute is unknown. */
const SUB_FALLBACK_MINUTES = 30;

export interface MatchContext {
  /** Minutes played so far; for a finished match, the full duration. */
  elapsedMinutes: number;
  /** True once the match is over. Duration-based bonuses only count then. */
  finished: boolean;
  /** Substitutions, used to derive per-player minutes. */
  subs?: Array<{ inId: number | null; outId: number | null; minute: number | null }>;
}

/** Minutes a player was actually on the pitch, from the clock plus substitutions. */
function minutesOnPitch(box: EspnPlayerStat, ctx: MatchContext): number {
  const end = Math.max(0, Math.round(ctx.elapsedMinutes));
  const offAt = ctx.subs?.find((s) => s.outId === box.playerId)?.minute ?? null;

  if (box.starter) return offAt != null ? Math.max(0, Math.min(offAt, end)) : end;

  if (box.subIn) {
    const onAt = ctx.subs?.find((s) => s.inId === box.playerId)?.minute ?? null;
    if (onAt == null) return Math.min(SUB_FALLBACK_MINUTES, end);
    const leftAt = offAt != null ? Math.min(offAt, end) : end;
    return Math.max(0, leftAt - onAt);
  }
  return 0;
}

/**
 * Merges a match's box score (id -> stat) with the universe and produces player
 * results. Players not in the universe (outside the roster) are skipped.
 *
 * If `txEvents` is provided (goals/cards reported by TxLINE), scoring also uses the
 * TxLINE event data: each counter = max(ESPN, TxLINE). If TxLINE reported an event,
 * it is included in the score (filling in when ESPN is missing it); otherwise ESPN
 * is used. This way TxLINE is genuinely used in scoring - not just a trigger.
 */
export function scoreEspnMatch(
  fixtureId: number,
  boxScore: Map<number, EspnPlayerStat>,
  universe: Map<number, PlayerUniverseEntry>,
  txEvents?: Map<number, TxlineExtra>,
  // Historic scoring (backfill, dataset build) omits this: those matches are over.
  context: MatchContext = { elapsedMinutes: FULL_MATCH_MINUTES, finished: true }
): MatchdayPlayerResult[] {
  const results: MatchdayPlayerResult[] = [];
  for (const box of boxScore.values()) {
    if (!box.appeared) continue;
    const entry = universe.get(box.playerId);
    if (!entry) continue;
    const minutesPlayed = minutesOnPitch(box, context);

    // If there is a TxLINE event, max(ESPN, TxLINE): the event TxLINE reported is added to the score.
    const tx = txEvents?.get(box.playerId);
    const goals = tx ? Math.max(box.goals, tx.goals) : box.goals;
    const ownGoals = tx ? Math.max(box.ownGoals, tx.ownGoals) : box.ownGoals;
    const yellowCards = tx ? Math.max(box.yellowCards, tx.yellow) : box.yellowCards;
    const redCards = tx ? Math.max(box.redCards, tx.red) : box.redCards;

    const stat: MatchPlayerStat = {
      playerId: box.playerId,
      position: entry.position,
      appeared: true,
      minutesPlayed,
      goals,
      ownGoals,
      assists: box.assists,
      yellowCards,
      redCards,
      penaltiesSaved: 0, // ESPN reports regular saves; penalty saves are not separated out
      teamConcededGoals: box.teamConcededGoals,
    };
    const breakdown = computeBreakdown(stat, context.finished);
    results.push({ playerId: box.playerId, fixtureId, rawPoints: breakdown.total, wasMvp: false, breakdown, stat });
  }

  // MVP: the highest raw-scoring player who has a real goal/assist contribution in the match.
  const hasContribution = results.some((r) => r.stat.goals > 0 || r.stat.assists > 0);
  if (hasContribution) {
    const sorted = [...results].sort((a, b) => {
      if (b.rawPoints !== a.rawPoints) return b.rawPoints - a.rawPoints;
      if (b.stat.goals !== a.stat.goals) return b.stat.goals - a.stat.goals;
      return a.playerId - b.playerId;
    });
    const mvp = sorted[0];
    if (mvp && mvp.rawPoints > 0) {
      mvp.wasMvp = true;
      mvp.breakdown = applyMvp(mvp.breakdown);
      mvp.rawPoints = mvp.breakdown.total;
    }
  }
  return results;
}
