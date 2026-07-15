# WorldXI - Onchain World Cup Fantasy

Superteam Earn - World Cup Hackathon · *Consumer & Fan Experiences* track
Solana **devnet** · Program ID `A5dEqv3cB8tpxT1vQ6WTc88hC5vSvE6unSQvWodMvAfL`

---

## 1. Core Idea

WorldXI is a live, onchain fantasy football game themed around the 2026 World Cup. A user builds a 15-player squad from the real called-up players of 48 national teams within a **25 SOL virtual budget**, scores fantasy points from real match performance, and watches the leaderboard move **during** matches. Every player is a **living card** that accrues an onchain performance history (matches, points, MVPs, best score).

---

## 2. Why It's Different

- **Live onchain settlement.** Points are committed to the chain *during* the match (per event), not at full-time - the player and manager leaderboards move live. Classic fantasy and Sorare settle at full-time; this live movement is the core originality bet.
- **Living cards.** A card is not a static collectible; its onchain `PlayerCard` account accrues career history - matches played, total points, MVP count, best single score. *Proof: 30 `PlayerCard` accounts minted; performance updated onchain by `settle_squad_matchday`.*
- **No-risk by design.** No betting, no interest, no user-funded pools. Prize leagues are **100% sponsor-funded** - a user never risks money. Revenue comes from secondary-market royalties, premium/cosmetic mints, and sponsor partnerships. This is a differentiation for regulation-sensitive markets, not a limitation.

---

## 3. How TxLINE Powers the Product

TxLINE is the **live backbone** of WorldXI, not a side integration:

- **Fixture discovery** - the tournament's match set and schedule come from TxLINE.
- **Live event stream** - a Server-Sent-Events feed drives the orchestrator; each event marks its fixture dirty and triggers re-scoring + an onchain commit.
- **Settlement trigger** - TxLINE activity drives matchday lock -> live commit -> unlock.

**TxLINE events feed the scoring for real.** A dedicated events layer parses TxLINE goal/card events, maps the TxLINE `normativeId` to the player's ESPN id (order-independent name key), and merges them into scoring with `max(ESPN, TxLINE)` per counter - so a goal/card TxLINE reports is counted (not just used as a trigger).

> **Verified numbers (from a full backfill run):** 102 fixtures bridged TxLINE <-> scoring; **38 of 100 played matches had their scoring fed by TxLINE events.**

Where TxLINE does not expose a granular field (assists, per-player clean-sheet/minutes at the needed resolution), a complementary provider (ESPN box score) fills the gap, connected through the same bridge layer and keyed by player id.

### TxLINE endpoints used (from `oracle/src/txline/`)

| Endpoint | Method | Used for |
|----------|--------|----------|
| `/auth/guest/start` | POST | Obtain guest JWT (30-day) |
| `/api/token/activate` | POST | Activate API token (bound to an onchain subscribe signature) |
| `/api/fixtures/snapshot?startEpochDay&competitionId` | GET | World Cup fixture discovery |
| `/api/scores/snapshot/{fixtureId}?asOf` | GET | Current score / event / lineup snapshot per fixture |
| `/api/scores/historical/{fixtureId}` | GET | Past-match data (retroactive replay) |
| `/api/scores/stream` | GET (SSE) | Live event stream (goals, cards, substitutions) |

Only score/event/lineup data is consumed. **Odds/betting data is never requested** (hackathon rule + gambling-free design).

---

## 4. Architecture

**Onchain - Anchor 0.31.1, Solana devnet**
- Program ID `A5dEqv3cB8tpxT1vQ6WTc88hC5vSvE6unSQvWodMvAfL`, Tournament PDA `3PZ3tsLCdxWuzuhdNt8rngftT3EphR6YUNjphRvoopvj`.
- 7 state accounts: `Tournament`, `Player`, `Squad`, `PlayerCard`, `ScoreCommit`, `SponsorLeague`, `UserProfile`.
- 12 instructions. On-chain validation in `submit_squad`: budget ≤ 25 SOL, max 3 per country, formation position distribution, captain ∈ starters, unique players, remaining-account PDA verification (no spoofed accounts).

