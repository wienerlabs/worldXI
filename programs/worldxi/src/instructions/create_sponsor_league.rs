//! create_sponsor_league: the sponsor creates a free prize league by depositing the
//! prize into the PDA. There is NO user entry fee (risk-free design: no shared pool/betting).

use crate::constants::{LEAGUE_SEED, MAX_LEAGUE_NAME_LEN};
use crate::errors::WorldXiError;
use crate::state::{SponsorLeague, Tournament};
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateSponsorLeague<'info> {
    pub tournament: Account<'info, Tournament>,

    #[account(
        init,
        payer = sponsor,
        space = 8 + SponsorLeague::INIT_SPACE,
        seeds = [LEAGUE_SEED, tournament.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub league: Account<'info, SponsorLeague>,

    #[account(mut)]
    pub sponsor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateSponsorLeague>,
    name: String,
    prize_lamports: u64,
) -> Result<()> {
    require!(
        name.len() <= MAX_LEAGUE_NAME_LEN,
        WorldXiError::InvalidArgument
    );
    require!(prize_lamports > 0, WorldXiError::InvalidArgument);

    // Transfer the prize from the sponsor to the league PDA (added on top of the rent).
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sponsor.to_account_info(),
                to: ctx.accounts.league.to_account_info(),
            },
        ),
        prize_lamports,
    )?;

    let league = &mut ctx.accounts.league;
    league.tournament = ctx.accounts.tournament.key();
    league.sponsor = ctx.accounts.sponsor.key();
    league.name = name;
    league.prize_lamports = prize_lamports;
    league.settled = false;
    league.winner = Pubkey::default();
    league.bump = ctx.bumps.league;

    msg!(
        "SponsorLeague '{}' created | prize={} lamports",
        league.name,
        prize_lamports
    );
    Ok(())
}
