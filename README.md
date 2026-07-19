# WorldXI

A live, onchain fantasy football game themed around the 2026 World Cup. Built on Solana + Anchor + Metaplex cNFT, with real-time data from the TxLINE core feed.

> Superteam Earn "World Cup" hackathon, "Consumer and Fan Experiences" track.

Players build a 15-man squad from national-team footballers within a virtual 35 SOL budget and pick a starting 11. Each footballer's real match performance turns into fantasy points that are committed onchain live during the match. Every player card is an onchain asset that accumulates performance history.

## What makes it different

1. Live onchain settlement: points are written to the chain DURING the match (`commit_score`), not after it. The leaderboard moves throughout the game.
2. Living cards: each card accumulates an onchain career history (matches played, total points, MVPs, best score). Cards are created together with the squad in a single approval, and they stay with the wallet when the squad changes; only players in the active squad keep earning new points. A wallet can close its own accounts (squad, cards, snapshots, profile) at any time and reclaim the rent.
3. Live match center: the full tournament fixture list, live scores, minute, event feed (goals, cards, substitutions) and player ratings, all from real data.

No-risk model (a design choice): no entry fees, no betting, no pooled prizes. Prize leagues are funded only by sponsors; users never put money at risk. Revenue: secondary-market royalties, premium/cosmetic mints, and sponsor partnerships.

## Architecture: TxLINE as the core source, ESPN as the helper

- TxLINE is the hackathon's mandatory core feed: which matches are played and when, the live score stream, match status (first half / half time / second half / full time) and live event triggering. Odds/betting data is never consumed.
- ESPN box score provides the scoring truth (id-based, rich): appearances, minutes, goals, assists, cards, clean sheets. Each TxLINE fixture is bridged to its ESPN event by ISO-alpha3 team + day matching.
- The match event feed (timed goals/cards/substitutions, scorer + assist, in + out) comes from ESPN keyEvents; match status is derived first from the TxLINE StatusId, with ESPN status used only as a helper confirmation when TxLINE is delayed.

## Rule: everything is real

No mock, dummy, or placeholder data. The player universe and all performances are produced from real WC 2026 data (TxLINE fixture/score feed + ESPN box score). No scored number is invented; every value traces back to a real event and totals live on the chain.

## Live devnet addresses

| | |
|---|---|
| Program ID | `A5dEqv3cB8tpxT1vQ6WTc88hC5vSvE6unSQvWodMvAfL` |
| Tournament PDA | `3PZ3tsLCdxWuzuhdNt8rngftT3EphR6YUNjphRvoopvj` |
| cNFT merkle tree | `BxC8kYgcdM3z6HssXCz4dyDEQHf1wQRizAyXUJUW2h2r` |
| Live app | https://world-xi-lilac.vercel.app |
| Oracle API | https://worldxi-production.up.railway.app |
| Network | Solana devnet (program), TxLINE (live data feed) |
| Players | 1246 real WC 2026 footballers |

## Structure

```
programs/worldxi/   Anchor program (Rust): instructions, accounts, tests
oracle/             Node/TS: TxLINE client, ESPN integration, scoring engine,
                    committer, orchestrator (live SSE), match center + leaderboard API,
                    pipeline and register/backfill/settle scripts
nft/                Metaplex Bubblegum cNFT mint (merkle tree + card mint)
app/                React + Vite frontend (Solana wallet, live leaderboard, match center)
data/               Pipeline output: players.json, countries.json
docs/               TxLINE OpenAPI reference
```

## Onchain program

Instructions: `init_tournament`, `register_player`, `create_profile`, `submit_squad`,
`set_lineup`, `set_matchday`, `commit_score`, `create_player_card`, `settle_squad_matchday`,
`create_sponsor_league`, `settle_sponsor_league`.

- Squad validation (35 SOL budget, max 3 per country, position limits, formation, captain) runs entirely onchain.
- Live scoring: `commit_score` updates each player's total instantly via a delta (idempotent, batched commits).
- Settlement: `settle_squad_matchday` applies the rarity bonus (Common/Rare/Legendary = 1.00/1.05/1.10x) and the captain 2x multiplier.
- Match lock: squads cannot be changed while a matchday is in play (locked).

