//! SquadSnapshot: the exact lineup a manager used for a given matchday, captured at
//! settle time.
//!
//! The live Squad account only holds the ACTIVE lineup (set_lineup overwrites it). This
//! snapshot preserves, per (owner, matchday), the starting 11 + captain + formation that
//! were in play, plus the points that lineup scored, so each matchday's squad and result
//! stay viewable later even after the manager changes their lineup for the next matchday.

use crate::constants::STARTERS_SIZE;
use crate::state::enums::Formation;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SquadSnapshot {
    /// The manager wallet this snapshot belongs to.
    pub owner: Pubkey,
    /// The matchday this snapshot captures.
    pub matchday: u16,
    /// The starting 11 that were in play for this matchday.
    pub starters: [u32; STARTERS_SIZE],
    /// The captain for this matchday.
    pub captain: u32,
    /// The formation used for this matchday.
    pub formation: Formation,
    /// Points this lineup scored in this matchday (rarity bonus + captain applied).
    pub points: i64,
    pub bump: u8,
}
