/**
 * WorldXI shared domain model - types shared across the oracle layers, the dataset,
 * and the frontend. Aligned with the onchain Anchor state.
 */

export type Position = "GK" | "DEF" | "MID" | "FWD";

export type Tier = "Legendary" | "Star" | "Solid" | "Rotation" | "Budget";

export type Rarity = "Common" | "Rare" | "Legendary";

/** Corresponds to the Anchor Position enum (for the register_player argument). */
export const POSITION_TO_ANCHOR: Record<Position, { [k: string]: Record<string, never> }> = {
  GK: { goalkeeper: {} },
  DEF: { defender: {} },
  MID: { midfielder: {} },
  FWD: { forward: {} },
};

export const RARITY_TO_ANCHOR: Record<Rarity, { [k: string]: Record<string, never> }> = {
  Common: { common: {} },
  Rare: { rare: {} },
  Legendary: { legendary: {} },
};

/** Tier -> starting price (SOL). Calibrated to a 25 SOL budget: the cheapest 15-player
 *  squad (15x0.6=9 SOL) fits comfortably; buying 3-4 premiums fills the budget (scarcity preserved). */
export const TIER_PRICE_SOL: Record<Tier, number> = {
  Legendary: 4.0,
  Star: 2.8,
  Solid: 1.7,
  Rotation: 1.0,
  Budget: 0.6,
};

/** Tier -> default rarity (most are Common; stars are Rare/Legendary). */
export const TIER_RARITY: Record<Tier, Rarity> = {
  Legendary: "Legendary",
  Star: "Rare",
  Solid: "Common",
  Rotation: "Common",
  Budget: "Common",
};

/** National team (countries.json row). */
export interface Country {
  countryNameTr: string;
  countryNameEn: string;
  isoCode: string; // ISO 3166-1 alpha-3
  // Kit colors: fed from a real source; null if absent (frontend uses a neutral palette + flag).
  primaryColor: string | null; // hex
  secondaryColor: string | null; // hex
  flagEmoji: string; // derived programmatically from ISO alpha-2 (regional indicator)
}

/** Player universe record (players.json row). player_id = ESPN athlete id (u32, stable). */
export interface PlayerUniverseEntry {
  playerId: number;
  name: string;
  nationalTeam: string; // ISO alpha-3
  jerseyNumber: number;
  position: Position;
  priceTier: Tier;
  priceSol: number;
  rarity: Rarity;
  /** ESPN headshot URL (deterministic). Frontend: if absent, Wikipedia -> kit svg chain. */
  photo: string;
}

/** A player's raw stats in a single match (merged from the feeds). */
export interface MatchPlayerStat {
  playerId: number; // ESPN athlete id
  position: Position;
  appeared: boolean;
  minutesPlayed: number;
  goals: number; // excluding own goals
  ownGoals: number;
  assists: number; // API-Football
  yellowCards: number;
  redCards: number;
  penaltiesSaved: number; // API-Football (goalkeeper)
  teamConcededGoals: number; // for clean sheet
}

/** Point breakdown (for transparency and the UI player detail screen). */
export interface ScoreBreakdown {
  appearance: number;
  minutes60: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  penaltySave: number;
  yellowCard: number;
  redCard: number;
  ownGoal: number;
  mvp: number;
  total: number;
}

/** A player's final fantasy result in a match (raw - excluding rarity/captain). */
export interface MatchdayPlayerResult {
  playerId: number;
  fixtureId: number;
  rawPoints: number;
  wasMvp: boolean;
  breakdown: ScoreBreakdown;
  stat: MatchPlayerStat;
}
