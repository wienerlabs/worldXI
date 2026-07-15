//! ScoreCommit: the raw score the oracle writes for a player on a matchday.
//!
//! The basis of live settlement. During a match, the oracle updates this account
//! with init_if_needed on every significant event (goal, card, assist...),
//! reflecting the player's current raw score for that matchday. The rarity bonus
//! and captain multiplier are NOT here; they are applied in settle_squad_matchday.

use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ScoreCommit {
    /// The tournament it belongs to.
    pub tournament: Pubkey,
    /// The matchday this score belongs to.
    pub matchday: u16,
    /// The player's player_id.
    pub player_id: u32,
    /// Raw fantasy points, without the rarity/captain multiplier applied.
    pub raw_points: i32,
    /// Whether the player was chosen MVP on this matchday (for the card's mvp_count counter).
    pub was_mvp: bool,
    pub bump: u8,
}
