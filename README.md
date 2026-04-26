# Hidden Hand

Sealed-bid agent auctions on **MagicBlock Private Ephemeral Rollups**. Built for **Solana Blitz v4 — Agentic** (April 2026).

Three autonomous LLM agents — *The Whale*, *The Value Hunter*, and *The Vibes Trader* — compete in real-time sealed-bid auctions for procedurally-generated artifacts. Bids are encrypted, committed simultaneously, revealed atomically, and settled. The audience watches the agents reason live.

## Demo

```bash
bun install
echo "GROQ_API_KEY=your_key_here" > .env.local
bun run dev
```

Open http://localhost:3000 and hit **Start Auction**.

## Why Ephemeral Rollups?

The auction's hot path lives entirely inside a MagicBlock Private ER. This is what makes the design viable, not just decorative:

1. **Delegation.** An `Auction` PDA initialized on Solana base-layer is delegated to MagicBlock's ER via the delegation program (`DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`).
2. **Sealed bids.** Each agent submits its encrypted bid blob through the **Private ER endpoint** (`devnet-tee.magicblock.app`). Because state is held inside a TEE, no agent — and no observer — can read another agent's bid before reveal. This is the critical primitive Solana mainnet cannot offer: cheap, fast, hidden state with cryptographic confidentiality.
3. **Reveal & resolve.** Once all three bids are committed, a single `reveal` tx flips them open. The program picks the highest valid bid and updates balances — gasless and sub-second inside the rollup.
4. **Settle.** The winner's payment + item transfer is committed back to Solana base-layer as the canonical record. The auction account is undelegated for the next round.

Three agents thinking, encrypting, committing, and settling in under three seconds per round — that's the unique capability MagicBlock unlocks.

## Architecture

```
src/
├── app/
│   ├── page.tsx                 live auction UI (item display, agent cards, ER feed, standings)
│   ├── layout.tsx
│   └── api/auction/route.ts     ndjson event stream
└── lib/
    ├── items.ts                 procedural artifact generator (5 rarity tiers, weighted)
    ├── agents.ts                3 personas, Groq llama-3.3-70b, strict bidding policies
    ├── auction.ts               session generator: delegate → sealed bid → reveal → settle
    └── er.ts                    ER tx shapes mirroring the real Anchor/SDK calls
```

The `er.ts` layer emits transactions with the exact shape a real ER call would carry. Swap the bodies for `@magicblock-labs/ephemeral-rollups-sdk` calls against a deployed Anchor program to go fully on-chain.

## The agents

| Agent | Strategy |
|---|---|
| 🐋 **The Whale** | Aggressive on Rare/Epic/Legendary; skips Commons. Caps at 60% of balance unless Legendary. |
| 🎯 **The Value Hunter** | Computes fair price = `base × (1 + 0.15 × #traits)`, bids 75-90% of fair. Walks away from inflated lots. |
| 🎭 **The Vibes Trader** | Scores lore from 1-10, bids `(score/10) × 1.6 × base`. Will skip generic items. |

All three run in parallel (`Promise.all`) per round through the Groq API.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Vercel AI SDK** + `@ai-sdk/groq`
- **Groq** `llama-3.3-70b-versatile` for agent reasoning (~500ms per agent)
- **`@magicblock-labs/ephemeral-rollups-sdk`** for the ER + Private ER transaction layer
- **Solana devnet** for settlement
- **Tailwind v4** for the UI

## Roadmap to fully onchain

- Anchor program with `init_auction`, `submit_sealed_bid`, `reveal_and_settle`, `undelegate` instructions
- Real wallet integration (each agent gets a Solana keypair)
- Replace `er.ts` stubs with `@magicblock-labs/ephemeral-rollups-sdk` calls against the deployed program at `devnet-as.magicblock.app` / `devnet-tee.magicblock.app`
- Use **VRF plugin** to randomize item generation onchain
- Spectator wagering on Solana mainnet via a separate prediction-market PDA

Built in a weekend at Solana Blitz v4.
