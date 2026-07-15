//! Tournament root account: authority, oracle, budget, and matchday state.

use crate::constants::MAX_TOURNAMENT_NAME_LEN;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Tournament {
    /// The authority that manages the tournament (register_player, settle_sponsor_league, etc.).
    pub authority: Pubkey,
    /// The sole authorized signer for commit_score (the oracle backend keypair).
    pub oracle: Pubkey,
    /// Human-readable tournament name; also used as a PDA seed.
    #[max_len(MAX_TOURNAMENT_NAME_LEN)]
    pub name: String,
    /// Squad-building budget (virtual SOL in lamports; 10 SOL = 10_000_000_000).
    pub budget_lamports: u64,
    /// The active matchday number.
    pub current_matchday: u16,
    /// True while a matchday is in progress; locks lineup changes.
    pub locked: bool,
    /// Number of squads created in this tournament.
    pub squad_count: u64,
    pub bump: u8,
}
