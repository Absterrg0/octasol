/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/octasol_contract.json`.
 */
export type OctasolContract = {
  "address": "5y7GK42mAZm1C6qpFgUgGdNVLPkdd3wJhF9AkyRcDrUv",
  "metadata": {
    "name": "octasolContract",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "assignContributor",
      "discriminator": [
        191,
        42,
        156,
        8,
        11,
        20,
        89,
        218
      ],
      "accounts": [
        {
          "name": "maintainer",
          "writable": true,
          "signer": true,
          "relations": [
            "bounty"
          ]
        },
        {
          "name": "bounty",
          "writable": true
        },
        {
          "name": "contributor"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "cancelBounty",
      "discriminator": [
        79,
        65,
        107,
        143,
        128,
        165,
        135,
        46
      ],
      "accounts": [
        {
          "name": "maintainer",
          "writable": true,
          "signer": true,
          "relations": [
            "bounty"
          ]
        },
        {
          "name": "bounty",
          "writable": true
        },
        {
          "name": "escrowAuthority",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "bounty"
              }
            ]
          }
        },
        {
          "name": "maintainerTokenAccount",
          "writable": true
        },
        {
          "name": "escrowTokenAccount",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "completeBounty",
      "discriminator": [
        175,
        126,
        79,
        116,
        248,
        106,
        31,
        117
      ],
      "accounts": [
        {
          "name": "bounty",
          "writable": true
        },
        {
          "name": "escrowAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "bounty"
              }
            ]
          }
        },
        {
          "name": "maintainer",
          "writable": true
        },
        {
          "name": "contributor",
          "writable": true
        },
        {
          "name": "keeper",
          "writable": true,
          "signer": true,
          "relations": [
            "bounty"
          ]
        },
        {
          "name": "contributorTokenAccount",
          "writable": true
        },
        {
          "name": "escrowTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "bountyId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeBounty",
      "discriminator": [
        150,
        37,
        249,
        246,
        85,
        164,
        253,
        229
      ],
      "accounts": [
        {
          "name": "maintainer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bounty",
          "writable": true,
          "signer": true
        },
        {
          "name": "maintainerTokenAccount",
          "writable": true
        },
        {
          "name": "escrowAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "bounty"
              }
            ]
          }
        },
        {
          "name": "keeper",
          "docs": [
            "CHECK : KEEPER ACCOUNT FOR AUTO DISPENSING"
          ]
        },
        {
          "name": "escrowTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "escrowAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bountyId",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bounty",
      "discriminator": [
        237,
        16,
        105,
        198,
        19,
        69,
        242,
        234
      ]
    }
  ],
  "events": [
    {
      "name": "bountyCancelled",
      "discriminator": [
        234,
        186,
        248,
        214,
        198,
        69,
        152,
        23
      ]
    },
    {
      "name": "bountyCompleted",
      "discriminator": [
        206,
        22,
        65,
        135,
        31,
        56,
        249,
        158
      ]
    },
    {
      "name": "bountyCreated",
      "discriminator": [
        68,
        252,
        247,
        196,
        154,
        247,
        130,
        49
      ]
    },
    {
      "name": "contributorAssigned",
      "discriminator": [
        174,
        6,
        64,
        143,
        235,
        105,
        160,
        49
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6001,
      "name": "insufficientAmount",
      "msg": "Insufficient bounty amount"
    },
    {
      "code": 6002,
      "name": "invalidBountyState",
      "msg": "Invalid bounty state"
    },
    {
      "code": 6003,
      "name": "invalidContributor",
      "msg": "Invalid contributor"
    }
  ],
  "types": [
    {
      "name": "bounty",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maintainer",
            "type": "pubkey"
          },
          {
            "name": "contributor",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "bountyState"
              }
            }
          },
          {
            "name": "bountyId",
            "type": "u64"
          },
          {
            "name": "keeper",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "bountyCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bountyId",
            "type": "u64"
          },
          {
            "name": "maintainer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "bountyCompleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bountyId",
            "type": "u64"
          },
          {
            "name": "contributor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "bountyCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bountyId",
            "type": "u64"
          },
          {
            "name": "maintainer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "bountyState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "created"
          },
          {
            "name": "inProgress"
          },
          {
            "name": "completed"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "contributorAssigned",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bountyId",
            "type": "u64"
          },
          {
            "name": "contributor",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
