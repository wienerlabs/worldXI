//! FriendLeague: a private, invite-code league where friends compete among themselves.
//!
//! There is no entry fee and no prize pool: a friend league is purely a filtered
//! leaderboard over the same global squads and scoring. Membership is on-chain (one
//! LeagueMembership account per member). The invite code is shared off-chain so a
//! friend can derive the league PDA and join.

use crate::constants::{LEAGUE_CODE_LEN, MAX_LEAGUE_NAME_LEN};
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct FriendLeague {
    /// The tournament it belongs to.
    pub tournament: Pubkey,
    /// The wallet that created the league (also its first member).
    pub creator: Pubkey,
    /// Human-readable league name.
    #[max_len(MAX_LEAGUE_NAME_LEN)]
    pub name: String,
    /// Invite code shared with friends; also used as a PDA seed.
    pub code: [u8; LEAGUE_CODE_LEN],
    /// Number of members who have joined.
    pub member_count: u32,
    pub bump: u8,
}
