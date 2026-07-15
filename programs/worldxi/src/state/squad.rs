//! User squad: the 15 selected players, the starting 11, formation, and captain.

use crate::constants::{SQUAD_SIZE, STARTERS_SIZE};
use crate::state::enums::Formation;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Squad {
    /// The tournament it belongs to.
    pub tournament: Pubkey,
    /// The wallet that owns the squad.
    pub owner: Pubkey,
    /// The player_ids of the 15 selected players (11 starters + 4 substitutes).
    pub players: [u32; SQUAD_SIZE],
    /// The player_ids of the 11 players on the field (a subset of players).
    pub starters: [u32; STARTERS_SIZE],
    /// The active formation.
    pub formation: Formation,
    /// The captain's player_id (must be among the starters; scores 2x).
    pub captain: u32,
    /// Total budget spent on the squad (lamports).
    pub spent_lamports: u64,
    /// The last settled matchday (idempotency; 0 initially).
    pub locked_matchday: u16,
    /// The squad's onchain finalized total points (accumulated via settle_squad_matchday).
    pub total_points: i64,
    pub bump: u8,
}
