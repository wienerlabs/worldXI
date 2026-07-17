//! settle_squad_matchday: writes a matchday's final total to the chain.
//!
//! For each of the effective starting 11, (ScoreCommit, PlayerCard) pairs are
//! passed in remaining_accounts (if a starter did not play, the client passes the
//! substitute at the same position). For each player:
//!   final = raw_points * rarity_bonus_bps / 10000, and * 2 if captain
//! The total is applied to squad.total_points, the PlayerCard history, and
//! UserProfile.total_points.
//!
//! Authority: ONLY the tournament oracle may settle (crank == tournament.oracle).
//! A permissionless crank let anyone lock a victim's matchday with a partial /
//! worst-case account set, permanently denying their real points; gating to the
//! oracle removes that grief vector and the "field my best 11 of 15" abuse.
//! Idempotency: the per-matchday SquadSnapshot PDA (init) guarantees a matchday is
//! settled exactly once, in any order (a late matchday can no longer lock out an
//! earlier one).

use crate::constants::{
    BPS_DENOMINATOR, CAPTAIN_MULTIPLIER, CARD_SEED, SCORE_SEED, SNAPSHOT_SEED, STARTERS_SIZE,
};
use crate::errors::WorldXiError;
use crate::state::{PlayerCard, ScoreCommit, Squad, SquadSnapshot, Tournament, UserProfile};
use crate::utils::{load_checked_pda, store_account};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(matchday: u16)]
pub struct SettleSquadMatchday<'info> {
    #[account(
        constraint = squad.tournament == tournament.key() @ WorldXiError::AccountMismatch,
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        mut,
        has_one = tournament @ WorldXiError::AccountMismatch,
    )]
    pub squad: Account<'info, Squad>,

    #[account(
        mut,
        seeds = [crate::constants::PROFILE_SEED, squad.owner.as_ref()],
        bump = profile.bump,
        constraint = profile.owner == squad.owner @ WorldXiError::AccountMismatch,
    )]
    pub profile: Account<'info, UserProfile>,

    /// Snapshot of the lineup used for this matchday (created here, once per matchday).
    #[account(
        init,
        payer = crank,
        space = 8 + SquadSnapshot::INIT_SPACE,
        seeds = [SNAPSHOT_SEED, squad.owner.as_ref(), &matchday.to_le_bytes()],
        bump
    )]
    pub snapshot: Account<'info, SquadSnapshot>,

    /// Fee payer AND authority: only the tournament oracle may settle a squad's matchday.
    #[account(mut, address = tournament.oracle @ WorldXiError::UnauthorizedOracle)]
    pub crank: Signer<'info>,

    pub system_program: Program<'info, System>,
    // remaining_accounts: (ScoreCommit, PlayerCard) pairs for each effective starter
}

