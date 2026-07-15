//! UserProfile: a user profile bound to a wallet.

use crate::constants::{ISO_LEN, MAX_NICKNAME_LEN};
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    /// The wallet that owns the profile (this is the identity; the nickname is not unique).
    pub owner: Pubkey,
    /// User nickname (max 24 characters).
    #[max_len(MAX_NICKNAME_LEN)]
    pub nickname: String,
    /// Optional: the country the user supports/participates for (ISO alpha-3).
    pub country_code: Option<[u8; ISO_LEN]>,
    /// The user's onchain finalized total points over the tournament.
    pub total_points: i64,
    pub bump: u8,
}
