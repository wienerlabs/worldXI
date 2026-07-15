//! submit_squad: submits a squad and performs full on-chain validation.
//!
//! ON-CHAIN VALIDATION:
//!  - 15 players unique, 11 starters unique and a subset of players
//!  - captain among the starters
//!  - total price <= budget
//!  - at most 3 players from the same country
//!  - the starting 11 exactly matches the position distribution of the chosen
//!    formation (1 GK + DEF/MID/FWD)
//!
//! Player accounts are read from remaining_accounts in the same order as `players`,
//! and each one passes PDA validation (no fake account can be passed).

use crate::constants::{MAX_PER_COUNTRY, PLAYER_SEED, SQUAD_SEED, SQUAD_SIZE, STARTERS_SIZE};
use crate::errors::WorldXiError;
use crate::state::{Player, Position, Squad, Tournament};
use crate::utils::load_checked_pda;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SubmitSquad<'info> {
    #[account(mut)]
    pub tournament: Account<'info, Tournament>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + Squad::INIT_SPACE,
        seeds = [SQUAD_SEED, tournament.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub squad: Account<'info, Squad>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
    // remaining_accounts: 15 x Player (in the same order as the players array)
}

pub fn handler(
    ctx: Context<SubmitSquad>,
    players: [u32; SQUAD_SIZE],
    starters: [u32; STARTERS_SIZE],
    formation: crate::state::Formation,
    captain: u32,
) -> Result<()> {
    let tournament_key = ctx.accounts.tournament.key();

    // --- 0) Matchday lock: while a matchday is in progress (locked), a squad
    // cannot be submitted or changed. Otherwise the squad could change during a
    // live matchday and settle integrity would be broken. ---
    require!(
        !ctx.accounts.tournament.locked,
        WorldXiError::TournamentLocked
    );

    // --- 1) players uniqueness ---
    for i in 0..SQUAD_SIZE {
        for j in (i + 1)..SQUAD_SIZE {
            require!(players[i] != players[j], WorldXiError::DuplicatePlayer);
        }
    }

    // --- 2) starters unique and a subset of players ---
    for i in 0..STARTERS_SIZE {
        for j in (i + 1)..STARTERS_SIZE {
            require!(starters[i] != starters[j], WorldXiError::DuplicatePlayer);
        }
        require!(
            players.contains(&starters[i]),
            WorldXiError::StarterNotInSquad
        );
    }

    // --- 3) captain among the starters ---
    require!(
        starters.contains(&captain),
        WorldXiError::CaptainNotStarter
    );

    // --- 4) remaining_accounts = 15 Player, in the same order as players ---
    require!(
        ctx.remaining_accounts.len() == SQUAD_SIZE,
        WorldXiError::AccountCountMismatch
    );

    // player_id -> (position, price, country) map (small fixed-size array)
    let mut positions: [(u32, Position); SQUAD_SIZE] = [(0, Position::Goalkeeper); SQUAD_SIZE];
    let mut total_price: u64 = 0;
    // Simple list for counting countries (max 15 distinct countries)
    let mut country_keys: [[u8; 3]; SQUAD_SIZE] = [[0u8; 3]; SQUAD_SIZE];
    let mut country_counts: [u8; SQUAD_SIZE] = [0u8; SQUAD_SIZE];
    let mut distinct_countries: usize = 0;

    for (i, ai) in ctx.remaining_accounts.iter().enumerate() {
        let seeds: &[&[u8]] = &[
            PLAYER_SEED,
            tournament_key.as_ref(),
            &players[i].to_le_bytes(),
        ];
        let player: Player = load_checked_pda(ai, seeds)?;

        // Confirm the account belongs to the same tournament
        require_keys_eq!(player.tournament, tournament_key, WorldXiError::AccountMismatch);
        require!(player.player_id == players[i], WorldXiError::AccountMismatch);

        positions[i] = (player.player_id, player.position);

        total_price = total_price
            .checked_add(player.price_lamports)
            .ok_or(WorldXiError::Overflow)?;

        // Update the country count
        let mut found = false;
        for c in 0..distinct_countries {
            if country_keys[c] == player.country {
                country_counts[c] = country_counts[c]
                    .checked_add(1)
                    .ok_or(WorldXiError::Overflow)?;
                require!(
                    country_counts[c] <= MAX_PER_COUNTRY,
                    WorldXiError::CountryLimitExceeded
                );
                found = true;
                break;
            }
        }
        if !found {
            country_keys[distinct_countries] = player.country;
            country_counts[distinct_countries] = 1;
            distinct_countries += 1;
        }
    }

    // --- 5) budget ---
    require!(
        total_price <= ctx.accounts.tournament.budget_lamports,
        WorldXiError::OverBudget
    );

    // --- 6) does the starting 11 position distribution match the formation ---
    let (mut gk, mut def, mut mid, mut fwd) = (0u8, 0u8, 0u8, 0u8);
    for &sid in starters.iter() {
        let pos = positions
            .iter()
            .find(|(id, _)| *id == sid)
            .map(|(_, p)| *p)
            .ok_or(WorldXiError::StarterNotInSquad)?;
        match pos {
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

    // --- Save the squad (init_if_needed: create new or update) ---
    let squad = &mut ctx.accounts.squad;
    // New squad? (if owner is not yet set, it is being created for the first time)
    let is_new_squad = squad.owner == Pubkey::default();
    squad.tournament = tournament_key;
    squad.owner = ctx.accounts.owner.key();
    squad.players = players;
    squad.starters = starters;
    squad.formation = formation;
    squad.captain = captain;
    squad.spent_lamports = total_price;
    squad.bump = ctx.bumps.squad;

    // CRITICAL: locked_matchday and total_points are reset ONLY for a new squad.
    // On an update (init_if_needed re-submit) they are PRESERVED - otherwise an
    // already-settled matchday could have its settle lock (matchday > locked_matchday)
    // reopened via resubmit and be settled again, double-counting profile.total_points.
    if is_new_squad {
        squad.locked_matchday = 0;
        squad.total_points = 0;
        let tournament = &mut ctx.accounts.tournament;
        tournament.squad_count = tournament
            .squad_count
            .checked_add(1)
            .ok_or(WorldXiError::Overflow)?;
    }

    msg!(
        "Squad submitted | owner={} | spent={} lamports",
        squad.owner,
        squad.spent_lamports
    );
    Ok(())
}
