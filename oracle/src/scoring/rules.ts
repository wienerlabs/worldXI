/**
 * Fantasy scoring rules (MASTER CONTEXT). ONLY raw points are produced; the rarity
 * bonus and captain multiplier are applied ONCHAIN (settle_squad_matchday).
 *
 * Source mapping (rule #1 - all real):
 *  - appearance, minutes, goal, own goal, yellow/red, clean sheet, assist -> ESPN box score
 *  - goals/cards are also fed from the TxLINE live event stream (see txline/events.ts,
 *    espnScorer max logic); TxLINE is the core hackathon feed.
 *  - penalty save -> 0 because it is not broken out in the data source (never fabricated).
 *  - MVP -> derived per match from the highest raw-scoring player.
 */
import type { MatchPlayerStat, Position, ScoreBreakdown } from "../domain.js";

export const POINTS = {
  appearance: 1,
  minutes60: 1,
  goalGk: 6,
  goalDef: 6,
  goalMid: 5,
  goalFwd: 4,
  assist: 3,
  mvp: 3,
  cleanSheet: 4,
  penaltySave: 5,
  yellowCard: -1,
  redCard: -3,
  ownGoal: -2,
} as const;

/** Minimum minutes played required for a clean sheet (standard fantasy rule). */
const CLEAN_SHEET_MIN_MINUTES = 60;
const MINUTES_BONUS_THRESHOLD = 60;

function goalPoints(position: Position): number {
  switch (position) {
    case "GK":
      return POINTS.goalGk;
    case "DEF":
      return POINTS.goalDef;
    case "MID":
      return POINTS.goalMid;
    case "FWD":
      return POINTS.goalFwd;
  }
}

/**
 * Computes the raw point breakdown excluding MVP. The MVP is determined at the match
 * level and added via `applyMvp`.
 */
/**
 * `finished` gates the two bonuses that only become true at full time. While a match is
 * running, minutes played and a clean sheet are not settled yet: a starter can be
 * substituted at 20 minutes, and a defence that has not conceded in the 5th minute has
 * earned nothing. Awarding them early inflated every starter and, worse, made scores go
 * DOWN when a goal was later conceded. Historic scoring passes finished = true.
 */
export function computeBreakdown(stat: MatchPlayerStat, finished = true): ScoreBreakdown {
  const appearance = stat.appeared ? POINTS.appearance : 0;
  const minutes60 = finished && stat.minutesPlayed >= MINUTES_BONUS_THRESHOLD ? POINTS.minutes60 : 0;
  const goals = stat.goals * goalPoints(stat.position);
  const assists = stat.assists * POINTS.assist;
  const isDefensive = stat.position === "GK" || stat.position === "DEF";
  const cleanSheet =
    finished && isDefensive && stat.teamConcededGoals === 0 && stat.minutesPlayed >= CLEAN_SHEET_MIN_MINUTES
      ? POINTS.cleanSheet
      : 0;
  const penaltySave = stat.penaltiesSaved * POINTS.penaltySave;
  const yellowCard = stat.yellowCards * POINTS.yellowCard;
  const redCard = stat.redCards * POINTS.redCard;
  const ownGoal = stat.ownGoals * POINTS.ownGoal;

  const total =
    appearance +
    minutes60 +
    goals +
    assists +
    cleanSheet +
    penaltySave +
    yellowCard +
    redCard +
    ownGoal;

  return {
    appearance,
    minutes60,
    goals,
    assists,
    cleanSheet,
    penaltySave,
    yellowCard,
    redCard,
    ownGoal,
    mvp: 0,
    total,
  };
}

/** Adds the MVP points to the breakdown (returns a new object - no mutation). */
export function applyMvp(breakdown: ScoreBreakdown): ScoreBreakdown {
  return {
    ...breakdown,
    mvp: POINTS.mvp,
    total: breakdown.total + POINTS.mvp,
  };
}
