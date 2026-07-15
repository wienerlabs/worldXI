//! set_matchday: the oracle sets the active matchday and the lock state.
//!
//! Used by the Matchday Orchestrator: locked=true at the start of a matchday
//! (lineup changes stop), locked=false when the matchday ends. current_matchday
//! serves as the reference for the live feed and settle.

use crate::errors::WorldXiError;
use crate::state::Tournament;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetMatchday<'info> {
    #[account(
        mut,
        has_one = oracle @ WorldXiError::UnauthorizedOracle,
    )]
    pub tournament: Account<'info, Tournament>,

    pub oracle: Signer<'info>,
}

pub fn handler(ctx: Context<SetMatchday>, matchday: u16, locked: bool) -> Result<()> {
    let t = &mut ctx.accounts.tournament;
    t.current_matchday = matchday;
    t.locked = locked;
    msg!("set_matchday | current={} | locked={}", matchday, locked);
    Ok(())
}
