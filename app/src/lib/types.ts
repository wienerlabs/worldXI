export type Position = "GK" | "DEF" | "MID" | "FWD";
export type Tier = "Legendary" | "Star" | "Solid" | "Rotation" | "Budget";
export type Rarity = "Common" | "Rare" | "Legendary";

export interface Player {
  playerId: number;
  name: string;
  nationalTeam: string;
  jerseyNumber: number;
  position: Position;
  priceTier: Tier;
  priceSol: number;
  rarity: Rarity;
  photo: string; // ESPN headshot URL (yoksa Wikipedia -> forma zinciri)
}

export interface Country {
  countryNameTr: string;
  countryNameEn: string;
  isoCode: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  flagEmoji: string;
}

export interface PlayerLeaderRow {
  playerId: number;
  totalPoints: number;
  rank: number;
  player: Player | null;
}

export interface UserLeaderRow {
  owner: string;
  nickname: string;
  countryCode: string | null;
  finalPoints: number;
  provisionalPoints: number;
  rank: number;
}

export const FORMATIONS: Record<string, { def: number; mid: number; fwd: number }> = {
  F433: { def: 4, mid: 3, fwd: 3 },
  F442: { def: 4, mid: 4, fwd: 2 },
  F352: { def: 3, mid: 5, fwd: 2 },
  F343: { def: 3, mid: 4, fwd: 3 },
  F532: { def: 5, mid: 3, fwd: 2 },
  F541: { def: 5, mid: 4, fwd: 1 },
  F451: { def: 4, mid: 5, fwd: 1 },
};

export const BUDGET_SOL = 35;
export const MAX_PER_COUNTRY = 3;
export const SQUAD_SIZE = 15;
export const STARTERS_SIZE = 11;

/** Squad limit per position (15 total). Source: squad rules. */
export const POS_LIMITS: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

/** Fantasy raw scoring - matches oracle rules.ts (POINTS) exactly. Single source of truth. */
export const SCORING = {
  appearance: 1,
  minutes60: 1,
  goalGk: 6,
  goalDef: 6,
  goalMid: 5,
  goalFwd: 4,
  assist: 3,
  cleanSheet: 4,
  penaltySave: 5,
  mvp: 3,
  yellowCard: -1,
  redCard: -3,
  ownGoal: -2,
} as const;

/** On-chain applied multipliers - settle_squad_matchday.rs + enums.rs (bonus_bps). */
export const RARITY_BONUS_PCT: Record<Rarity, number> = { Common: 0, Rare: 5, Legendary: 10 };
export const CAPTAIN_MULTIPLIER = 2;

/** Price per tier (SOL) - matches oracle domain.ts TIER_PRICE_SOL exactly. */
export const TIER_PRICE_SOL: Record<Tier, number> = {
  Legendary: 4.0,
  Star: 2.8,
  Solid: 1.7,
  Rotation: 1.0,
  Budget: 0.6,
};
