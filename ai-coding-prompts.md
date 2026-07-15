## 0. MASTER CONTEXT (provide before every module)

```
I am building a Solana hackathon project: an onchain fantasy football game themed around the 2026 World Cup. It is for the Superteam Earn "World Cup" hackathon, "Consumer and Fan Experiences" track. Project name: WorldXI.

PRODUCT SUMMARY:
The user builds a squad from national team players within a virtual SOL budget (10 SOL). Fantasy points are collected based on the players' real match performance. There is a global and a daily leaderboard. Each player is an NFT (cNFT) and accrues a performance history over time.

DATA SOURCE: TxLINE API (TxODDS's real-time data layer; the hackathon's mandatory data provider). Live scores, match events, and all 104 matches of data. ONLY match event data is used (goals, assists, minutes, cards, etc.). Betting/odds data is NEVER used. TxLINE must be at the CORE of the product as a live input (hackathon requirement). Docs: https://txline.txodds.com/documentation/worldcup

PLAYER SCOPE: Only players CALLED UP to the official rosters of the 48 national teams participating in the 2026 World Cup. 26 players per roster (FIFA 2026 rule), roughly 1248 players total. Not club players, national team players.

KEY CONSTRAINTS (no-risk / compliance design):
- NO interest in the system.
- NO betting/gambling.
- NO payout to winners from a shared pool that users fund.
- Leagues are FREE. Prize leagues are funded only by a SPONSOR (users take no risk).
- Revenue model: secondary-market commission, premium/cosmetic mints, sponsor partnerships.

DIFFERENTIATION & POSITIONING (critical for the originality criterion, avoid being "just another onchain fantasy"):
1. LIVE ONCHAIN SETTLEMENT: Points are committed to the chain live DURING the match, not at full-time. On every goal/assist/card event, player and user points update instantly and the leaderboard moves live. This hits both the originality and "real-time responsiveness" criteria at once. (Sorare and classic fantasy settle at full-time; this is the gap we fill.)
2. LIVING CARDS: The OPPOSITE of Sorare's static collectible card. The card accrues an onchain career history (matches played, points, MVPs, best score). Positioning: "not a static collectible, a living card." Show this contrast clearly in the product and the demo.
3. LIGHT / REPLAYABLE FORMAT: Not a heavy full-season UEFA fantasy clone; a matchday-based, quick-to-enter, light experience that a casual football fan opens regularly. The track wants a "mainstream, non-technical fan" and a "replayable" experience. This serves both the originality and the UX criteria.

Note: In the tournament, data for past matches is pulled from TxLINE, computed retroactively, and displayed (valuable for the demo, helps completeness). This is a separate thing; originality comes from the 3 moves above.

TECHNOLOGY:
- Onchain: Anchor (Rust) program, Solana devnet.
- NFT: Metaplex cNFT (compressed, cheap mint).
- Backend/Oracle: Node.js/TypeScript, TxLINE poll/stream + scoring engine.
- Frontend: React + Solana wallet adapter.

COLOR PALETTE (app theme) - 2026 World Cup logo (gold/green/black) + Solana (purple/green):

Base colors (World Cup): gold #BC9747, light gold #B99863, bronze #7F613D, dark brown #3E1F02, football green #15503C, black #000000.
Solana accent: purple #9945FF, green #14F195, bright green #00FFA3.
Background: #060806 / #0A0E0C. Card surface: #12100A. Text: #FFFFFF (primary), #B99863 (faded gold), #A0A8C0 (neutral faded).

Gradients (function-specific, do not spread everywhere):
- Trophy gold (#B99863 -> #BC9747 -> #7F613D): trophy, captain badge, winner/leaderboard highlights.
- Solana (#9945FF -> #14F195): wallet connect, mint, onchain transaction buttons. Use ONLY at onchain action moments.
- Hero (#000000 -> #3E1F02 -> #15503C): background and pitch depth.
- Champion (#15503C -> #BC9747 -> #9945FF): brand summary (special moments like splash, hero title, winner screen).

Rule: gold/green is the main theme; Solana purple is reserved only for onchain actions (if overused, the World Cup feel is lost). Jersey colors are generated dynamically from each national team's own hex palette.

SQUAD RULES:
- Budget: 10 SOL virtual (not a real-money risk, only a squad-building unit).
- 15 players: 2 goalkeepers, 5 defenders, 5 midfielders, 3 forwards.
- Max 3 players from the same country.
- Formations (user selects, can change each matchday): 4-3-3, 4-4-2, 3-5-2, 3-4-3, 5-3-2, 5-4-1, 4-5-1. All have exactly 1 goalkeeper.
- The starting 11 must fully satisfy the selected formation, with the remaining 4 as substitutes.
- A captain is chosen, and their points are doubled.
- If a starter does not play the match, the first substitute in the same position comes in automatically.

SCORING:
Appearance +1, 60+ minutes +1, goal (GK/DEF) +6, goal (MID) +5, goal (FWD) +4, assist +3, man of the match +3, clean sheet (GK/DEF) +4, penalty save +5, yellow card -1, red card -3, own goal -2.

PLAYER PRICING (calibrated to the 10 SOL budget):
Each player has a tier and a SOL price. Tiers (starting price):
- Legendary (world stars): 2.0 SOL
- Star: 1.4 SOL
- Solid: 0.9 SOL
- Rotation: 0.5 SOL
- Budget: 0.3 SOL
Calibration rule: a valid 15-player squad must fit within 10 SOL, but at most ~2-3 premium (Legendary/Star) players can be bought; the rest from cheap tiers. This creates the "not everyone can buy every star" constraint (the essence of fantasy). Prices are NOT DERIVED from betting; they are assigned by player rating/performance. As the tournament progresses, price can be updated dynamically based on the fantasy points the player has accrued (optional, can start static in the MVP).

LIVE SCORE FLOW (architecture - critical):
- commit_score updates player.total_points LIVE during the match (the player leaderboard moves instantly).
- The user/squad total is two-layered: (a) settle_squad_matchday writes the final total to the chain at the end of the matchday; (b) DURING the match, the frontend reads the user's starters' live player points and computes a PROVISIONAL user score client-side and shows the leaderboard live. This way the user leaderboard also moves live during the match. This is the product's main originality/real-time move; the frontend must implement it.

NFT MINT FLOW:
- Player cards are minted when the user submits their squad (once submit_squad succeeds). That is, cNFTs for the selected 15 players are created when the squad is approved.

NFT MODEL (model B):
- Anyone can select any player (no scarce-card requirement, open access).
- Each selection mints that player's cNFT to the user.
- The card accrues an onchain performance history: matches played, total points, MVP count, highest single-match score.
- Cards with a good history are more valuable on the secondary market and can be sold.
- Rarity (optional bonus): Common (no bonus), Rare (+5%), Legendary (+10%).

USER PROFILE:
- On first entry the user connects a wallet and sets a nickname.
- The profile shows: nickname, wallet address, tournament total points, (optional) the country they joined.

Keep this context in mind. Now I will have you write a specific module.
```

