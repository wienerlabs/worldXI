/**
 * TxLINE <-> ESPN fixture bridge. TxLINE is the hackathon's mandatory core feed
 * (which matches, when, live score stream); the scoring truth comes from the ESPN
 * box score (id-based, rich). This bridge links each TxLINE fixture to its
 * corresponding ESPN event via a team (ISO alpha-3) + day match.
 */
import type { TxFixture } from "../txline/types.js";
import { logger } from "../logger.js";
import { fetchEspnSchedule, tournamentStartDay, matchdayOf, type EspnFixture } from "./schedule.js";
import { toIsoAlpha3 } from "../pipeline/countries.js";

const MS_PER_DAY = 86_400_000;

export interface BridgedFixture {
  txFixtureId: number;
  espnEventId: string;
  matchday: number;
  label: string;
}

function pairKey(a: string | null, b: string | null, day: number): string | null {
  if (!a || !b) return null;
  return [a, b].sort().join("|") + "|" + day;
}

/**
 * Maps TxLINE fixtures to ESPN events. Fixtures that do not match (not found in
 * ESPN) are skipped. matchday is derived from the ESPN calendar day.
 */
export async function bridgeFixtures(txFixtures: TxFixture[]): Promise<BridgedFixture[]> {
  const espn = await fetchEspnSchedule();
  const startDay = tournamentStartDay(espn);
  const index = new Map<string, EspnFixture>();
  for (const f of espn) {
    const key = pairKey(f.homeIso, f.awayIso, Math.floor(f.dateMs / MS_PER_DAY));
    if (key) index.set(key, f);
  }

  const out: BridgedFixture[] = [];
  for (const tx of txFixtures) {
    const iso1 = toIsoAlpha3(tx.Participant1);
    const iso2 = toIsoAlpha3(tx.Participant2);
    const day = Math.floor(tx.StartTime / MS_PER_DAY);
    let ef: EspnFixture | undefined;
    for (const d of [day, day - 1, day + 1]) {
      const key = pairKey(iso1, iso2, d);
      if (key && index.has(key)) {
        ef = index.get(key);
        break;
      }
    }
    if (ef) {
      out.push({
        txFixtureId: tx.FixtureId,
        espnEventId: ef.eventId,
        matchday: matchdayOf(ef, startDay),
        label: `${tx.Participant1} vs ${tx.Participant2}`,
      });
    }
  }
  logger.info("TxLINE<->ESPN bridge built", { txFixtures: txFixtures.length, bridged: out.length });
  return out;
}