pub fn handler(ctx: Context<SettleSquadMatchday>, matchday: u16) -> Result<()> {
    // The matchday must be finished (not in progress) and not in the future. Settling a
    // still-locked / not-yet-reached matchday would freeze the squad on partial commit data.
    require!(
        !ctx.accounts.tournament.locked,
        WorldXiError::TournamentLocked
    );
    require!(
        matchday <= ctx.accounts.tournament.current_matchday,
        WorldXiError::InvalidArgument
    );
    // Idempotency is enforced by the per-matchday SquadSnapshot PDA below (its `init` fails
    // if this matchday was already settled). This allows settling matchdays in ANY order,
    // each exactly once - a later matchday can no longer permanently lock out an earlier one.

    let tournament_key = ctx.accounts.tournament.key();
    let squad_owner = ctx.accounts.squad.owner;
    let captain = ctx.accounts.squad.captain;
    let squad_players = ctx.accounts.squad.players;
    // Capture the lineup now (before the mutable borrow below) for the matchday snapshot.
    let squad_starters = ctx.accounts.squad.starters;
    let squad_formation = ctx.accounts.squad.formation.clone();

    let accs = ctx.remaining_accounts;
    // Empty-settle guard (griefing): at least 1 player (2 accounts) must be processed.
    // Otherwise the permissionless crank could be called with an empty account list to
    // lock a squad's matchday "with 0 points" (locked_matchday = matchday) and prevent
    // it from being settled again.
    require!(accs.len() >= 2, WorldXiError::AccountCountMismatch);
    // A (ScoreCommit, PlayerCard) pair per player -> an even number of accounts.
    require!(
        accs.len().is_multiple_of(2),
        WorldXiError::AccountCountMismatch
    );
    // CRITICAL: at most STARTERS_SIZE (11) effective players can be processed.
    // Otherwise the score could be inflated by passing extra accounts.
    require!(
        accs.len() / 2 <= STARTERS_SIZE,
        WorldXiError::AccountCountMismatch
    );

    // Duplicate protection: the same player_id cannot be counted twice (prevents the
    // permissionless crank from passing the same high-scoring player N times to inflate
    // the total).
    let mut seen: [u32; STARTERS_SIZE] = [0u32; STARTERS_SIZE];
    let mut seen_count: usize = 0;

    let mut matchday_total: i128 = 0;

    let mut idx = 0;
    while idx < accs.len() {
        let sc_ai = &accs[idx];
        let card_ai = &accs[idx + 1];

        // --- Load + validate ScoreCommit ---
        // To safely obtain the player_id from the ScoreCommit, we first load it, then
        // confirm the account itself via the derived PDA.
        let sc: ScoreCommit = {
            require_keys_eq!(*sc_ai.owner, crate::ID, WorldXiError::AccountMismatch);
            let data = sc_ai.try_borrow_data()?;
            let mut slice: &[u8] = &data;
            ScoreCommit::try_deserialize(&mut slice)?
        };
        let sc_seeds: &[&[u8]] = &[
            SCORE_SEED,
            tournament_key.as_ref(),
            &matchday.to_le_bytes(),
            &sc.player_id.to_le_bytes(),
        ];
        let (expected_sc, _b) = Pubkey::find_program_address(sc_seeds, &crate::ID);
        require_keys_eq!(expected_sc, sc_ai.key(), WorldXiError::AccountMismatch);
        require_keys_eq!(sc.tournament, tournament_key, WorldXiError::AccountMismatch);
        require!(sc.matchday == matchday, WorldXiError::AccountMismatch);

        // The player must be in this squad's pool (11 + 4 substitutes).
        require!(
            squad_players.contains(&sc.player_id),
            WorldXiError::StarterNotInSquad
        );

        // Duplicate protection: this player must not have been processed earlier in this settle.
        for i in 0..seen_count {
            require!(seen[i] != sc.player_id, WorldXiError::DuplicatePlayer);
        }
        seen[seen_count] = sc.player_id;
        seen_count += 1;

        // --- Load + validate PlayerCard ---
        let card_seeds: &[&[u8]] = &[
            CARD_SEED,
            tournament_key.as_ref(),
            squad_owner.as_ref(),
            &sc.player_id.to_le_bytes(),
        ];
        let mut card: PlayerCard = load_checked_pda(card_ai, card_seeds)?;
        require_keys_eq!(card.owner, squad_owner, WorldXiError::AccountMismatch);
        require!(
            card.player_id == sc.player_id,
            WorldXiError::AccountMismatch
        );

        // --- Score calculation: rarity bonus, then captain multiplier ---
        let base = sc.raw_points as i128;
        let rarity_adjusted = base
            .checked_mul(card.rarity.bonus_bps() as i128)
            .ok_or(WorldXiError::Overflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(WorldXiError::Overflow)?;
        let final_pts = if sc.player_id == captain {
            rarity_adjusted
                .checked_mul(CAPTAIN_MULTIPLIER)
                .ok_or(WorldXiError::Overflow)?
        } else {
            rarity_adjusted
        };

        matchday_total = matchday_total
            .checked_add(final_pts)
            .ok_or(WorldXiError::Overflow)?;

        // --- Update the card history ---
        let final_i64 = i64::try_from(final_pts).map_err(|_| WorldXiError::Overflow)?;
        card.matches_played = card
            .matches_played
            .checked_add(1)
            .ok_or(WorldXiError::Overflow)?;
        card.total_points = card
            .total_points
            .checked_add(final_i64)
            .ok_or(WorldXiError::Overflow)?;
        if sc.was_mvp {
            card.mvp_count = card
                .mvp_count
                .checked_add(1)
                .ok_or(WorldXiError::Overflow)?;
        }
        // Clamp into i32 range (best_single_score is i32) instead of reverting the whole
        // settle on an unusually large score.
        let final_i32 = final_pts.clamp(i32::MIN as i128, i32::MAX as i128) as i32;
        if final_i32 > card.best_single_score {
            card.best_single_score = final_i32;
        }

        store_account(card_ai, &card)?;

        idx += 2;
    }

    let total_i64 = i64::try_from(matchday_total).map_err(|_| WorldXiError::Overflow)?;

    let squad = &mut ctx.accounts.squad;
    squad.total_points = squad
        .total_points
        .checked_add(total_i64)
        .ok_or(WorldXiError::Overflow)?;
    // Track the highest settled matchday (informational). Idempotency comes from the
    // SquadSnapshot PDA, so this must not decrease when matchdays settle out of order.
    squad.locked_matchday = matchday.max(squad.locked_matchday);

    let profile = &mut ctx.accounts.profile;
    profile.total_points = profile
        .total_points
        .checked_add(total_i64)
        .ok_or(WorldXiError::Overflow)?;

    // Preserve this matchday's lineup + points so it stays viewable later, even after the
    // manager changes their active lineup for the next matchday.
    let snapshot = &mut ctx.accounts.snapshot;
    snapshot.owner = squad_owner;
    snapshot.matchday = matchday;
    snapshot.starters = squad_starters;
    snapshot.captain = captain;
    snapshot.formation = squad_formation;
    snapshot.points = total_i64;
    snapshot.bump = ctx.bumps.snapshot;

    msg!(
        "settle | md={} | owner={} | matchday_total={} | squad_total={}",
        matchday,
        squad_owner,
        total_i64,
        squad.total_points
    );
    Ok(())
}