---

## 1. ANCHOR PROGRAM (Onchain)

```
[Paste the MASTER CONTEXT from above, then add this:]

Write the Anchor (Rust) program. It must include the following instructions and state accounts.

STATE ACCOUNTS:
1. Tournament: authority, oracle pubkey, name, budget_lamports, current_matchday, locked (bool), squad_count, bump.
2. Player: tournament, player_id (u32), name, country (ISO 3-letter), position (enum), price_lamports, total_points (i64), bump.
3. Squad: tournament, owner, players [u32;15], starters [u32;11], formation (enum), captain (u32), spent_lamports, locked_matchday, total_points, bump.
4. PlayerCard (NFT performance mirror): tournament, owner, player_id, rarity (enum), matches_played, total_points, mvp_count, best_single_score, mint (pubkey), bump.
5. ScoreCommit: tournament, matchday, player_id, raw_points (i32), was_mvp (bool), bump.
6. SponsorLeague: tournament, sponsor, name, prize_lamports, settled (bool), winner, bump.
7. UserProfile: owner (wallet), nickname (string, max 24 chars), country_code (optional ISO 3-letter), total_points (i64), bump. PDA seed = ["profile", owner].

ENUMS:
- Position: Goalkeeper, Defender, Midfielder, Forward.
- Formation: F433, F442, F352, F343, F532, F541, F451. Each must have a function returning its (DEF, MID, FWD) counts.
- Rarity: Common (10000 bps), Rare (10500 bps), Legendary (11000 bps).

INSTRUCTIONS:
1. init_tournament: authority sets up the tournament, the oracle, and the budget.
2. register_player: authority only, registers a player with the tier price (price_lamports = tier price; per the pricing table in the MASTER CONTEXT).
3. create_profile: the user creates a profile with a nickname and an optional country. Nickname max 24 chars (NicknameTooLong if exceeded). Uniqueness is not required (the same nickname can exist across multiple wallets; identity is the wallet address); a soft warning can be shown on the frontend if desired.
4. submit_squad: submits the squad. ON-CHAIN validation: total price <= budget, max 3 from the same country, the starting 11 fully satisfies the selected formation, the captain is one of the starters. Player accounts are read from remaining_accounts.
5. set_lineup: changes formation/starters/captain before the matchday. Rejects if the matchday is locked.
6. commit_score: ONLY with the oracle signature. Writes/updates a player's raw points and MVP status for a matchday (with init_if_needed it can be called multiple times live during the match; each call reflects the current points), and updates player.total_points. Live settlement is built on this.
7. settle_squad_matchday: reads the starters' ScoreCommits, applies the rarity bonus + captain 2x, and updates squad.total_points and each PlayerCard's history and UserProfile.total_points. If a starter did not play, the client swaps in the substitute in the same position.
8. create_sponsor_league: the sponsor deposits the prize into the PDA (system transfer). NO user entry fee.
9. settle_sponsor_league: the authority enters the winner (determined from the leaderboard), and the prize is sent from the PDA to the winner.

PDA seeds: tournament=["tournament", name], player=["player", tournament, player_id], squad=["squad", tournament, owner], score=["score", tournament, matchday, player_id], league=["league", tournament, name], profile=["profile", owner].

Error codes: UnauthorizedOracle, UnauthorizedAuthority, OverBudget, CountryLimitExceeded, InvalidFormation, CaptainNotStarter, SquadLocked, TournamentLocked, PlayerNotOwned, AlreadySettled, NicknameTooLong, Overflow.

Use Anchor 0.30.1. Modular structure: lib.rs, state/, instructions/, errors.rs. Use checked arithmetic (overflow checks). Keep the code clean and commented.
```

