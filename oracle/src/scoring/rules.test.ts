import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBreakdown, applyMvp, POINTS } from "./rules.js";
import type { MatchPlayerStat, Position } from "../domain.js";

function stat(overrides: Partial<MatchPlayerStat> & { position: Position }): MatchPlayerStat {
  return {
    playerId: 1,
    appeared: true,
    minutesPlayed: 90,
    goals: 0,
    ownGoals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    penaltiesSaved: 0,
    teamConcededGoals: 1,
    ...overrides,
  };
}

test("FWD: 2 goals + 90 min = appearance(1) + 60min(1) + 2*4 = 10", () => {
  const b = computeBreakdown(stat({ position: "FWD", goals: 2 }));
  assert.equal(b.total, 10);
  assert.equal(b.goals, 8);
});

test("GK: clean sheet + 90 min = 1 + 1 + 4 = 6", () => {
  const b = computeBreakdown(stat({ position: "GK", teamConcededGoals: 0 }));
  assert.equal(b.cleanSheet, POINTS.cleanSheet);
  assert.equal(b.total, 6);
});

test("DEF: clean sheet but <60 min -> no clean sheet", () => {
  const b = computeBreakdown(stat({ position: "DEF", teamConcededGoals: 0, minutesPlayed: 45 }));
  assert.equal(b.cleanSheet, 0);
  assert.equal(b.minutes60, 0);
  assert.equal(b.total, 1); // appearance only
});

test("MID: goal(5) + assist(3) + yellow(-1) = 1 + 1 + 5 + 3 - 1 = 9", () => {
  const b = computeBreakdown(stat({ position: "MID", goals: 1, assists: 1, yellowCards: 1 }));
  assert.equal(b.total, 9);
});

test("red card -3, own goal -2", () => {
  const b = computeBreakdown(stat({ position: "DEF", redCards: 1, ownGoals: 1 }));
  // 1(app) + 1(60) + (-3) + (-2) = -3
  assert.equal(b.total, -3);
});

test("GK penalty save +5", () => {
  const b = computeBreakdown(stat({ position: "GK", penaltiesSaved: 1, teamConcededGoals: 2 }));
  assert.equal(b.penaltySave, 5);
  assert.equal(b.total, 7); // 1 + 1 + 5
});

test("applyMvp does not mutate and adds +3", () => {
  const b = computeBreakdown(stat({ position: "FWD", goals: 1 }));
  const withMvp = applyMvp(b);
  assert.equal(b.mvp, 0, "original must not change");
  assert.equal(withMvp.mvp, 3);
  assert.equal(withMvp.total, b.total + 3);
});

test("live match: the 60-minute bonus counts live, the clean sheet waits for full time", () => {
  const s = stat({ position: "DEF", teamConcededGoals: 0, minutesPlayed: 90 });
  const live = computeBreakdown(s, false);
  assert.equal(live.minutes60, POINTS.minutes60); // 60 min is unrevocable -> live
  assert.equal(live.cleanSheet, 0); // clean sheet is revocable -> withheld
  assert.equal(live.total, POINTS.appearance + POINTS.minutes60);

  // Once the match is over, the clean sheet is added too.
  const full = computeBreakdown(s, true);
  assert.equal(full.total, POINTS.appearance + POINTS.minutes60 + POINTS.cleanSheet);
});

test("live match: a starter under 60 minutes does not get the minutes bonus yet", () => {
  const b = computeBreakdown(stat({ position: "MID", minutesPlayed: 55, teamConcededGoals: 1 }), false);
  assert.equal(b.minutes60, 0);
  assert.equal(b.total, POINTS.appearance);
});

test("live match: a goal still counts immediately", () => {
  // 30 minutes so the 60-minute bonus is not involved: the goal is what adds the points.
  const b = computeBreakdown(stat({ position: "FWD", goals: 1, minutesPlayed: 30, teamConcededGoals: 1 }), false);
  assert.equal(b.total, POINTS.appearance + POINTS.goalFwd);
});
