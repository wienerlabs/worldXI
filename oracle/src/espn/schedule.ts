/**
 * Fetches the WC 2026 fixture schedule from the ESPN scoreboard: for each match, the
 * ESPN event id, both teams' ISO alpha-3 codes, its date and status (played or not).
 * Box score scoring and matchday assignment use this schedule.
 *
 * Source: site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD
 */
import { logger, errorMessage } from "../logger.js";
import { toIsoAlpha3 } from "../pipeline/countries.js";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface EspnFixture {
  eventId: string;
  homeIso: string | null;
  awayIso: string | null;
  homeScore: number;
  awayScore: number;
  dateMs: number;
  completed: boolean;
}

interface ScoreboardResponse {
  events?: Array<{
    id: string;
    date: string;
    status?: { type?: { completed?: boolean; state?: string } };
    competitions?: Array<{
      competitors: Array<{ homeAway: string; score: string; team: { displayName: string } }>;
    }>;
  }>;
}

async function fetchDay(dateYmd: string): Promise<EspnFixture[]> {
  const res = await fetch(`${BASE}?dates=${dateYmd}`);
  if (!res.ok) return [];
  const data = (await res.json()) as ScoreboardResponse;
  const out: EspnFixture[] = [];
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors.find((c) => c.homeAway === "home");
    const away = comp.competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;
    out.push({
      eventId: ev.id,
      homeIso: toIsoAlpha3(home.team.displayName),
      awayIso: toIsoAlpha3(away.team.displayName),
      homeScore: Number.parseInt(home.score, 10) || 0,
      awayScore: Number.parseInt(away.score, 10) || 0,
      dateMs: Date.parse(ev.date),
      completed: ev.status?.type?.completed === true,
    });
  }
  return out;
}

/** Scans all WC 2026 days and returns the fixture schedule. */
export async function fetchEspnSchedule(
  startYmd = "20260601",
  endYmd = "20260731"
): Promise<EspnFixture[]> {
  const start = Date.parse(`${startYmd.slice(0, 4)}-${startYmd.slice(4, 6)}-${startYmd.slice(6, 8)}`);
  const end = Date.parse(`${endYmd.slice(0, 4)}-${endYmd.slice(4, 6)}-${endYmd.slice(6, 8)}`);
  const all: EspnFixture[] = [];
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t);
    const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    try {
      all.push(...(await fetchDay(ymd)));
    } catch (e: unknown) {
      logger.warn("Failed to fetch ESPN schedule day", { ymd, error: errorMessage(e) });
    }
    await sleep(120);
  }
  logger.info("ESPN schedule fetched", { fixtures: all.length, completed: all.filter((f) => f.completed).length });
  return all;
}

/** Computes the tournament's first match day (UTC day index) (matchday base). */
export function tournamentStartDay(fixtures: EspnFixture[]): number {
  const days = fixtures.map((f) => Math.floor(f.dateMs / 86_400_000)).sort((a, b) => a - b);
  return days[0] ?? 0;
}

/** Returns a match's matchday (1-based day difference). */
export function matchdayOf(fixture: EspnFixture, startDay: number): number {
  return Math.floor(fixture.dateMs / 86_400_000) - startDay + 1;
}