**Backend / Oracle - Node.js + TypeScript**
- TxLINE client (poll + SSE + auth/retry) · ESPN layer (roster, box score, schedule, bridge, photo) · scoring engine · TxLINE<->ESPN bridge · committer (idempotent, batched) · orchestrator (replay + live SSE) · REST + WebSocket API.

**Frontend - React + Vite + Solana wallet-adapter**
- Squad Builder, My Squad (pitch, FIFA-style shield cards, substitutions), Teams / Team Detail, Player Detail (match-by-match + totals), Player Leaderboard (live), Managers (global + daily), Leagues (sponsor + revenue model), My Cards (onchain living cards).

---

## 5. Scoring Rules

| Event | Points |
|-------|--------|
| Appearance | +1 |
| 60+ minutes | +1 |
| Goal - GK / DEF | +6 |
| Goal - MID | +5 |
| Goal - FWD | +4 |
| Assist | +3 |
| Man of the Match | +3 |
| Clean sheet (GK/DEF) | +4 |
| Penalty save | +5 |
| Yellow card | −1 |
| Red card | −3 |
| Own goal | −2 |

Captain scores **2×**; rarity bonus (**Rare +5%**, **Legendary +10%**) is applied **onchain** in `settle_squad_matchday`. The oracle produces only *raw* points; multipliers live on the chain.

---

## 6. Data Layer

- **48 teams × 26 = 1,246 players** from official World Cup rosters, matched by player id (no fragile name matching -> e.g. a striker's every goal counts correctly).
- **Pricing/tiers** - 5 tiers calibrated to the 25 SOL budget: Legendary 4.0 · Star 2.8 · Solid 1.7 · Rotation 1.0 · Budget 0.6 SOL. Distribution ≈ 3% / 12% / 25% / 35% / 25%. Assignment is **hybrid**: a curated star list guarantees known world-class players an upper tier, the rest ranks by retroactive fantasy performance (so an injured star isn't mispriced cheap, and the "you can't buy every star" scarcity holds - cheapest valid XI ≈ 9 SOL, a balanced squad ≈ 24 SOL).

---

## 7. Onchain Proof (verifiable)

All on `?cluster=devnet`:

- **Live settlement / scoring committed onchain** - `ScoreCommit` for Kylian Mbappé, matchday 6: **raw = 13, MVP = true** (2 goals × FWD 4 + appearance + 60′ + MVP).
  `explorer.solana.com/address/B9sL7vRPhG5FQwZXje75t5PHkJPiv9hjEE8Ymud6v536?cluster=devnet`
- **Living card performance updated onchain** - after `settle_squad_matchday`, `PlayerCard` accounts show `matches_played`, `total_points`, `best_single_score` incremented; the manager's `UserProfile.total_points` rose accordingly.
- **Sponsor prize leagues onchain** - Community Cup (0.5 SOL) `3ve2AJqRfvkESwpCASebEQhamcPSwtYLepJM1hLm2KCs`, Solana Fan League (1.0 SOL) `3ctc9wLyDFhvCmcYXCPHXA6fYi22EdYR1XM6rf18GU8N`.
- Full tournament backfill committed **3,152 `ScoreCommit` accounts** across 100 played matches.

---

## 8. Business & Monetization

- **Sponsor leagues** - brands fund the prize onchain; users join free and never risk money.
- **Secondary-market royalties** - a small royalty on player-card resales; cards with strong onchain history are worth more.
- **Premium / cosmetic mints** - optional, opt-in, never pay-to-win.

The no-risk model (no gambling / interest / pooled prizes) opens broad, regulation-sensitive markets and is an honest, defensible commercial story.

---

## 9. Tech Stack

Anchor **0.31.1** · Solana devnet · Node.js / TypeScript oracle · React + Vite + `@solana/wallet-adapter` · TxLINE (live data core) + ESPN box score (complementary) · Metaplex Bubblegum cNFT scaffold (`nft/` package) alongside the onchain `PlayerCard` living-card accounts.

---

## Application Access

- **Live app:** _[deploy URL - to be added]_
- **API endpoint:** _[oracle API URL - to be added]_ (e.g. `GET /leaderboard/players`, `/leaderboard/users?scope=global|daily`, `/leagues`, `/player/:id`)
- **Program (devnet):** `A5dEqv3cB8tpxT1vQ6WTc88hC5vSvE6unSQvWodMvAfL`
