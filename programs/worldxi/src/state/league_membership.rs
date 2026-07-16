//! LeagueMembership: proves a wallet is a member of a FriendLeague.
//!
//! One PDA per (league, owner); the account's existence IS the membership. The
//! oracle enumerates memberships for a league to build its private leaderboard.

use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct LeagueMembership {
    /// The friend league this membership belongs to.
    pub league: Pubkey,
    /// The member wallet.
    pub owner: Pubkey,
    pub bump: u8,
}
