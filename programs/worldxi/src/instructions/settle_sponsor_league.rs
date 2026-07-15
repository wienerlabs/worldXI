//! settle_sponsor_league: the authority enters the winner determined from the
//! leaderboard, and the prize is sent from the PDA to the winner.

use crate::constants::LEAGUE_SEED;
use crate::errors::WorldXiError;
use crate::state::{SponsorLeague, Tournament};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SettleSponsorLeague<'info> {
    #[account(
        has_one = authority @ WorldXiError::UnauthorizedAuthority,
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        mut,
        seeds = [LEAGUE_SEED, tournament.key().as_ref(), league.name.as_bytes()],
        bump = league.bump,
        has_one = tournament @ WorldXiError::AccountMismatch,
    )]
    pub league: Account<'info, SponsorLeague>,

    pub authority: Signer<'info>,

    /// Winner wallet; the prize is sent here.
    /// CHECK: only a lamport recipient; determined by the authority from the leaderboard.
    #[account(mut)]
    pub winner: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SettleSponsorLeague>) -> Result<()> {
    require!(
        !ctx.accounts.league.settled,
        WorldXiError::LeagueAlreadySettled
    );

    let prize = ctx.accounts.league.prize_lamports;
    let league_ai = ctx.accounts.league.to_account_info();
    let winner_ai = ctx.accounts.winner.to_account_info();

    // Since the league PDA is owned by the program, we can move the lamports directly.
    // The rent-exempt minimum is preserved (the prize was deposited on top of the rent).
    let league_balance = league_ai.lamports();
    require!(
        league_balance >= prize,
        WorldXiError::InsufficientPrizeFunds
    );

    **league_ai.try_borrow_mut_lamports()? = league_balance
        .checked_sub(prize)
        .ok_or(WorldXiError::Overflow)?;
    **winner_ai.try_borrow_mut_lamports()? = winner_ai
        .lamports()
        .checked_add(prize)
        .ok_or(WorldXiError::Overflow)?;

    let league = &mut ctx.accounts.league;
    league.settled = true;
    league.winner = ctx.accounts.winner.key();
    league.prize_lamports = 0;

    msg!(
        "SponsorLeague '{}' settled | winner={} | prize={} lamports",
        league.name,
        league.winner,
        prize
    );
    Ok(())
}
