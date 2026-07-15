//! create_player_card: creates the user's PlayerCard (performance mirror) account
//! for a player. It is called with the mint/asset id after the cNFT (Bubblegum) is
//! minted. The card's rarity is copied from the Player account (the user cannot
//! manipulate it). settle_squad_matchday reads this card and accumulates its
//! performance history.
//!
//! NOTE: This instruction was not listed separately in the original spec; however,
//! for settle_squad_matchday to read and update PlayerCard accounts, the cards must
//! already exist on chain. This is the bridge that connects the cNFT mint (off-chain,
//! Metaplex) with the on-chain performance mirror.

use crate::constants::{CARD_SEED, PLAYER_SEED};
use crate::errors::WorldXiError;
use crate::state::{Player, PlayerCard, Tournament};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(player_id: u32)]
pub struct CreatePlayerCard<'info> {
    pub tournament: Account<'info, Tournament>,

    #[account(
        seeds = [PLAYER_SEED, tournament.key().as_ref(), &player_id.to_le_bytes()],
        bump = player.bump,
        constraint = player.tournament == tournament.key() @ WorldXiError::AccountMismatch,
    )]
    pub player: Account<'info, Player>,

    #[account(
        init,
        payer = owner,
        space = 8 + PlayerCard::INIT_SPACE,
        seeds = [CARD_SEED, tournament.key().as_ref(), owner.key().as_ref(), &player_id.to_le_bytes()],
        bump
    )]
    pub card: Account<'info, PlayerCard>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreatePlayerCard>, player_id: u32, mint: Pubkey) -> Result<()> {
    let card = &mut ctx.accounts.card;
    card.tournament = ctx.accounts.tournament.key();
    card.owner = ctx.accounts.owner.key();
    card.player_id = player_id;
    card.rarity = ctx.accounts.player.rarity;
    card.matches_played = 0;
    card.total_points = 0;
    card.mvp_count = 0;
    card.best_single_score = 0;
    card.mint = mint;
    card.bump = ctx.bumps.card;

    msg!(
        "PlayerCard created | owner={} | player={} | mint={}",
        card.owner,
        player_id,
        mint
    );
    Ok(())
}
