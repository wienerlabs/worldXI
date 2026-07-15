/**
 * Fetches the REAL World Cup 2026 squads from ESPN's public API (no auth).
 * For each national team, provides ESPN's official 26-man squad with the ESPN
 * athlete id, position, jersey number and headshot photo URL.
 *
 * player_id = ESPN athlete id (u32). Because scoring (box score) uses the same id,
 * goal/assist/card matching is done by id instead of name -> 100% reliable.
 *
 * Source: site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams[/{id}/roster]
 */
import { logger, errorMessage } from "../logger.js";
import type { Position } from "../domain.js";
import { toIsoAlpha3 } from "../pipeline/countries.js";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** ESPN athlete id -> deterministic headshot photo URL. */
export function espnHeadshotUrl(athleteId: number | string): string {
  return `https://a.espncdn.com/i/headshots/soccer/players/full/${athleteId}.png`;
}

/** ESPN position abbreviation (G/D/M/F) -> domain position. */
function mapPosition(abbr: string | undefined): Position {
  switch ((abbr ?? "").toUpperCase()) {
    case "G":
      return "GK";
    case "D":
      return "DEF";
    case "M":
      return "MID";
    case "F":
      return "FWD";
    default:
      return "MID";
  }
}

export interface EspnTeam {
  espnId: string;
  displayName: string;
  abbreviation: string;
  iso3: string; // ISO/FIFA alpha-3 (canonical team code)
}

export interface EspnRosterPlayer {
  playerId: number; // ESPN athlete id
  name: string;
  nationalTeam: string; // iso3
  jerseyNumber: number;
  position: Position;
  photo: string;
}

interface TeamsResponse {
  sports: Array<{
    leagues: Array<{ teams: Array<{ team: { id: string; displayName: string; abbreviation: string } }> }>;
  }>;
}

interface RosterResponse {
  athletes?: Array<{
    id: string;
    fullName?: string;
    displayName?: string;
    jersey?: string;
    position?: { abbreviation?: string };
  }>;
}

/** Fetches the 48 WC teams; maps each to its ISO/FIFA alpha-3 code. */
export async function fetchEspnTeams(): Promise<EspnTeam[]> {
  const res = await fetch(`${BASE}/teams`);
  if (!res.ok) throw new Error(`ESPN teams HTTP ${res.status}`);
  const data = (await res.json()) as TeamsResponse;
  const raw = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
  const teams: EspnTeam[] = [];
  for (const { team } of raw) {
    // Convert the team name to alpha-3 first, falling back to the ESPN abbreviation.
    const iso3 = toIsoAlpha3(team.displayName) ?? toIsoAlpha3(team.abbreviation);
    if (!iso3) {
      logger.warn("Could not map ESPN team to alpha-3", { team: team.displayName, abbr: team.abbreviation });
      continue;
    }
    teams.push({ espnId: team.id, displayName: team.displayName, abbreviation: team.abbreviation, iso3 });
  }
  logger.info("ESPN teams fetched", { count: teams.length });
  return teams;
}

/** Fetches a team's REAL 26-man WC squad. */
export async function fetchTeamRoster(team: EspnTeam): Promise<EspnRosterPlayer[]> {
  const res = await fetch(`${BASE}/teams/${team.espnId}/roster`);
  if (!res.ok) throw new Error(`ESPN roster ${team.espnId} HTTP ${res.status}`);
  const data = (await res.json()) as RosterResponse;
  const out: EspnRosterPlayer[] = [];
  for (const a of data.athletes ?? []) {
    const playerId = Number.parseInt(a.id, 10);
    if (!Number.isFinite(playerId)) continue;
    out.push({
      playerId,
      name: a.fullName ?? a.displayName ?? `#${a.id}`,
      nationalTeam: team.iso3,
      jerseyNumber: Number.parseInt(a.jersey ?? "0", 10) || 0,
      position: mapPosition(a.position?.abbreviation),
      photo: espnHeadshotUrl(playerId),
    });
  }
  return out;
}

/** Combines all 48 teams' squads to build the player universe (48 × ~26). */
export async function fetchEspnUniverse(): Promise<EspnRosterPlayer[]> {
  const teams = await fetchEspnTeams();
  const players: EspnRosterPlayer[] = [];
  for (const team of teams) {
    try {
      const roster = await fetchTeamRoster(team);
      players.push(...roster);
      logger.info("squad fetched", { team: team.iso3, players: roster.length });
    } catch (e: unknown) {
      logger.warn("Failed to fetch squad", { team: team.iso3, error: errorMessage(e) });
    }
    await sleep(120);
  }
  logger.info("ESPN player universe built", { teams: teams.length, players: players.length });
  return players;
}
