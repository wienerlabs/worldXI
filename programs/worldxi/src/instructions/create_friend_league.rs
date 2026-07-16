//! create_friend_league: a user creates a private league with an invite code and
//! becomes its first member. No entry fee, no prize; it is a filtered leaderboard
//! over the same global squads. The (tournament, code) pair derives the league PDA,
//! so each code is unique.

use crate::constants::{
    FRIEND_LEAGUE_SEED, LEAGUE_CODE_LEN, LEAGUE_MEMBER_SEED, MAX_LEAGUE_NAME_LEN,
};
use crate::errors::WorldXiError;
use crate::state::{FriendLeague, LeagueMembership, Tournament};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(code: [u8; LEAGUE_CODE_LEN], name: String)]
pub struct CreateFriendLeague<'info> {
    pub tournament: Account<'info, Tournament>,

    #[account(
        init,
        payer = creator,
        space = 8 + FriendLeague::INIT_SPACE,
        seeds = [FRIEND_LEAGUE_SEED, tournament.key().as_ref(), &code],
        bump
    )]
    pub league: Account<'info, FriendLeague>,

    #[account(
        init,
        payer = creator,
        space = 8 + LeagueMembership::INIT_SPACE,
        seeds = [LEAGUE_MEMBER_SEED, league.key().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub membership: Account<'info, LeagueMembership>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateFriendLeague>,
    code: [u8; LEAGUE_CODE_LEN],
    name: String,
) -> Result<()> {
    require!(!name.is_empty(), WorldXiError::InvalidArgument);
    require!(name.len() <= MAX_LEAGUE_NAME_LEN, WorldXiError::InvalidArgument);

    let league = &mut ctx.accounts.league;
    league.tournament = ctx.accounts.tournament.key();
    league.creator = ctx.accounts.creator.key();
    league.name = name;
    league.code = code;
    league.member_count = 1;
    league.bump = ctx.bumps.league;

    let membership = &mut ctx.accounts.membership;
    membership.league = league.key();
    membership.owner = ctx.accounts.creator.key();
    membership.bump = ctx.bumps.membership;

    msg!(
        "FriendLeague '{}' created by {}",
        league.name,
        league.creator
    );
    Ok(())
}
