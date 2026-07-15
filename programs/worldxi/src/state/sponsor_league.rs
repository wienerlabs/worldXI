//! SponsorLeague: a prize league funded by a sponsor.
//!
//! There is NO user entry fee (risk-free design: no shared pool/betting).
//! The prize is deposited entirely by the sponsor into the PDA and sent to the
//! winner determined from the leaderboard.

use crate::constants::MAX_LEAGUE_NAME_LEN;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SponsorLeague {
    /// The tournament it belongs to.
    pub tournament: Pubkey,
    /// The sponsor wallet funding the prize.
    pub sponsor: Pubkey,
    /// League name; also used as a PDA seed.
    #[max_len(MAX_LEAGUE_NAME_LEN)]
    pub name: String,
    /// The prize amount held in the PDA (lamports).
    pub prize_lamports: u64,
    /// Whether the prize has been distributed.
    pub settled: bool,
    /// The winning wallet (filled in after settle).
    pub winner: Pubkey,
    pub bump: u8,
}
