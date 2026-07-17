//! set_lineup: changes the formation / starting 11 / captain before a matchday.
//! Rejected if the tournament is locked (i.e. a matchday is in progress).
//!
//! The position distribution of the new starting 11 must exactly match the chosen
//! formation; that is why the 11 starter Player accounts are passed via
//! remaining_accounts and go through PDA validation.

use crate::constants::{PLAYER_SEED, STARTERS_SIZE};
use crate::errors::WorldXiError;
use crate::state::{Formation, Player, Position, Squad, Tournament};
use crate::utils::load_checked_pda;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetLineup<'info> {
    pub tournament: Account<'info, Tournament>,

    #[account(
        mut,
        has_one = owner @ WorldXiError::PlayerNotOwned,
        has_one = tournament @ WorldXiError::AccountMismatch,
    )]
    pub squad: Account<'info, Squad>,

    pub owner: Signer<'info>,
    // remaining_accounts: 11 x Player (in the same order as starters)
}

pub fn handler(
    ctx: Context<SetLineup>,
    starters: [u32; STARTERS_SIZE],
    formation: Formation,
    captain: u32,
) -> Result<()> {
    // If a matchday is in progress, the lineup is locked.
    require!(
        !ctx.accounts.tournament.locked,
        WorldXiError::TournamentLocked
    );

    let squad = &ctx.accounts.squad;
    let tournament_key = ctx.accounts.tournament.key();

    // starters unique + a subset of squad.players
    for i in 0..STARTERS_SIZE {
        for j in (i + 1)..STARTERS_SIZE {
            require!(starters[i] != starters[j], WorldXiError::DuplicatePlayer);
        }
        require!(
            squad.players.contains(&starters[i]),
            WorldXiError::StarterNotInSquad
        );
    }

    // captain among the starters
    require!(starters.contains(&captain), WorldXiError::CaptainNotStarter);

    // Position distribution: 11 starter Player accounts were passed
    require!(
        ctx.remaining_accounts.len() == STARTERS_SIZE,
        WorldXiError::AccountCountMismatch
    );

    let (mut gk, mut def, mut mid, mut fwd) = (0u8, 0u8, 0u8, 0u8);
    for (i, ai) in ctx.remaining_accounts.iter().enumerate() {
        let seeds: &[&[u8]] = &[
            PLAYER_SEED,
            tournament_key.as_ref(),
            &starters[i].to_le_bytes(),
        ];
        let player: Player = load_checked_pda(ai, seeds)?;
        require!(
            player.player_id == starters[i],
            WorldXiError::AccountMismatch
        );
        match player.position {
            Position::Goalkeeper => gk += 1,
            Position::Defender => def += 1,
            Position::Midfielder => mid += 1,
            Position::Forward => fwd += 1,
        }
    }
    let (rd, rm, rf) = formation.outfield_counts();
    require!(
        gk == 1 && def == rd && mid == rm && fwd == rf,
        WorldXiError::InvalidFormation
    );

    // Apply
    let squad = &mut ctx.accounts.squad;
    squad.starters = starters;
    squad.formation = formation;
    squad.captain = captain;
    Ok(())
}