---

## 2. NFT MINT (Metaplex cNFT)

```
[Paste the MASTER CONTEXT, then:]

Write the TypeScript module that mints a compressed NFT (cNFT) when a player is selected. Use Metaplex Bubblegum.

REQUIREMENTS:
- Create/use a merkle tree (for all player cards).
- mintPlayerCard(owner, playerId, playerName, nationalTeam, jerseyNumber, position, rarity) function.
- NFT metadata: name = "Player Name - National Team #JerseyNo", attributes = [player_id, national_team, jersey_number, position, rarity, matches_played, total_points, mvp_count, best_single_score].
- Performance fields start at 0.
- updateCardPerformance(mint, matchesPlayed, totalPoints, mvpCount, bestScore) function: updates the metadata after each matchday.
- Image URI: to be generated from the national team jersey (compatible with the frontend, a placeholder URI is acceptable).

Write it for devnet. Use @metaplex-foundation/mpl-bubblegum and umi. Prioritize cheap mint (cNFT). Keep the code commented.
```

---

## 3. ORACLE BACKEND (TxLINE + Scoring Engine)

```
[Paste the MASTER CONTEXT, then:]

Write the Node.js/TypeScript oracle backend. Its function: pull match data from TxLINE, compute fantasy points, and write them to the Anchor program via commit_score.

MODULES:
1. TxLINE Client: a service that pulls live match events (goals, assists, minutes played, yellow/red cards, clean sheet, penalty save, own goal). SSE/polling. ONLY event data, do not pull odds/betting data.
2. Scoring Engine: compute each player's matchday raw points. Rules:
   - Appearance +1, 60+ minutes +1, assist +3, MVP +3, yellow -1, red -3, own goal -2.
   - Goal: by position GK/DEF +6, MID +5, FWD +4.
   - Clean sheet (GK/DEF) +4, penalty save (GK) +5.
   - The rarity bonus and captain multiplier are applied ONCHAIN, DO NOT apply them here. Produce only raw points.
3. Committer: signs and sends the commit_score instruction with the oracle keypair for each player.
4. Matchday Orchestrator: at the start of the matchday, tournament.locked=true. LIVE SETTLEMENT: do not wait for full-time; on every significant event (goal, assist, card) commit that player's current raw points instantly, so the leaderboard moves live during the match. When the matchday ends, do a final commit, then locked=false. (This live flow is the project's main originality/real-time move.)
5. Stats & Leaderboard API: REST/websocket endpoints for the frontend:
   - Player detail: each player's match-by-match point breakdown across all their World Cup matches + their overall tournament ranking.
   - Player leaderboard: the players with the most points (updated live).
   - Live player points: the starters' instantaneous raw points in the active matchday (the frontend computes the PROVISIONAL user score from these).
   - User leaderboard: final (onchain settle) + provisional totals in the active matchday. Global + daily.
   - Past-match replay: pulling matches played in the tournament from TxLINE and computing points retroactively to feed the system (to simulate the live experience for the demo).

Config: TxLINE API key, oracle keypair, program id, RPC endpoint from env.
Make it idempotent (do not write the same score twice). Add error/retry handling. Keep the code modular and commented.

NOTE: In the MVP the oracle is the single signing authority. In a comment, note that the roadmap will include a merkle commit + challenge window.
```

