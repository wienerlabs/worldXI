//! Account closing: lets a user delete their OWN data and reclaim the rent.
//!
//! Every instruction here is gated by `has_one = owner` plus an `owner` signature, so a
//! wallet can only ever close accounts it owns. The `close = owner` constraint zeroes the
//! account and refunds its lamports to that wallet.
//!
//! League membership is deliberately NOT closable: joining a friend league is permanent by
//! design, so there is no "leave the league" path.

use crate::errors::WorldXiError;
use crate::state::{PlayerCard, Squad, SquadSnapshot, UserProfile};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseSquad<'info> {
    #[account(mut, close = owner, has_one = owner @ WorldXiError::AccountMismatch)]
    pub squad: Account<'info, Squad>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn close_squad(ctx: Context<CloseSquad>) -> Result<()> {
    msg!("squad closed | owner={}", ctx.accounts.owner.key());
    Ok(())
}

#[derive(Accounts)]
pub struct ClosePlayerCard<'info> {
    #[account(mut, close = owner, has_one = owner @ WorldXiError::AccountMismatch)]
    pub card: Account<'info, PlayerCard>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn close_player_card(ctx: Context<ClosePlayerCard>) -> Result<()> {
    msg!(
        "player card closed | owner={} | player={}",
        ctx.accounts.owner.key(),
        ctx.accounts.card.player_id
    );
    Ok(())
}

#[derive(Accounts)]
pub struct CloseSquadSnapshot<'info> {
    #[account(mut, close = owner, has_one = owner @ WorldXiError::AccountMismatch)]
    pub snapshot: Account<'info, SquadSnapshot>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn close_squad_snapshot(ctx: Context<CloseSquadSnapshot>) -> Result<()> {
    msg!(
        "snapshot closed | owner={} | matchday={}",
        ctx.accounts.owner.key(),
        ctx.accounts.snapshot.matchday
    );
    Ok(())
}

#[derive(Accounts)]
pub struct CloseProfile<'info> {
    #[account(mut, close = owner, has_one = owner @ WorldXiError::AccountMismatch)]
    pub profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn close_profile(ctx: Context<CloseProfile>) -> Result<()> {
    msg!("profile closed | owner={}", ctx.accounts.owner.key());
    Ok(())
}
