//! WorldXI - a 2026 World Cup themed, onchain fantasy football game.
//!
//! Anchor program: manages tournament, player, squad, living card (PlayerCard),
//! live score commit and sponsor prize league accounts. Points are written to
//! the chain live DURING the match (commit_score) and are finalized at the end
//! of the matchday (settle_squad_matchday).

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use constants::{SQUAD_SIZE, STARTERS_SIZE};
use instructions::*;
use state::{Formation, Position, Rarity};

declare_id!("A5dEqv3cB8tpxT1vQ6WTc88hC5vSvE6unSQvWodMvAfL");

#[program]
pub mod worldxi {
    use super::*;

    /// Sets up the tournament, the oracle and the squad budget.
    pub fn init_tournament(
        ctx: Context<InitTournament>,
        name: String,
        budget_lamports: u64,
        oracle: Pubkey,
    ) -> Result<()> {
        instructions::init_tournament::handler(ctx, name, budget_lamports, oracle)
    }

    /// Registers a player with their tier price and rarity (authority only).
    pub fn register_player(
        ctx: Context<RegisterPlayer>,
        player_id: u32,
        name: String,
        country: [u8; 3],
        position: Position,
        rarity: Rarity,
        price_lamports: u64,
    ) -> Result<()> {
        instructions::register_player::handler(
            ctx,
            player_id,
            name,
            country,
            position,
            rarity,
            price_lamports,
        )
    }

    /// Creates a user profile (nickname + optional country).
    pub fn create_profile(
        ctx: Context<CreateProfile>,
        nickname: String,
        country_code: Option<[u8; 3]>,
    ) -> Result<()> {
        instructions::create_profile::handler(ctx, nickname, country_code)
    }

    /// Submits a squad and performs full validation on chain.
    pub fn submit_squad(
        ctx: Context<SubmitSquad>,
        players: [u32; SQUAD_SIZE],
        starters: [u32; STARTERS_SIZE],
        formation: Formation,
        captain: u32,
    ) -> Result<()> {
        instructions::submit_squad::handler(ctx, players, starters, formation, captain)
    }

    /// Changes the formation / starting eleven / captain before the matchday.
    pub fn set_lineup(
        ctx: Context<SetLineup>,
        starters: [u32; STARTERS_SIZE],
        formation: Formation,
        captain: u32,
    ) -> Result<()> {
        instructions::set_lineup::handler(ctx, starters, formation, captain)
    }

    /// Oracle: sets the active matchday and the lock state.
    pub fn set_matchday(ctx: Context<SetMatchday>, matchday: u16, locked: bool) -> Result<()> {
        instructions::set_matchday::handler(ctx, matchday, locked)
    }

    /// Authority: updates the tournament's squad budget.
    pub fn set_budget(ctx: Context<SetBudget>, budget_lamports: u64) -> Result<()> {
        instructions::set_budget::handler(ctx, budget_lamports)
    }

    /// Oracle: writes/updates a player's raw matchday points live.
    pub fn commit_score(
        ctx: Context<CommitScore>,
        matchday: u16,
        player_id: u32,
        raw_points: i32,
        was_mvp: bool,
    ) -> Result<()> {
        instructions::commit_score::handler(ctx, matchday, player_id, raw_points, was_mvp)
    }

    /// Creates the user's PlayerCard (a cNFT performance mirror) for a player.
    pub fn create_player_card(
        ctx: Context<CreatePlayerCard>,
        player_id: u32,
        mint: Pubkey,
    ) -> Result<()> {
        instructions::create_player_card::handler(ctx, player_id, mint)
    }

    /// Writes the matchday's final total to the chain (rarity bonus + captain 2x).
    pub fn settle_squad_matchday(ctx: Context<SettleSquadMatchday>, matchday: u16) -> Result<()> {
        instructions::settle_squad_matchday::handler(ctx, matchday)
    }

    /// The sponsor creates a free prize league by depositing the prize into a PDA.
    pub fn create_sponsor_league(
        ctx: Context<CreateSponsorLeague>,
        name: String,
        prize_lamports: u64,
    ) -> Result<()> {
        instructions::create_sponsor_league::handler(ctx, name, prize_lamports)
    }

    /// The authority enters the winner and the prize is sent from the PDA to the winner.
    pub fn settle_sponsor_league(ctx: Context<SettleSponsorLeague>) -> Result<()> {
        instructions::settle_sponsor_league::handler(ctx)
    }
}
