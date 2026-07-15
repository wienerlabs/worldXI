//! set_budget: the authority updates the tournament's squad budget.

use crate::errors::WorldXiError;
use crate::state::Tournament;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetBudget<'info> {
    #[account(
        mut,
        has_one = authority @ WorldXiError::UnauthorizedAuthority,
    )]
    pub tournament: Account<'info, Tournament>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<SetBudget>, budget_lamports: u64) -> Result<()> {
    ctx.accounts.tournament.budget_lamports = budget_lamports;
    msg!("Budget updated: {} lamports", budget_lamports);
    Ok(())
}
