import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreEspnMatch } from "./espnScorer.js";
import type { EspnPlayerStat } from "../espn/boxscore.js";
import type { PlayerUniverseEntry, Position } from "../domain.js";
import type { TxlineExtra } from "../txline/events.js";

function entry(id: number, position: Position): PlayerUniverseEntry {
  return {
    playerId: id, name: `P${id}`, nationalTeam: "FRA", jerseyNumber: 9,
    position, priceTier: "Star", priceSol: 2.8, rarity: "Rare", photo: "",
  };
}

function box(partial: Partial<EspnPlayerStat> & { playerId: number }): EspnPlayerStat {
  return {
    starter: true, subIn: false, appeared: true, goals: 0, assists: 0, ownGoals: 0,
    yellowCards: 0, redCards: 0, saves: 0, teamConcededGoals: 0, ...partial,
  };
}

test("scoreEspnMatch: ESPN goal is scored (no TxLINE)", () => {
  const universe = new Map([[1, entry(1, "FWD")]]);
  const bs = new Map([[1, box({ playerId: 1, goals: 2 })]]);
  const r = scoreEspnMatch(1000, bs, universe).find((x) => x.playerId === 1);
  assert.ok(r);
  assert.equal(r.stat.goals, 2);
  // 2 goals x 4 (FWD) + app 1 + min60 1 = 10, sole contributor -> MVP +3 = 13
  assert.equal(r.rawPoints, 13);
});

test("scoreEspnMatch: TxLINE fills in the goal ESPN missed (max)", () => {
  const universe = new Map([[1, entry(1, "MID")]]);
  const bs = new Map([[1, box({ playerId: 1, goals: 0 })]]); // ESPN 0
  const tx: Map<number, TxlineExtra> = new Map([[1, { goals: 1, ownGoals: 0, yellow: 0, red: 0 }]]);
  const r = scoreEspnMatch(1000, bs, universe, tx).find((x) => x.playerId === 1);
  assert.ok(r);
  assert.equal(r.stat.goals, 1); // max(0,1)=1 -> TxLINE event was added to the score
});

test("scoreEspnMatch: max does not double count (both report the same goal)", () => {
  const universe = new Map([[1, entry(1, "FWD")]]);
  const bs = new Map([[1, box({ playerId: 1, goals: 1 })]]);
  const tx: Map<number, TxlineExtra> = new Map([[1, { goals: 1, ownGoals: 0, yellow: 0, red: 0 }]]);
  const r = scoreEspnMatch(1000, bs, universe, tx).find((x) => x.playerId === 1);
  assert.ok(r);
  assert.equal(r.stat.goals, 1); // max(1,1)=1, NO double counting
});

test("scoreEspnMatch: TxLINE red card is added to the score", () => {
  const universe = new Map([[1, entry(1, "DEF")]]);
  const bs = new Map([[1, box({ playerId: 1, redCards: 0, teamConcededGoals: 0 })]]);
  const tx: Map<number, TxlineExtra> = new Map([[1, { goals: 0, ownGoals: 0, yellow: 0, red: 1 }]]);
  const r = scoreEspnMatch(1000, bs, universe, tx).find((x) => x.playerId === 1);
  assert.ok(r);
  assert.equal(r.stat.redCards, 1);
  assert.equal(r.breakdown.redCard, -3);
});

test("scoreEspnMatch: player not in the universe is skipped", () => {
  const universe = new Map([[1, entry(1, "FWD")]]);
  const bs = new Map([[99, box({ playerId: 99, goals: 5 })]]); // 99 is not in the universe
  const results = scoreEspnMatch(1000, bs, universe);
  assert.equal(results.length, 0);
});

test("minutes: a starter substituted off is credited only up to that minute", () => {
  const universe = new Map([[1, entry(1, "MID")]]);
  const bs = new Map([[1, box({ playerId: 1 })]]);
  const r = scoreEspnMatch(1000, bs, universe, undefined, {
    elapsedMinutes: 80,
    finished: false,
    subs: [{ inId: 2, outId: 1, minute: 55 }],
  }).find((x) => x.playerId === 1);
  assert.equal(r?.stat.minutesPlayed, 55);
});

test("minutes: a substitute is credited from the minute they came on", () => {
  const universe = new Map([[2, entry(2, "FWD")]]);
  const bs = new Map([[2, box({ playerId: 2, starter: false, subIn: true })]]);
  const r = scoreEspnMatch(1000, bs, universe, undefined, {
    elapsedMinutes: 80,
    finished: false,
    subs: [{ inId: 2, outId: 1, minute: 55 }],
  }).find((x) => x.playerId === 2);
  assert.equal(r?.stat.minutesPlayed, 25);
});

test("live match: a defender early on has only the appearance point", () => {
  const universe = new Map([[1, entry(1, "DEF")]]);
  const bs = new Map([[1, box({ playerId: 1, teamConcededGoals: 0 })]]);
  const r = scoreEspnMatch(1000, bs, universe, undefined, {
    elapsedMinutes: 5,
    finished: false,
    subs: [],
  }).find((x) => x.playerId === 1);
  assert.equal(r?.stat.minutesPlayed, 5);
  assert.equal(r?.rawPoints, 1);
});
