//! Program enums: position, formation, and rarity.

use anchor_lang::prelude::*;

/// Player field position.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Position {
    Goalkeeper,
    Defender,
    Midfielder,
    Forward,
}

/// Formation; each has a fixed 1 goalkeeper plus a varying DEF/MID/FWD distribution.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Formation {
    F433,
    F442,
    F352,
    F343,
    F532,
    F541,
    F451,
}

impl Formation {
    /// Returns the (defender, midfielder, forward) counts. The goalkeeper is always 1.
    pub fn outfield_counts(&self) -> (u8, u8, u8) {
        match self {
            Formation::F433 => (4, 3, 3),
            Formation::F442 => (4, 4, 2),
            Formation::F352 => (3, 5, 2),
            Formation::F343 => (3, 4, 3),
            Formation::F532 => (5, 3, 2),
            Formation::F541 => (5, 4, 1),
            Formation::F451 => (4, 5, 1),
        }
    }

    pub fn defenders(&self) -> u8 {
        self.outfield_counts().0
    }
    pub fn midfielders(&self) -> u8 {
        self.outfield_counts().1
    }
    pub fn forwards(&self) -> u8 {
        self.outfield_counts().2
    }
}

/// Card rarity; determines the point bonus applied during settle (basis points).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Rarity {
    Common,
    Rare,
    Legendary,
}

impl Rarity {
    /// Rarity point multiplier, in basis points (10000 = 1.00x, no bonus).
    pub fn bonus_bps(&self) -> u16 {
        match self {
            Rarity::Common => 10_000,
            Rarity::Rare => 10_500,
            Rarity::Legendary => 11_000,
        }
    }
}
