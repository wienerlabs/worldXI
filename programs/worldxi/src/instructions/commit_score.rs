//! commit_score: ONLY with the oracle signature. Writes/updates a player's raw
//! score for a matchday and updates player.total_points LIVE.
//!
//! Can be called again on every significant event during a match (goal, card,
//! assist...). With init_if_needed, the ScoreCommit is created on the first call
//! and updated on subsequent calls. player.total_points is adjusted by the
//! difference (delta) between the old and new raw score, so the live leaderboard
//! shows the correct total.

use crate::constants::SCORE_SEED;
use crate::errors::WorldXiError;
use crate::state::{Player, ScoreCommit, Tournament};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(matchday: u16, player_id: u32)]
pub struct CommitScore<'info> {
    #[account(
        has_one = oracle @ WorldXiError::UnauthorizedOracle,
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        mut,
        seeds = [crate::constants::PLAYER_SEED, tournament.key().as_ref(), &player_id.to_le_bytes()],
        bump = player.bump,
        constraint = player.tournament == tournament.key() @ WorldXiError::AccountMismatch,
    )]
    pub player: Account<'info, Player>,

    #[account(
        init_if_needed,
        payer = oracle,
        space = 8 + ScoreCommit::INIT_SPACE,
        seeds = [SCORE_SEED, tournament.key().as_ref(), &matchday.to_le_bytes(), &player_id.to_le_bytes()],
        bump
    )]
    pub score_commit: Account<'info, ScoreCommit>,

    #[account(mut)]
    pub oracle: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CommitScore>,
    matchday: u16,
    player_id: u32,
    raw_points: i32,
    was_mvp: bool,
) -> Result<()> {
    let sc = &mut ctx.accounts.score_commit;

    // Newly created? After init_if_needed the fields are zero.
    let is_new = sc.tournament == Pubkey::default();
    let old_raw: i32 = if is_new { 0 } else { sc.raw_points };

    // Update player.total_points by the delta (live total).
    let delta = (raw_points as i64)
        .checked_sub(old_raw as i64)
        .ok_or(WorldXiError::Overflow)?;
    let player = &mut ctx.accounts.player;
    player.total_points = player
        .total_points
        .checked_add(delta)
        .ok_or(WorldXiError::Overflow)?;

    // Update the ScoreCommit.
    sc.tournament = ctx.accounts.tournament.key();
    sc.matchday = matchday;
    sc.player_id = player_id;
    sc.raw_points = raw_points;
    sc.was_mvp = was_mvp;
    sc.bump = ctx.bumps.score_commit;

    msg!(
        "commit_score | md={} | player={} | raw={} (delta {}) | mvp={}",
        matchday,
        player_id,
        raw_points,
        delta,
        was_mvp
    );
    Ok(())
}
