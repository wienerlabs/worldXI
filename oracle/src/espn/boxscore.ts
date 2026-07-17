/**
 * ESPN match summary (box score): for a given event, returns each player's REAL
 * statistics keyed by ESPN athlete id - appearance, starter/substitute, goals,
 * assists, own goals, yellow/red cards, goalkeeper saves and goals conceded by the
 * team (for clean sheet).
 *
 * Scoring is derived entirely from this id-based data; there is no name matching.
 * Source: site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={id}
 */
import { errorMessage, logger } from "../logger.js";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";

export interface EspnPlayerStat {
  playerId: number; // ESPN athlete id
  starter: boolean;
  subIn: boolean;
  appeared: boolean;
  goals: number;
  assists: number;
  ownGoals: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  teamConcededGoals: number;
}

interface SummaryResponse {
  rosters?: Array<{
    roster?: Array<{
      starter?: boolean;
      subbedIn?: boolean;
      athlete?: { id?: string };
      stats?: Array<{ name?: string; value?: number }>;
    }>;
  }>;
}

/** Max plausible count for any per-player, per-match stat. Bounds a corrupt or spoofed feed
 *  so it cannot inject absurd values that would inflate the points committed on-chain. */
const MAX_STAT = 20;

function stat(stats: Array<{ name?: string; value?: number }> | undefined, name: string): number {
  const raw = Number(stats?.find((s) => s.name === name)?.value ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(Math.floor(raw), MAX_STAT);
}

/**
 * Fetches an event's box score. Returns null when there are no player statistics
 * (rosters) - i.e. the match has not been played.
 */
export async function fetchBoxScore(eventId: string): Promise<Map<number, EspnPlayerStat> | null> {
  let data: SummaryResponse;
  try {
    const res = await fetch(`${BASE}?event=${eventId}`);
    if (!res.ok) return null;
    data = (await res.json()) as SummaryResponse;
  } catch (e: unknown) {
    logger.warn("Failed to fetch ESPN box score", { eventId, error: errorMessage(e) });
    return null;
  }
  const rosters = data.rosters ?? [];
  if (rosters.length === 0) return null;

  const out = new Map<number, EspnPlayerStat>();
  let hasStats = false;
  for (const team of rosters) {
    for (const p of team.roster ?? []) {
      const id = Number.parseInt(p.athlete?.id ?? "", 10);
      if (!Number.isFinite(id)) continue;
      const s = p.stats;
      const appearances = stat(s, "appearances");
      const starter = p.starter === true;
      const subIn = p.subbedIn === true || stat(s, "subIns") > 0;
      const appeared = appearances > 0 || starter || subIn;
      if (s && s.length > 0) hasStats = true;
      out.set(id, {
        playerId: id,
        starter,
        subIn,
        appeared,
        goals: stat(s, "totalGoals"),
        assists: stat(s, "goalAssists"),
        ownGoals: stat(s, "ownGoals"),
        yellowCards: stat(s, "yellowCards"),
        redCards: stat(s, "redCards"),
        saves: stat(s, "saves"),
        teamConcededGoals: stat(s, "goalsConceded"),
      });
    }
  }
  return hasStats ? out : null;
}
