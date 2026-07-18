//! Program instructions.

pub mod close_accounts;
pub mod commit_score;
pub mod create_friend_league;
pub mod create_player_card;
pub mod create_profile;
pub mod create_sponsor_league;
pub mod init_tournament;
pub mod join_friend_league;
pub mod register_player;
pub mod set_budget;
pub mod set_lineup;
pub mod set_matchday;
pub mod settle_sponsor_league;
pub mod settle_squad_matchday;
pub mod submit_squad;

// Anchor's #[derive(Accounts)] macro generates side modules
// (__client_accounts_*, __cpi_client_accounts_*) for each Context struct, and
// #[program] expects them at crate scope; this is why the glob re-export is
// mandatory. Since each module's `handler` function is called by its full path
// in lib.rs, no conflict occurs.
pub use close_accounts::*;
pub use commit_score::*;
pub use create_friend_league::*;
pub use create_player_card::*;
pub use create_profile::*;
pub use create_sponsor_league::*;
pub use init_tournament::*;
pub use join_friend_league::*;
pub use register_player::*;
pub use set_budget::*;
pub use set_lineup::*;
pub use set_matchday::*;
pub use settle_sponsor_league::*;
pub use settle_squad_matchday::*;
pub use submit_squad::*;
