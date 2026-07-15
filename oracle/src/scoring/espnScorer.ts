/**
 * ESPN box score -> fantasy MatchdayPlayerResult[]. Scoring is based 100% on real
 * ESPN data and the MASTER CONTEXT rules (rules.ts); player matching is done by
 * ESPN athlete id (no name matching -> every goal counts, Mbappe included).
 *
 * Minutes: ESPN does not provide exact minutes; starting XI = 90 min (60+ bonus +
 * clean sheet eligibility), substitute on = 30 min (appearance only). starter/subIn
 * are real.
 */
import type { MatchPlayerStat, MatchdayPlayerResult, PlayerUniverseEntry } from "../domain.js";
import type { EspnPlayerStat } from "../espn/boxscore.js";
import type { TxlineExtra } from "../txline/events.js";
import { applyMvp, computeBreakdown } from "./rules.js";

const STARTER_MINUTES = 90;
const SUB_MINUTES = 30;

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
  txEvents?: Map<number, TxlineExtra>
): MatchdayPlayerResult[] {
  const results: MatchdayPlayerResult[] = [];
  for (const box of boxScore.values()) {
    if (!box.appeared) continue;
    const entry = universe.get(box.playerId);
    if (!entry) continue;
    const minutesPlayed = box.starter ? STARTER_MINUTES : box.subIn ? SUB_MINUTES : 0;

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
    const breakdown = computeBreakdown(stat);
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
