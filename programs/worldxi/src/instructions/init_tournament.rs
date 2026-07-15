//! init_tournament: the authority sets up the tournament, the oracle, and the budget.

use crate::constants::{MAX_TOURNAMENT_NAME_LEN, TOURNAMENT_SEED};
use crate::errors::WorldXiError;
use crate::state::Tournament;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitTournament<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Tournament::INIT_SPACE,
        seeds = [TOURNAMENT_SEED, name.as_bytes()],
        bump
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitTournament>,
    name: String,
    budget_lamports: u64,
    oracle: Pubkey,
) -> Result<()> {
    require!(
        name.len() <= MAX_TOURNAMENT_NAME_LEN,
        WorldXiError::InvalidArgument
    );

    let t = &mut ctx.accounts.tournament;
    t.authority = ctx.accounts.authority.key();
    t.oracle = oracle;
    t.name = name;
    t.budget_lamports = budget_lamports;
    t.current_matchday = 0;
    t.locked = false;
    t.squad_count = 0;
    t.bump = ctx.bumps.tournament;

    msg!(
        "Tournament '{}' created | budget={} lamports | oracle={}",
        t.name,
        t.budget_lamports,
        t.oracle
    );
    Ok(())
}
