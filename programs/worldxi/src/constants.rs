//! Program-wide constants and PDA seed prefixes.
//!
//! All seeds are defined in one place; instructions and tests share them
//! so that PDA derivation stays perfectly consistent with the client side.

/// Total number of players in a squad (11 starters + 4 substitutes).
pub const SQUAD_SIZE: usize = 15;
/// Number of players in the starting lineup (starters).
pub const STARTERS_SIZE: usize = 11;
/// Maximum number of players from the same national team allowed in a squad.
pub const MAX_PER_COUNTRY: u8 = 3;
/// Length of an ISO 3166-1 alpha-3 country code (e.g. "TUR").
pub const ISO_LEN: usize = 3;

/// Maximum length (in bytes) for a user nickname.
pub const MAX_NICKNAME_LEN: usize = 24;
/// Maximum length for a tournament name (stays within the 32-byte PDA seed limit).
pub const MAX_TOURNAMENT_NAME_LEN: usize = 32;
/// Maximum length for a sponsor or friend league name.
pub const MAX_LEAGUE_NAME_LEN: usize = 32;
/// Length of a friend-league invite code (shared with friends to join).
pub const LEAGUE_CODE_LEN: usize = 6;
/// Maximum length for a player name.
pub const MAX_PLAYER_NAME_LEN: usize = 40;

// --- PDA seed prefixes ---
pub const TOURNAMENT_SEED: &[u8] = b"tournament";
pub const PLAYER_SEED: &[u8] = b"player";
pub const SQUAD_SEED: &[u8] = b"squad";
pub const SCORE_SEED: &[u8] = b"score";
pub const LEAGUE_SEED: &[u8] = b"league";
pub const FRIEND_LEAGUE_SEED: &[u8] = b"friend_league";
pub const LEAGUE_MEMBER_SEED: &[u8] = b"league_member";
pub const PROFILE_SEED: &[u8] = b"profile";
pub const CARD_SEED: &[u8] = b"card";
pub const SNAPSHOT_SEED: &[u8] = b"snapshot";

/// Base for rarity bonus multipliers (10000 bps = 100%, no multiplier).
pub const BPS_DENOMINATOR: i128 = 10_000;
/// Captain points multiplier (2x).
pub const CAPTAIN_MULTIPLIER: i128 = 2;
