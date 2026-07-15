//! Player account: identity, national team, position, price, and total fantasy points.

use crate::constants::{ISO_LEN, MAX_PLAYER_NAME_LEN};
use crate::state::enums::{Position, Rarity};
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Player {
    /// The tournament it belongs to.
    pub tournament: Pubkey,
    /// Unique player identifier within the tournament (comes from the data set).
    pub player_id: u32,
    /// Player name.
    #[max_len(MAX_PLAYER_NAME_LEN)]
    pub name: String,
    /// National team ISO 3166-1 alpha-3 code (e.g. "TUR").
    pub country: [u8; ISO_LEN],
    /// Field position.
    pub position: Position,
    /// The player's rarity; carried over to the cards minted for this player.
    pub rarity: Rarity,
    /// Starting price assigned by tier (lamports).
    pub price_lamports: u64,
    /// The player's live total fantasy points accumulated over the tournament.
    /// Updated live every time commit_score is called.
    pub total_points: i64,
    pub bump: u8,
}
