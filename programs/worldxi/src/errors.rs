//! Program error codes.

use anchor_lang::prelude::*;

#[error_code]
pub enum WorldXiError {
    #[msg("This instruction can only be called by the tournament's oracle.")]
    UnauthorizedOracle,

    #[msg("This instruction can only be called by the tournament authority.")]
    UnauthorizedAuthority,

    #[msg("The squad's total price exceeds the budget.")]
    OverBudget,

    #[msg("The number of players allowed from the same national team was exceeded (maximum 3).")]
    CountryLimitExceeded,

    #[msg("The starting eleven does not fully match the position distribution of the selected formation.")]
    InvalidFormation,

    #[msg("The selected captain is not in the starting eleven.")]
    CaptainNotStarter,

    #[msg("The tournament is currently locked (matchday in progress).")]
    TournamentLocked,

    #[msg("The specified player does not belong to this squad.")]
    PlayerNotOwned,

    #[msg("This matchday has already been calculated (settled).")]
    AlreadySettled,

    #[msg("The nickname exceeds the 24 character limit.")]
    NicknameTooLong,

    #[msg("An arithmetic overflow occurred.")]
    Overflow,

    #[msg("The squad contains a duplicate player; each player can only be selected once.")]
    DuplicatePlayer,

    #[msg("The number of accounts provided does not match the expected count.")]
    AccountCountMismatch,

    #[msg("A provided account does not match the expected PDA.")]
    AccountMismatch,

    #[msg("A starter is not present in the selected pool of 15 players.")]
    StarterNotInSquad,

    #[msg("The input value is invalid.")]
    InvalidArgument,

    #[msg("The sponsor league has already been settled.")]
    LeagueAlreadySettled,

    #[msg("Insufficient balance for the prize transfer.")]
    InsufficientPrizeFunds,
}
