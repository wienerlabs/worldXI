/**
 * TxLINE off-chain API types - correspond exactly to the OpenAPI v1.5.2
 * (docs/txline-openapi.yaml) schemas. ONLY score/event/lineup data is used;
 * odds/betting data (odds) is NEVER consumed (hackathon rule + bet-free design).
 */

/** GET /api/fixtures/snapshot -> Fixture[] */
export interface TxFixture {
  Ts: number;
  StartTime: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  Participant1IsHome: boolean;
}

/** Goal type (GoalType oneOf): Head | Other | OwnGoal | Shot -> externally tagged. */
export type TxGoalType =
  | { Head: Record<string, never> }
  | { Shot: Record<string, never> }
  | { Other: Record<string, never> }
  | { OwnGoal: Record<string, never> };

/** dataSoccer (SoccerData): details of a single match event. */
export interface TxSoccerData {
  Action?: string;
  Color?: string;
  New?: unknown;
  Previous?: unknown;
  Corner?: boolean;
  FreeKickType?: string;
  Goal?: boolean;
  GoalType?: TxGoalType;
  Minutes?: number;
  Outcome?: string;
  Participant?: number;
  Penalty?: boolean;
  PlayerId?: number;
  PlayerInId?: number;
  PlayerOutId?: number;
  StatusId?: number;
  ThrowInType?: string;
  Type?: string;
  RedCard?: boolean;
  YellowCard?: boolean;
  VAR?: boolean;
}

/** Total statistics per player (SoccerPlayerStats). */
export interface TxSoccerPlayerStats {
  goals: number;
  shots: number;
  ownGoals: number;
  penaltyAttempts: number;
  penaltyGoals: number;
  yellowCards: number;
  redCards: number;
}

/** Map_SoccerPlayerStats: fixturePlayerId -> stats. */
export type TxSoccerPlayerStatsMap = Record<string, TxSoccerPlayerStats>;

/** SoccerFixturePlayerStats: player stat maps of the two participants. */
export interface TxSoccerFixturePlayerStats {
  Participant1: TxSoccerPlayerStatsMap;
  Participant2: TxSoccerPlayerStatsMap;
}

/** Player identity (PlayerData). */
export interface TxPlayerData {
  id: string;
  normativeId: number;
  country: string;
  team: string;
  dateOfBirth: string;
  gender: string;
  preferredName: string;
  updateDateMillis: number;
}

/** A single player's lineup record in a fixture (PlayerLineupData). */
export interface TxPlayerLineupData {
  fixturePlayerId: number;
  statusId: number;
  positionId: number;
  unitId: number;
  rosterNumber: string;
  starter: boolean;
  starred: boolean;
  player: TxPlayerData;
}

/** A team's lineup block (LineupData). */
export interface TxLineupData {
  id: string;
  normativeId: number;
  preferredName: string;
  gender: string;
  updateDateMillis: number;
  lineups?: TxPlayerLineupData[];
}

/** SoccerTotalScore / SoccerFixtureScore. */
export interface TxSoccerTotalScore {
  Goals?: number;
  YellowCards?: number;
  RedCards?: number;
  Corners?: number;
}
export interface TxSoccerFixtureScore {
  Participant1: TxSoccerTotalScore;
  Participant2: TxSoccerTotalScore;
}

/** A participant's period-based score (real feed: Score.Participant1/2). */
export interface TxPeriodStat {
  Goals?: number;
  YellowCards?: number;
  RedCards?: number;
  Corners?: number;
}
export interface TxParticipantScore {
  H1?: TxPeriodStat;
  HT?: TxPeriodStat;
  H2?: TxPeriodStat;
  ET1?: TxPeriodStat;
  ET2?: TxPeriodStat;
  Total?: TxPeriodStat;
}
export interface TxTeamScore {
  Participant1: TxParticipantScore;
  Participant2: TxParticipantScore;
}

/** Event data (real feed: Data). E.g. substitution -> New.PlayerIn/OutId. */
export interface TxEventNew {
  Clock?: { Running?: boolean; Seconds?: number };
  PlayerInId?: number;
  PlayerOutId?: number;
  PlayerId?: number;
  GoalType?: string; // "Head" | "Shot" | "Other" | "OwnGoal"
  Type?: string; // card type, e.g. "StraightRed"
  Goal?: boolean;
  YellowCard?: boolean;
  RedCard?: boolean;
}
export interface TxEventData {
  Action?: string; // "goal" | "yellow_card" | "red_card" | "substitution" | ...
  New?: TxEventNew;
  Previous?: unknown;
}

/**
 * Scores: the full record of a score update/event.
 * GET /api/scores/snapshot/{fixtureId} and /historical/{fixtureId} -> Scores[]
 *
 * NOTE: The real devnet feed uses top-level PascalCase fields (Score, Data,
 * Lineups, GameState, Participant1Id...). Below, the real fields (uppercase) are primary;
 * the old camelCase fields are kept optional for backward compatibility.
 */
export interface TxScores {
  FixtureId?: number;
  GameState?: string;
  StartTime?: number;
  Participant1Id?: number;
  Participant2Id?: number;
  Participant1IsHome?: boolean;
  CompetitionId?: number;
  Action?: string;
  /** Match status: 2/4 during live play, 100 when the match ends (observed real feed). */
  StatusId?: number;
  Seq?: number;
  Clock?: { Running?: boolean; Seconds?: number };
  Score?: TxTeamScore;
  Data?: TxEventData;
  Stats?: Record<string, number>;
  Participant?: number;
  Lineups?: TxLineupData[];

  // --- Old/OpenAPI camelCase (optional; may arrive in some environments) ---
  fixtureId?: number;
  gameState?: string;
  participant1Id?: number;
  participant2Id?: number;
  scoreSoccer?: TxSoccerFixtureScore;
  dataSoccer?: TxSoccerData;
  lineups?: TxLineupData[];
  playerStatsSoccer?: TxSoccerFixturePlayerStats;
}

/** SSE event (ScoresStreamEvent): GET /api/scores/stream. */
export interface TxScoresStreamEvent {
  id?: string;
  event?: string;
  data: TxScores;
}

/** POST /auth/guest/start response. */
export interface TxGuestStartResponse {
  token: string;
}

/** POST /api/token/activate response. */
export interface TxActivateResponse {
  token: string;
}
