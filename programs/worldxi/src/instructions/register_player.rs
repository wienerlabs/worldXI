//! register_player: only the authority registers a player at the tier price.

use crate::constants::{ISO_LEN, MAX_PLAYER_NAME_LEN, PLAYER_SEED};
use crate::errors::WorldXiError;
use crate::state::{Player, Position, Rarity, Tournament};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(player_id: u32)]
pub struct RegisterPlayer<'info> {
    #[account(
        has_one = authority @ WorldXiError::UnauthorizedAuthority,
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        init,
        payer = authority,
        space = 8 + Player::INIT_SPACE,
        seeds = [PLAYER_SEED, tournament.key().as_ref(), &player_id.to_le_bytes()],
        bump
    )]
    pub player: Account<'info, Player>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterPlayer>,
    player_id: u32,
    name: String,
    country: [u8; ISO_LEN],
    position: Position,
    rarity: Rarity,
    price_lamports: u64,
) -> Result<()> {
    require!(
        name.len() <= MAX_PLAYER_NAME_LEN,
        WorldXiError::InvalidArgument
    );

    let p = &mut ctx.accounts.player;
    p.tournament = ctx.accounts.tournament.key();
    p.player_id = player_id;
    p.name = name;
    p.country = country;
    p.position = position;
    p.rarity = rarity;
    p.price_lamports = price_lamports;
    p.total_points = 0;
    p.bump = ctx.bumps.player;
    Ok(())
}