---

## 4. FRONTEND

```
[Paste the MASTER CONTEXT, then:]

Write the React frontend. With the Solana wallet adapter. Dark theme, use the color palette above.

ENTRY FLOW:
- The user connects a wallet. On first entry they set a nickname (and optionally select the country they joined). This is recorded onchain via create_profile.

PAGES:

1. PITCH VIEW (main screen - Squad):
- Pitch: Hero gradient (#000000 -> #3E1F02 -> #15503C), football-green base, slight perspective (forwards at the top, goalkeeper at the bottom). DO NOT USE BLUE - the theme is gold/green/black.
- Players are positioned according to the selected formation.
- Each player is a "card": at the top the NATIONAL TEAM jersey image (in that country's colors), the player's national team jersey NUMBER above the jersey, the player name below. (Optional: the player's next match date/opponent.)
- The captain's jersey has a gold "C" badge (Trophy gold). Each card has a remove (x) button in the top right.

2. SQUAD BUILDER:
- Budget indicator (10 SOL, remaining budget live), position-based player selection, each player's tier and SOL price visible, a max-3-per-country warning, formation selector (7 formations), captain selection.
- Budget overruns and rule violations are shown instantly. Submit goes to the Anchor program, and on success the cNFTs of the 15 players are minted.
- During the active matchday, the user's squad's live provisional score is shown (computed from the starters' live player points).

3. NATIONAL TEAMS PAGE:
- The 48 national teams in a grid, each clickable as a card with flag + color + name.
- On clicking a team: that team's 26 players called up to the World Cup are listed (jersey number, name, position).
- On clicking a player: the PLAYER DETAIL page opens.

4. PLAYER DETAIL PAGE:
- The player's performance across all their 2026 World Cup matches (match-by-match point breakdown: goals, assists, minutes, cards, fantasy points earned).
- That player's tournament ranking so far (their position among all players).
- Total fantasy points, average, MVP count.

5. PLAYER LEADERBOARD (tournament-wide):
- The ranking of the players who have accrued the most fantasy points among all World Cup players.
- LIVE: as player.total_points changes during the match, the ranking updates live via polling/websocket (rows move).
- At the end of the tournament, the "players with the most points" finale is shown.

6. USER LEADERBOARD (overall):
- All users are ranked. Each row: rank, nickname, wallet address (shortened), tournament total points, (optional) the flag of the country they joined.
- LIVE: during the match, a PROVISIONAL total is computed from each user's starters' live player points and the leaderboard moves live. When the matchday ends, the final total is written to the chain via settle_squad_matchday. This live movement is the product's main showcase.
- Global + daily tabs.
- Country-based stats: total/average points by the countries users joined (optional additional view).

7. NFT GALLERY:
- The user's player cards, each card's performance history (matches played, total points, MVP, best score).

8. (Optional) SECONDARY MARKET:
- Card listing/purchase interface.

JERSEY IMAGES: can be generated dynamically from national team colors (SVG jersey template + country color palette).

Include wallet connect, profile creation, squad submit, leaderboard fetch, and player detail fetch. Split the code into components and keep it commented.
```

