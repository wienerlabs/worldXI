/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/worldxi.json`.
 */
export type Worldxi = {
  "address": "A5dEqv3cB8tpxT1vQ6WTc88hC5vSvE6unSQvWodMvAfL",
  "metadata": {
    "name": "worldxi",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "commitScore",
      "docs": [
        "Oracle: writes/updates a player's live matchday raw score."
      ],
      "discriminator": [
        6,
        174,
        240,
        11,
        32,
        12,
        177,
        66
      ],
      "accounts": [
        {
          "name": "tournament"
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              },
              {
                "kind": "arg",
                "path": "playerId"
              }
            ]
          }
        },
        {
          "name": "scoreCommit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  99,
                  111,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              },
              {
                "kind": "arg",
                "path": "matchday"
              },
              {
                "kind": "arg",
                "path": "playerId"
              }
            ]
          }
        },
        {
          "name": "oracle",
          "writable": true,
          "signer": true,
          "relations": [
            "tournament"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchday",
          "type": "u16"
        },
        {
          "name": "playerId",
          "type": "u32"
        },
        {
          "name": "rawPoints",
          "type": "i32"
        },
        {
          "name": "wasMvp",
          "type": "bool"
        }
      ]
    },
    {
      "name": "createPlayerCard",
      "docs": [
        "Creates the user's PlayerCard (cNFT performance mirror) for a player."
      ],
      "discriminator": [
        17,
        132,
        192,
        231,
        169,
        26,
        184,
        234
      ],
      "accounts": [
        {
          "name": "tournament"
        },
        {
          "name": "player",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              },
              {
                "kind": "arg",
                "path": "playerId"
              }
            ]
          }
        },
        {
          "name": "card",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "arg",
                "path": "playerId"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "playerId",
          "type": "u32"
        },
        {
          "name": "mint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "createProfile",
      "docs": [
        "Creates a user profile (nickname + optional country)."
      ],
      "discriminator": [
        225,
        205,
        234,
        143,
        17,
        186,
        50,
        220
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nickname",
          "type": "string"
        },
        {
          "name": "countryCode",
          "type": {
            "option": {
              "array": [
                "u8",
                3
              ]
            }
          }
        }
      ]
    },
    {
      "name": "createSponsorLeague",
      "docs": [
        "Sponsor creates a free prize league by depositing the prize into the PDA."
      ],
      "discriminator": [
        139,
        210,
        229,
        90,
        247,
        74,
        83,
        135
      ],
      "accounts": [
        {
          "name": "tournament"
        },
        {
          "name": "league",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  103,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              },
              {
                "kind": "arg",
                "path": "name"
              }
            ]
          }
        },
        {
          "name": "sponsor",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "prizeLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initTournament",
      "docs": [
        "Sets up the tournament, the oracle, and the squad budget."
      ],
      "discriminator": [
        219,
        158,
        49,
        47,
        246,
        18,
        23,
        58
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  117,
                  114,
                  110,
                  97,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "name"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "budgetLamports",
          "type": "u64"
        },
        {
          "name": "oracle",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "registerPlayer",
      "docs": [
        "Registers a player with tier price and rarity (authority only)."
      ],
      "discriminator": [
        242,
        146,
        194,
        234,
        234,
        145,
        228,
        42
      ],
      "accounts": [
        {
          "name": "tournament"
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              },
              {
                "kind": "arg",
                "path": "playerId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "tournament"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "playerId",
          "type": "u32"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "country",
          "type": {
            "array": [
              "u8",
              3
            ]
          }
        },
        {
          "name": "position",
          "type": {
            "defined": {
              "name": "position"
            }
          }
        },
        {
          "name": "rarity",
          "type": {
            "defined": {
              "name": "rarity"
            }
          }
        },
        {
          "name": "priceLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setBudget",
      "docs": [
        "Authority: updates the tournament's squad budget."
      ],
      "discriminator": [
        148,
        121,
        226,
        12,
        183,
        120,
        26,
        227
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "tournament"
          ]
        }
      ],
      "args": [
        {
          "name": "budgetLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setLineup",
      "docs": [
        "Changes formation/starting 11/captain before the matchday."
      ],
      "discriminator": [
        247,
        5,
        95,
        34,
        2,
        16,
        11,
        241
      ],
      "accounts": [
        {
          "name": "tournament",
          "relations": [
            "squad"
          ]
        },
        {
          "name": "squad",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "squad"
          ]
        }
      ],
      "args": [
        {
          "name": "starters",
          "type": {
            "array": [
              "u32",
              11
            ]
          }
        },
        {
          "name": "formation",
          "type": {
            "defined": {
              "name": "formation"
            }
          }
        },
        {
          "name": "captain",
          "type": "u32"
        }
      ]
    },
    {
      "name": "setMatchday",
      "docs": [
        "Oracle: aktif matchday'i ve kilit durumunu ayarlar."
      ],
      "discriminator": [
        9,
        143,
        250,
        249,
        16,
        59,
        30,
        70
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true
        },
        {
          "name": "oracle",
          "signer": true,
          "relations": [
            "tournament"
          ]
        }
      ],
      "args": [
        {
          "name": "matchday",
          "type": "u16"
        },
        {
          "name": "locked",
          "type": "bool"
        }
      ]
    },
    {
      "name": "settleSponsorLeague",
      "docs": [
        "Authority enters the winner and the prize is sent from the PDA to the winner."
      ],
      "discriminator": [
        210,
        174,
        19,
        226,
        85,
        216,
        9,
        241
      ],
      "accounts": [
        {
          "name": "tournament",
          "relations": [
            "league"
          ]
        },
        {
          "name": "league",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  103,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              },
              {
                "kind": "account",
                "path": "league.name",
                "account": "sponsorLeague"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "tournament"
          ]
        },
        {
          "name": "winner",
          "docs": [
            "Winner wallet; the prize is sent here."
          ],
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "settleSquadMatchday",
      "docs": [
        "Writes the matchday's final total to the chain (rarity bonus + captain 2x)."
      ],
      "discriminator": [
        229,
        251,
        255,
        144,
        43,
        6,
        95,
        124
      ],
      "accounts": [
        {
          "name": "tournament",
          "relations": [
            "squad"
          ]
        },
        {
          "name": "squad",
          "writable": true
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "squad.owner",
                "account": "squad"
              }
            ]
          }
        },
        {
          "name": "crank",
          "docs": [
            "Fee payer; permissionless (whoever pays settles it)."
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "matchday",
          "type": "u16"
        }
      ]
    },
    {
      "name": "submitSquad",
      "docs": [
        "Submits the squad and performs full on-chain validation."
      ],
      "discriminator": [
        2,
        198,
        168,
        148,
        210,
        248,
        191,
        150
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true
        },
        {
          "name": "squad",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  113,
                  117,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "players",
          "type": {
            "array": [
              "u32",
              15
            ]
          }
        },
        {
          "name": "starters",
          "type": {
            "array": [
              "u32",
              11
            ]
          }
        },
        {
          "name": "formation",
          "type": {
            "defined": {
              "name": "formation"
            }
          }
        },
        {
          "name": "captain",
          "type": "u32"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "player",
      "discriminator": [
        205,
        222,
        112,
        7,
        165,
        155,
        206,
        218
      ]
    },
    {
      "name": "playerCard",
      "discriminator": [
        104,
        1,
        182,
        173,
        82,
        159,
        226,
        21
      ]
    },
    {
      "name": "scoreCommit",
      "discriminator": [
        192,
        83,
        146,
        155,
        147,
        236,
        176,
        229
      ]
    },
    {
      "name": "sponsorLeague",
      "discriminator": [
        139,
        163,
        143,
        129,
        123,
        83,
        173,
        64
      ]
    },
    {
      "name": "squad",
      "discriminator": [
        224,
        107,
        111,
        49,
        238,
        116,
        28,
        160
      ]
    },
    {
      "name": "tournament",
      "discriminator": [
        175,
        139,
        119,
        242,
        115,
        194,
        57,
        92
      ]
    },
    {
      "name": "userProfile",
      "discriminator": [
        32,
        37,
        119,
        205,
        179,
        180,
        13,
        194
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorizedOracle",
      "msg": "This instruction can only be called by the tournament's oracle."
    },
    {
      "code": 6001,
      "name": "unauthorizedAuthority",
      "msg": "This instruction can only be called by the tournament authority."
    },
    {
      "code": 6002,
      "name": "overBudget",
      "msg": "The squad's total price exceeds the budget."
    },
    {
      "code": 6003,
      "name": "countryLimitExceeded",
      "msg": "The number of players allowed from the same national team was exceeded (maximum 3)."
    },
    {
      "code": 6004,
      "name": "invalidFormation",
      "msg": "The starting 11 does not fully match the position distribution of the selected formation."
    },
    {
      "code": 6005,
      "name": "captainNotStarter",
      "msg": "The selected captain is not in the starting 11."
    },
    {
      "code": 6006,
      "name": "tournamentLocked",
      "msg": "The tournament is currently locked (a matchday is in progress)."
    },
    {
      "code": 6007,
      "name": "playerNotOwned",
      "msg": "The specified player does not belong to this squad."
    },
    {
      "code": 6008,
      "name": "alreadySettled",
      "msg": "This matchday was already calculated (settled)."
    },
    {
      "code": 6009,
      "name": "nicknameTooLong",
      "msg": "Nickname exceeds the 24-character limit."
    },
    {
      "code": 6010,
      "name": "overflow",
      "msg": "An arithmetic overflow occurred."
    },
    {
      "code": 6011,
      "name": "duplicatePlayer",
      "msg": "There is a duplicate player in the squad; each player can only be selected once."
    },
    {
      "code": 6012,
      "name": "accountCountMismatch",
      "msg": "The number of provided accounts does not match what was expected."
    },
    {
      "code": 6013,
      "name": "accountMismatch",
      "msg": "The provided account does not match the expected PDA."
    },
    {
      "code": 6014,
      "name": "starterNotInSquad",
      "msg": "A starter is not in the selected pool of 15 players."
    },
    {
      "code": 6015,
      "name": "invalidArgument",
      "msg": "The input value is invalid."
    },
    {
      "code": 6016,
      "name": "leagueAlreadySettled",
      "msg": "The sponsor league was already settled."
    },
    {
      "code": 6017,
      "name": "insufficientPrizeFunds",
      "msg": "Insufficient balance for the prize transfer."
    }
  ],
  "types": [
    {
      "name": "formation",
      "docs": [
        "Formation; each contains a fixed 1 goalkeeper + a varying DEF/MID/FWD distribution."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "f433"
          },
          {
            "name": "f442"
          },
          {
            "name": "f352"
          },
          {
            "name": "f343"
          },
          {
            "name": "f532"
          },
          {
            "name": "f541"
          },
          {
            "name": "f451"
          }
        ]
      }
    },
    {
      "name": "player",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tournament",
            "docs": [
              "The tournament it belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "playerId",
            "docs": [
              "Unique player id within the tournament (comes from the data set)."
            ],
            "type": "u32"
          },
          {
            "name": "name",
            "docs": [
              "Player name."
            ],
            "type": "string"
          },
          {
            "name": "country",
            "docs": [
              "National team ISO 3166-1 alpha-3 code (e.g. \"TUR\")."
            ],
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "position",
            "docs": [
              "Saha pozisyonu."
            ],
            "type": {
              "defined": {
                "name": "position"
              }
            }
          },
          {
            "name": "rarity",
            "docs": [
              "The player's rarity; carried over to cards minted for this player."
            ],
            "type": {
              "defined": {
                "name": "rarity"
              }
            }
          },
          {
            "name": "priceLamports",
            "docs": [
              "Starting price assigned by tier (lamports)."
            ],
            "type": "u64"
          },
          {
            "name": "totalPoints",
            "docs": [
              "The player's live total fantasy points accumulated over the tournament.",
              "Updated live each time commit_score is called."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "playerCard",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tournament",
            "docs": [
              "The tournament it belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "owner",
            "docs": [
              "The wallet that owns the card."
            ],
            "type": "pubkey"
          },
          {
            "name": "playerId",
            "docs": [
              "Temsil edilen oyuncunun player_id'si."
            ],
            "type": "u32"
          },
          {
            "name": "rarity",
            "docs": [
              "Card rarity (for the score bonus during settle)."
            ],
            "type": {
              "defined": {
                "name": "rarity"
              }
            }
          },
          {
            "name": "matchesPlayed",
            "docs": [
              "The number of matches played counted for the owner through this card."
            ],
            "type": "u32"
          },
          {
            "name": "totalPoints",
            "docs": [
              "The total fantasy points accumulated by the card."
            ],
            "type": "i64"
          },
          {
            "name": "mvpCount",
            "docs": [
              "The card's MVP (player of the match) count."
            ],
            "type": "u32"
          },
          {
            "name": "bestSingleScore",
            "docs": [
              "The highest score recorded in a single matchday."
            ],
            "type": "i32"
          },
          {
            "name": "mint",
            "docs": [
              "The associated cNFT mint address (Bubblegum asset id / mint)."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "position",
      "docs": [
        "Oyuncu saha pozisyonu."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "goalkeeper"
          },
          {
            "name": "defender"
          },
          {
            "name": "midfielder"
          },
          {
            "name": "forward"
          }
        ]
      }
    },
    {
      "name": "rarity",
      "docs": [
        "Card rarity; determines the score bonus applied during settle (basis points)."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "common"
          },
          {
            "name": "rare"
          },
          {
            "name": "legendary"
          }
        ]
      }
    },
    {
      "name": "scoreCommit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tournament",
            "docs": [
              "The tournament it belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "matchday",
            "docs": [
              "The matchday this score belongs to."
            ],
            "type": "u16"
          },
          {
            "name": "playerId",
            "docs": [
              "Oyuncunun player_id'si."
            ],
            "type": "u32"
          },
          {
            "name": "rawPoints",
            "docs": [
              "Raw fantasy score without the rarity/captain multiplier applied."
            ],
            "type": "i32"
          },
          {
            "name": "wasMvp",
            "docs": [
              "Whether the player was selected MVP this matchday (for the card's mvp_count counter)."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "sponsorLeague",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tournament",
            "docs": [
              "The tournament it belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "sponsor",
            "docs": [
              "The sponsor wallet funding the prize."
            ],
            "type": "pubkey"
          },
          {
            "name": "name",
            "docs": [
              "League name; also used as the PDA seed."
            ],
            "type": "string"
          },
          {
            "name": "prizeLamports",
            "docs": [
              "The prize amount held in the PDA (lamports)."
            ],
            "type": "u64"
          },
          {
            "name": "settled",
            "docs": [
              "Whether the prize has been distributed."
            ],
            "type": "bool"
          },
          {
            "name": "winner",
            "docs": [
              "The winner wallet (filled in after settle)."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "squad",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tournament",
            "docs": [
              "The tournament it belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "owner",
            "docs": [
              "The wallet that owns the squad."
            ],
            "type": "pubkey"
          },
          {
            "name": "players",
            "docs": [
              "The player_ids of the 15 selected players (11 starters + 4 substitutes)."
            ],
            "type": {
              "array": [
                "u32",
                15
              ]
            }
          },
          {
            "name": "starters",
            "docs": [
              "The player_ids of the 11 players on the pitch (a subset of players)."
            ],
            "type": {
              "array": [
                "u32",
                11
              ]
            }
          },
          {
            "name": "formation",
            "docs": [
              "The active formation."
            ],
            "type": {
              "defined": {
                "name": "formation"
              }
            }
          },
          {
            "name": "captain",
            "docs": [
              "The captain's player_id (must be in starters; score is 2x)."
            ],
            "type": "u32"
          },
          {
            "name": "spentLamports",
            "docs": [
              "The total budget spent on the squad (lamports)."
            ],
            "type": "u64"
          },
          {
            "name": "lockedMatchday",
            "docs": [
              "The last settled matchday (idempotency; 0 initially)."
            ],
            "type": "u16"
          },
          {
            "name": "totalPoints",
            "docs": [
              "The onchain finalized total squad score (accumulates via settle_squad_matchday)."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tournament",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "The authority that manages the tournament (register_player, settle_sponsor_league, etc.)."
            ],
            "type": "pubkey"
          },
          {
            "name": "oracle",
            "docs": [
              "The only authorized signer for commit_score (oracle backend keypair)."
            ],
            "type": "pubkey"
          },
          {
            "name": "name",
            "docs": [
              "Human-readable tournament name; also used as the PDA seed."
            ],
            "type": "string"
          },
          {
            "name": "budgetLamports",
            "docs": [
              "Squad-building budget (virtual SOL in lamports; 10 SOL = 10_000_000_000)."
            ],
            "type": "u64"
          },
          {
            "name": "currentMatchday",
            "docs": [
              "The active matchday number."
            ],
            "type": "u16"
          },
          {
            "name": "locked",
            "docs": [
              "True while a matchday is in progress; locks lineup changes."
            ],
            "type": "bool"
          },
          {
            "name": "squadCount",
            "docs": [
              "The number of squads created in this tournament."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The wallet that owns the profile (this is the identity; nickname is not unique)."
            ],
            "type": "pubkey"
          },
          {
            "name": "nickname",
            "docs": [
              "User nickname (max 24 characters)."
            ],
            "type": "string"
          },
          {
            "name": "countryCode",
            "docs": [
              "Optional: the country the user supports/joined (ISO alpha-3)."
            ],
            "type": {
              "option": {
                "array": [
                  "u8",
                  3
                ]
              }
            }
          },
          {
            "name": "totalPoints",
            "docs": [
              "The user's onchain finalized total score over the tournament."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
