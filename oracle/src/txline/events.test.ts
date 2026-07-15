import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTxlineEvents } from "./events.js";
import type { TxScores, TxPlayerLineupData } from "./types.js";
import type { PlayerUniverseEntry } from "../domain.js";

function universe(): Map<number, PlayerUniverseEntry> {
  // players.json universe is in ESPN fullName ("Kylian Mbappé") form
  return new Map([
    [231388, { playerId: 231388, name: "Kylian Mbappé", nationalTeam: "FRA", jerseyNumber: 10, position: "FWD", priceTier: "Legendary", priceSol: 4, rarity: "Legendary", photo: "" }],
  ]);
}

/** TxLINE lineup record: normativeId 500 -> TxLINE "Surname, Name" form. */
function lineupPlayer(normativeId: number, preferredName: string): TxPlayerLineupData {
  return {
    fixturePlayerId: normativeId + 900000, statusId: 1, positionId: 37, unitId: 0,
    rosterNumber: "10", starter: true, starred: false,
    player: { id: `p${normativeId}`, normativeId, country: "FRA", team: "FRA", dateOfBirth: "", gender: "male", preferredName, updateDateMillis: 0 },
  };
}

test("extractTxlineEvents: maps a TxLINE goal to the ESPN id by name (order-independent)", () => {
  const scores: TxScores[] = [
    { Lineups: [{ id: "t100", normativeId: 100, preferredName: "FRA", gender: "male", updateDateMillis: 0, lineups: [lineupPlayer(500, "Mbappé, Kylian")] }] },
    { Data: { Action: "goal", New: { PlayerId: 500, GoalType: "Shot" } } },
  ];
  const out = extractTxlineEvents(scores, universe());
  assert.equal(out.get(231388)?.goals, 1); // "Mbappé, Kylian" ≈ "Kylian Mbappé"
  assert.equal(out.get(231388)?.ownGoals, 0);
});

test("extractTxlineEvents: separates own goal and cards", () => {
  const scores: TxScores[] = [
    { Lineups: [{ id: "t100", normativeId: 100, preferredName: "FRA", gender: "male", updateDateMillis: 0, lineups: [lineupPlayer(500, "Mbappé, Kylian")] }] },
    { Data: { Action: "goal", New: { PlayerId: 500, GoalType: "OwnGoal" } } },
    { Data: { Action: "yellow_card", New: { PlayerId: 500 } } },
    { Data: { Action: "red_card", New: { PlayerId: 500 } } },
  ];
  const e = extractTxlineEvents(scores, universe()).get(231388);
  assert.ok(e);
  assert.equal(e.ownGoals, 1);
  assert.equal(e.goals, 0);
  assert.equal(e.yellow, 1);
  assert.equal(e.red, 1);
});

test("extractTxlineEvents: a player not in the universe is skipped", () => {
  const scores: TxScores[] = [
    { Lineups: [{ id: "t100", normativeId: 100, preferredName: "FRA", gender: "male", updateDateMillis: 0, lineups: [lineupPlayer(777, "Unknown, Player")] }] },
    { Data: { Action: "goal", New: { PlayerId: 777, GoalType: "Shot" } } },
  ];
  const out = extractTxlineEvents(scores, universe());
  assert.equal(out.size, 0); // name did not match -> skipped
});