---

## 5. DATA SET - 48 National Teams + Rosters

```
Prepare the data set of the 48 national teams participating in the 2026 FIFA World Cup as JSON.

TEAM DATA (countries.json), for each team:
- country_name (Turkish + English)
- iso_code (3-letter, e.g. TUR)
- primary_color and secondary_color (hex, national team jersey colors)
- flag_emoji

PLAYER DATA (players.json):
- ONLY the official rosters called up to the World Cup. 26 players per roster (FIFA 2026 rule).
- For each player: player_id (unique, consistent), name, national_team (iso_code), jersey_number (the official jersey number in the national team), position (GK/DEF/MID/FWD), price_tier (Legendary/Star/Solid/Rotation/Budget), price_sol (by tier: 2.0/1.4/0.9/0.5/0.3), rarity (Common/Rare/Legendary - most Common, stars Rare/Legendary).
- Tier assignment by the player's real level: world stars Legendary, regular starters Star/Solid, substitutes Rotation/Budget.

IMPORTANT WARNING (hallucination risk):
Real jersey numbers and official roster lists are critical. A language model without internet access CAN FABRICATE this data. Therefore:
- Generate this data set with a tool that has web access OR feed it with data verified from official FIFA/federation World Cup roster announcements.
- Fabricated jersey numbers/players are UNACCEPTABLE. Mark fields you are not sure of, do not make them up.

Roughly 1248 players total (48 x 26). Output ready-to-use code.
```

---

## 6. HACKATHON REQUIREMENTS & THINGS TO WATCH

```
This project is for the Superteam Earn World Cup hackathon, "Consumer and Fan Experiences" track. The following are binding.

MANDATORY (missing any of these means automatic elimination):
- TxLINE data must be used as a LIVE INPUT, at the core of the product. Not just integrated, but at the center of the flow.
- Registration via Solana / Solana usage is mandatory.
- A working product (live devnet or mainnet), able to run during a match. Mockup/wireframe/deck-only = automatic disqualification.
- A deployed working link OR a testable API endpoint must be provided.

EVALUATION CRITERIA (the judges score these):
1. Fan Accessibility & UX: would a non-technical football fan open it regularly, is it intuitive and polished?
2. Real-Time Responsiveness: does it respond live and smoothly to what happens on the pitch?
3. Originality & Value Creation: is it a genuinely new experience, or a repackaging of an existing feed? (OUR WEAKEST AXIS - addressed by live onchain settlement + living cards + light format.)
4. Commercial & Monetization Path: a clear, viable business/revenue model.
5. Completeness & Execution: an end-to-end working product feel, even if the scope is small.

CRITICAL NOTE - DEMO VIDEO:
The evaluation relies heavily on the demo video. Because the matches end after the submission deadline, there MAY BE no live match activity when the judges review. Therefore:
- The demo video (max 5 min) must CLEARLY show the product experience, the user flow, and how TxLINE feeds the backend.
- If there is no live match: pull past-match data from TxLINE and replay it retroactively to simulate the live experience. Be sure to show the live movement of the points/leaderboard in the video.

SUBMISSION PACKAGE:
- Demo video link (Loom/YouTube) - absolutely mandatory to pass the first cut.
- Working deploy link or API endpoint.
- Short technical documentation: core idea, technical/business highlights, and a list of the TxLINE endpoints USED.
- TxLINE API experience feedback (what you liked, where you struggled).

STRATEGIC PRIORITY:
- Since originality is our weakest axis, put live onchain settlement at the CENTER of the product and the demo. Highlight the "live, verifiable, living-card onchain fantasy" story both in the product and the video.
- Address the Sorare comparison proactively in the demo/docs: clearly state the "not a static collectible, live onchain + living cards" difference.
- The no-risk revenue model (no betting/pools) is an honest and defensible story for the commercial criterion; present it as a differentiator, not a weakness.
```
