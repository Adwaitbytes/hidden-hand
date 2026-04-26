/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/hidden_hand.json`.
 */
export type HiddenHand = {
  "address": "9hmucQcDZ1SJDCD8oM7KV5Rngfx7ZAcwZWk3WTghVDTg",
  "metadata": {
    "name": "hiddenHand",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Hidden Hand sealed-bid auction program"
  },
  "instructions": [
    {
      "name": "delegateAuction",
      "docs": [
        "Delegate the auction PDA to the MagicBlock ER."
      ],
      "discriminator": [
        85,
        114,
        125,
        69,
        80,
        147,
        146,
        83
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                129,
                79,
                129,
                30,
                61,
                46,
                148,
                149,
                146,
                37,
                159,
                124,
                5,
                155,
                40,
                107,
                42,
                121,
                22,
                78,
                70,
                187,
                32,
                232,
                53,
                251,
                48,
                178,
                210,
                250,
                60,
                251
              ]
            }
          }
        },
        {
          "name": "delegationRecordPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "pda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "auctionId"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "9hmucQcDZ1SJDCD8oM7KV5Rngfx7ZAcwZWk3WTghVDTg"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "auctionId",
          "type": {
            "array": [
              "u8",
              8
            ]
          }
        }
      ]
    },
    {
      "name": "initAuction",
      "docs": [
        "Initialize an auction PDA on the Solana base layer."
      ],
      "discriminator": [
        73,
        108,
        200,
        53,
        221,
        115,
        20,
        41
      ],
      "accounts": [
        {
          "name": "auction",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "auctionId"
              }
            ]
          }
        },
        {
          "name": "payer",
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
          "name": "auctionId",
          "type": {
            "array": [
              "u8",
              8
            ]
          }
        },
        {
          "name": "itemHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer"
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "revealAndSettle",
      "docs": [
        "Reveal the winner + amount. Commits state and undelegates back to base layer."
      ],
      "discriminator": [
        109,
        135,
        160,
        152,
        80,
        87,
        25,
        104
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "auction",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "winner",
          "type": "pubkey"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "submitSealedBid",
      "docs": [
        "Submit a sealed (encrypted) bid. Runs on the ER once delegated.",
        "We hash the encrypted blob and store (bidder, hash) in the auction."
      ],
      "discriminator": [
        8,
        44,
        54,
        67,
        60,
        62,
        229,
        117
      ],
      "accounts": [
        {
          "name": "bidder",
          "writable": true,
          "signer": true
        },
        {
          "name": "auction",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "encryptedBlob",
          "type": "bytes"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "auction",
      "discriminator": [
        218,
        94,
        247,
        242,
        126,
        233,
        131,
        81
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "alreadySettled",
      "msg": "Auction is already settled"
    },
    {
      "code": 6001,
      "name": "bidCapReached",
      "msg": "Bid cap reached"
    },
    {
      "code": 6002,
      "name": "invalidBidBlob",
      "msg": "Invalid bid blob (empty or too large)"
    },
    {
      "code": 6003,
      "name": "unauthorized",
      "msg": "Unauthorized signer"
    }
  ],
  "types": [
    {
      "name": "auction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "auctionId",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "itemHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "bids",
            "type": {
              "vec": {
                "defined": {
                  "name": "sealedBid"
                }
              }
            }
          },
          {
            "name": "winner",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "settledAmount",
            "type": "u64"
          },
          {
            "name": "settled",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "sealedBid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bidder",
            "type": "pubkey"
          },
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    }
  ]
};