```bash
anchor build && anchor test
anchor deploy --provider.cluster devnet
```

## TxLINE endpoints (score/event/lineup only, never odds)

| Endpoint | Use |
|---|---|
| `POST /auth/guest/start` | guest JWT |
| `POST /api/token/activate` | API token activation (free WC tier) |
| `GET /api/fixtures/snapshot?competitionId=72` | WC 2026 fixtures |
| `GET /api/scores/snapshot/{fixtureId}` | live score + minute + events + lineups |
| `GET /api/scores/stream` | live SSE (orchestrator) |

## Oracle

```bash
cd oracle
cp .env.example .env                 # TxLINE credentials + oracle keypair path
npm install
npm test                             # scoring unit tests
npm run txline:subscribe             # TxLINE subscription + API token (one time)
npm run build:dataset                # build players.json / countries.json
npm run register                     # register the player universe onchain
npm run backfill                     # retroactively commit played matches (batched)
npm run orchestrate                  # live SSE + commit + leaderboard/match-center API
```

To listen directly to the live stream on match day without replaying history:

```bash
ORCHESTRATOR_SKIP_REPLAY=true npm run orchestrate
```

### API endpoints

| Endpoint | Description |
|---|---|
| `GET /players`, `/countries` | player universe + country/flag data |
| `GET /player/:id` | per-match point breakdown + tournament rank |
| `GET /leaderboard/players` | live player leaderboard |
| `GET /leaderboard/users?scope=global\|daily` | final (onchain) + provisional (live) manager ranking |
| `GET /live/matchday` | live points for the active matchday |
| `GET /matches/days` | days that have matches in the tournament |
| `GET /matches?day=<epochDay>` | that day's matches (live score + status) |
| `GET /match/:fixtureId` | match detail (event feed + lineups + player ratings) |
| `GET /nft/:id` | cNFT metadata |
| WebSocket | live tick on every update |

## Frontend

```bash
cd app && npm install && npm run dev   # http://localhost:5173
```

Pages:

- Home: intro, concept and main actions
- Build: build a squad within the 35 SOL budget, choose formation and captain, submit onchain
- My Squad: pitch view, starting 11 / bench swaps, captain
- Matches: full-tournament day selector, live/upcoming/past matches (live score, minute, HT, FT)
- Match detail: score header, timed event feed (goals/cards/subs/half time), lineups, player ratings + MVP
- Teams / Team detail: national teams and their squads
- Player detail: player profile, per-match fantasy stat breakdown
- Leaderboard: live player ranking
- Managers: manager (user) ranking (final + provisional)
- My Cards: gallery of owned player cards
- Leagues: sponsor-funded prize leagues and the revenue model
- Rules: scoring system and all game rules

## Scoring

Raw points (from ESPN box score + TxLINE live events):

| Event | Points |
|---|---|
| Match appearance | +1 |
| Playing 60+ minutes | +1 |
| Goal (goalkeeper / defender) | +6 |
| Goal (midfielder) | +5 |
| Goal (forward) | +4 |
| Assist | +3 |
| Clean sheet (goalkeeper / defender, 60+ min) | +4 |
| Penalty save | +5 |
| MVP (top-contributing player of the match) | +3 |
| Yellow card | -1 |
| Red card | -3 |
| Own goal | -2 |

Multipliers applied onchain: rarity bonus (Common +0%, Rare +5%, Legendary +10%) and captain 2x.
Final points: `raw x rarity x (captain ? 2 : 1)`.

## Squad rules

- Budget: 35 SOL
- Squad: 15 players, a starting 11 is selected
- Position limits: goalkeeper 2, defender 5, midfielder 5, forward 3
- At most 3 players per country
- Formations: 4-3-3, 4-4-2, 3-5-2, 3-4-3, 5-3-2, 5-4-1, 4-5-1
- Tier prices (SOL): Legendary 4.0, Star 2.8, Solid 1.7, Rotation 1.0, Budget 0.6

## cNFT (Metaplex Bubblegum)

```bash
cd nft && npm install
npm run create-tree                  # create the merkle tree
npm run mint -- --player 46557       # example card mint
```

Card metadata includes a dynamic kit image (national-team colors) and onchain attributes; the metadata is served from the oracle API's `/nft/:id` endpoint.
