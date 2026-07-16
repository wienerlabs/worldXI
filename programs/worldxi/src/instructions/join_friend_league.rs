//! join_friend_league: a user joins an existing friend league using its invite code.
//! The client derives the league PDA from (tournament, code) and passes it in; a
//! LeagueMembership PDA is created. A duplicate join fails because the membership PDA
//! already exists.

use crate::constants::LEAGUE_MEMBER_SEED;
use crate::errors::WorldXiError;
use crate::state::{FriendLeague, LeagueMembership};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct JoinFriendLeague<'info> {
    #[account(mut)]
    pub league: Account<'info, FriendLeague>,

    #[account(
        init,
        payer = owner,
        space = 8 + LeagueMembership::INIT_SPACE,
        seeds = [LEAGUE_MEMBER_SEED, league.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub membership: Account<'info, LeagueMembership>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<JoinFriendLeague>) -> Result<()> {
    let membership = &mut ctx.accounts.membership;
    membership.league = ctx.accounts.league.key();
    membership.owner = ctx.accounts.owner.key();
    membership.bump = ctx.bumps.membership;

    let league = &mut ctx.accounts.league;
    league.member_count = league
        .member_count
        .checked_add(1)
        .ok_or(WorldXiError::Overflow)?;

    msg!("{} joined FriendLeague '{}'", membership.owner, league.name);
    Ok(())
}
