//! PlayerCard: the onchain performance mirror of a cNFT (a living card).
//!
//! The card holds the career history that the owner's chosen player accumulates
//! over the tournament: matches played, total points, MVP count, and highest
//! single-match score.

use crate::state::enums::Rarity;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PlayerCard {
    /// The tournament it belongs to.
    pub tournament: Pubkey,
    /// The wallet that owns the card.
    pub owner: Pubkey,
    /// The player_id of the represented player.
    pub player_id: u32,
    /// Card rarity (for the point bonus applied during settle).
    pub rarity: Rarity,
    /// Number of matches played, counted for the owner through this card.
    pub matches_played: u32,
    /// Total fantasy points accumulated by the card.
    pub total_points: i64,
    /// The card's MVP (player of the match) count.
    pub mvp_count: u32,
    /// Highest score recorded in a single matchday.
    pub best_single_score: i32,
    /// Associated cNFT mint address (Bubblegum asset id / mint).
    pub mint: Pubkey,
    pub bump: u8,
}
