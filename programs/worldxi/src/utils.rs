//! Helpers for safely loading and validating PDA accounts passed via
//! remaining_accounts. submit_squad, set_lineup and settle_squad_matchday use this.

use crate::errors::WorldXiError;
use anchor_lang::prelude::*;

/// Verifies that the given AccountInfo is owned by the program and matches the
/// expected PDA address, then deserializes the account into `T`.
///
/// This prevents an attacker from passing a fake account or one belonging to another program.
pub fn load_checked_pda<'info, T: AccountDeserialize>(
    ai: &AccountInfo<'info>,
    seeds: &[&[u8]],
) -> Result<T> {
    // Program ownership check (deserialize also confirms via the discriminator).
    require_keys_eq!(*ai.owner, crate::ID, WorldXiError::AccountMismatch);

    // Derive the expected PDA address and verify the match.
    let (expected, _bump) = Pubkey::find_program_address(seeds, &crate::ID);
    require_keys_eq!(expected, ai.key(), WorldXiError::AccountMismatch);

    let data = ai.try_borrow_data()?;
    let mut slice: &[u8] = &data;
    let parsed = T::try_deserialize(&mut slice)?;
    Ok(parsed)
}

/// Writes back an account that was loaded and modified via `load_checked_pda`.
/// The account must be mutable (writable).
pub fn store_account<'info, T: AccountSerialize>(ai: &AccountInfo<'info>, value: &T) -> Result<()> {
    let mut data = ai.try_borrow_mut_data()?;
    let mut slice: &mut [u8] = &mut data;
    value.try_serialize(&mut slice)?;
    Ok(())
}
