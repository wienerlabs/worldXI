/**
 * Extracts TxLINE live event data (goal / own-goal / yellow / red card) and maps
 * it to the ESPN athlete id. This way the events TxLINE reports ACTUALLY
 * participate in scoring (not just as a trigger) - moving the hackathon's
 * TxLINE-core requirement from words to reality.
 *
 * Mapping: normativeId -> preferredName from the TxLINE lineup, then linked to the
 * players.json (ESPN id) universe by name (order-independent, accent-normalized).
 * For (most) matches TxLINE does not provide, this returns empty and scoring relies on ESPN.
 */
import type { TxScores } from "./types.js";
import type { PlayerUniverseEntry } from "../domain.js";

export interface TxlineExtra {
  goals: number;
  ownGoals: number;
  yellow: number;
  red: number;
}

/** Converts a name into an order-independent key ("Mbappé, Kylian" ≈ "Kylian Mbappé"). */
function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/**
 * Returns goal/card events from a fixture's TxLINE Scores[] array as
 * ESPN id -> contribution. Unmatched events (name not found) are skipped.
 */
export function extractTxlineEvents(
  scores: TxScores[],
  universe: Map<number, PlayerUniverseEntry>
): Map<number, TxlineExtra> {
  // normativeId -> TxLINE preferredName (from lineups)
  const nameById = new Map<number, string>();
  for (const s of scores) {
    for (const team of s.Lineups ?? s.lineups ?? []) {
      for (const pl of team.lineups ?? []) nameById.set(pl.player.normativeId, pl.player.preferredName);
    }
  }
  // ESPN name key -> ESPN id
  const espnByName = new Map<string, number>();
  for (const p of universe.values()) espnByName.set(nameKey(p.name), p.playerId);

  const out = new Map<number, TxlineExtra>();
  const ensure = (id: number): TxlineExtra => {
    let e = out.get(id);
    if (!e) {
      e = { goals: 0, ownGoals: 0, yellow: 0, red: 0 };
      out.set(id, e);
    }
    return e;
  };

  for (const s of scores) {
    const d = s.Data;
    if (!d?.Action) continue;
    const nid = d.New?.PlayerId;
    if (typeof nid !== "number") continue;
    const nm = nameById.get(nid);
    if (!nm) continue;
    const espnId = espnByName.get(nameKey(nm));
    if (espnId === undefined) continue;

    const e = ensure(espnId);
    switch (d.Action) {
      case "goal":
        if (d.New?.GoalType === "OwnGoal") e.ownGoals += 1;
        else e.goals += 1;
        break;
      case "yellow_card":
        e.yellow += 1;
        break;
      case "red_card":
        e.red += 1;
        break;
    }
  }
  return out;
}
