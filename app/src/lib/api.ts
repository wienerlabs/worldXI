/**
 * Data layer: player/country set from static JSON copied into the build; live
 * leaderboard + player detail + provisional score from the oracle API (when available).
 */
import type { Country, Player, PlayerLeaderRow, UserLeaderRow } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:8787";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

/** Static data set (oracle pipeline output, copied into the build). */
export const loadPlayers = (): Promise<Player[]> => getJson<Player[]>("/players.json");
export const loadCountries = (): Promise<Country[]> => getJson<Country[]>("/countries.json");

/** Oracle API (live). On error, the caller shows an empty/fallback state. */
export const fetchPlayerLeaderboard = (): Promise<PlayerLeaderRow[]> =>
  getJson<PlayerLeaderRow[]>(`${API_BASE}/leaderboard/players`);

export const fetchUserLeaderboard = (scope: "global" | "daily" = "global"): Promise<UserLeaderRow[]> =>
  getJson<UserLeaderRow[]>(`${API_BASE}/leaderboard/users?scope=${scope}`);

export interface SponsorLeagueRow {
  name: string;
  sponsor: string;
  prizeSol: number;
  settled: boolean;
  winner: string | null;
}

export const fetchLeagues = (): Promise<SponsorLeagueRow[]> =>
  getJson<SponsorLeagueRow[]>(`${API_BASE}/leagues`);

export interface PlayerDetail {
  player: Player;
  totalPoints: number;
  rank: number | null;
  matchesPlayed: number;
  average: number;
  mvpCount: number;
  history: Array<{
    matchday: number;
    fixtureId: number;
    rawPoints: number;
    wasMvp: boolean;
    breakdown: Record<string, number>;
    stat: Record<string, number | boolean | string>;
  }>;
}
export const fetchPlayerDetail = (id: number): Promise<PlayerDetail> =>
  getJson<PlayerDetail>(`${API_BASE}/player/${id}`);

// --- Mac merkezi (WC fikstur + canli skor + detay) ---
export type MatchStatus = "scheduled" | "live" | "halftime" | "finished";
export interface MatchTeam {
  iso: string | null;
  name: string;
  flag: string | null;
}
export interface MatchSummary {
  fixtureId: number;
  competition: string;
  startTime: number;
  status: MatchStatus;
  minute: number | null;
  home: MatchTeam;
  away: MatchTeam;
  score: { home: number; away: number } | null;
}
export interface MatchEvent {
  type: "goal" | "own_goal" | "yellow_card" | "red_card" | "substitution" | "penalty" | "halftime";
  minute: number | null;
  team: "home" | "away" | null;
  playerId: number | null;
  playerInId: number | null;
  playerOutId: number | null;
  primary: string | null;
  secondary: string | null;
  text: string | null;
}
export interface MatchPlayerRating {
  playerId: number;
  name: string;
  team: "home" | "away" | null;
  position: string;
  rawPoints: number;
  wasMvp: boolean;
  photo: string;
}
export interface MatchDetailData extends MatchSummary {
  events: MatchEvent[];
  lineups: Array<{ team: "home" | "away"; players: Array<{ playerId: number; name: string; number: string; starter: boolean }> }>;
  playerRatings: MatchPlayerRating[];
}

export const fetchMatches = (day?: number): Promise<{ day: number; matches: MatchSummary[] }> =>
  getJson<{ day: number; matches: MatchSummary[] }>(`${API_BASE}/matches${day !== undefined ? `?day=${day}` : ""}`);

/** Turnuvada mac olan gunler (gun secici icin) - epochDay + o gunku mac sayisi. */
export const fetchMatchDays = (): Promise<{ days: Array<{ day: number; count: number }> }> =>
  getJson<{ days: Array<{ day: number; count: number }> }>(`${API_BASE}/matches/days`);

export const fetchMatchDetail = (fixtureId: number): Promise<MatchDetailData> =>
  getJson<MatchDetailData>(`${API_BASE}/match/${fixtureId}`);

// --- Team leaderboard (teams ranked by summed player points) ---
export interface TeamLeaderRow {
  iso: string;
  name: string;
  flag: string | null;
  totalPoints: number;
  playerCount: number;
  rank: number;
  /** Matchday-by-matchday points (how many the team scored in each match). */
  breakdown: Array<{ matchday: number; points: number }>;
}
export const fetchTeamLeaderboard = (): Promise<TeamLeaderRow[]> =>
  getJson<TeamLeaderRow[]>(`${API_BASE}/leaderboard/teams`);

// --- Per-player tournament stats (real: matches, points, MVP, best single match) ---
export interface PlayerStats {
  playerId: number;
  totalPoints: number;
  matchesPlayed: number;
  mvpCount: number;
  bestScore: number;
}
export const fetchPlayerStats = (): Promise<PlayerStats[]> =>
  getJson<PlayerStats[]>(`${API_BASE}/players/stats`);

// --- Friend leagues (private, invite-code) ---
export interface FriendLeagueRow {
  pubkey: string;
  name: string;
  code: string;
  memberCount: number;
  isCreator: boolean;
}
export interface LeagueMember {
  owner: string;
  nickname: string;
  hasSquad: boolean;
  points: number;
  rank: number;
  squad: { players: number[]; starters: number[]; captain: number; formation: string } | null;
}
export interface LeagueDetailData {
  pubkey: string;
  name: string;
  code: string;
  creator: string;
  memberCount: number;
  matchStarted: boolean;
  members: LeagueMember[];
}
export const fetchMyFriendLeagues = (owner: string): Promise<FriendLeagueRow[]> =>
  getJson<FriendLeagueRow[]>(`${API_BASE}/friend-leagues/${owner}`);
export const fetchLeagueDetail = (pubkey: string): Promise<LeagueDetailData> =>
  getJson<LeagueDetailData>(`${API_BASE}/friend-league/${pubkey}`);

// --- Manager detail: active squad (#1) + per-matchday lineup/points history (#2, #3) ---
export interface ManagerSquad {
  players: number[];
  starters: number[];
  captain: number;
  formation: string;
  points: number;
}
export interface MatchdaySquad {
  matchday: number;
  starters: number[];
  captain: number;
  formation: string;
  points: number;
}
export interface ManagerDetailData {
  owner: string;
  nickname: string;
  matchStarted: boolean;
  activeSquad: ManagerSquad | null;
  history: MatchdaySquad[];
}
export const fetchManagerDetail = (owner: string): Promise<ManagerDetailData> =>
  getJson<ManagerDetailData>(`${API_BASE}/manager/${owner}`);

// --- Live goals (celebration overlay) ---
export interface LiveGoalTeam {
  iso: string | null;
  name: string;
  flag: string | null;
}
export interface LiveGoal {
  id: string;
  fixtureId: number;
  playerId: number | null;
  scorerPoints: number;
  minute: number | null;
  scorerTeam: "home" | "away" | null;
  ownGoal: boolean;
  home: LiveGoalTeam;
  away: LiveGoalTeam;
  score: { home: number; away: number };
  ts: number;
}
export const fetchLiveGoals = (): Promise<LiveGoal[]> => getJson<LiveGoal[]>(`${API_BASE}/live/goals`);

/** WebSocket URL for the oracle (same host/port as the REST API). */
export const wsUrl = (): string => API_BASE.replace(/^http/, "ws");

export const apiBase = API_BASE;
