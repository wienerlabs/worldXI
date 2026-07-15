//! create_profile: the user creates a profile with a nickname and an optional country.
//! Nickname uniqueness is not required; the identity is the wallet address.

use crate::constants::{ISO_LEN, MAX_NICKNAME_LEN, PROFILE_SEED};
use crate::errors::WorldXiError;
use crate::state::UserProfile;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [PROFILE_SEED, owner.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateProfile>,
    nickname: String,
    country_code: Option<[u8; ISO_LEN]>,
) -> Result<()> {
    require!(
        nickname.len() <= MAX_NICKNAME_LEN,
        WorldXiError::NicknameTooLong
    );

    let profile = &mut ctx.accounts.profile;
    profile.owner = ctx.accounts.owner.key();
    profile.nickname = nickname;
    profile.country_code = country_code;
    profile.total_points = 0;
    profile.bump = ctx.bumps.profile;
    Ok(())
}
