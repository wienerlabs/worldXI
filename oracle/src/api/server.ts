/**
 * Leaderboard & Stats API (REST + WebSocket). For the frontend:
 *  - GET /countries, GET /players, GET /player/:id (match-by-match breakdown + tournament rank)
 *  - GET /leaderboard/players (live player leaderboard)
 *  - GET /leaderboard/users?scope=global|daily (final onchain + live provisional)
 *  - GET /live/matchday (live points of active matchday starters)
 *  - WS: {type:"tick"} is broadcast on every update -> client refreshes live
 *
 * Final (settled) totals are read from the chain; the provisional total is computed
 * client-side during a match from starters' live raw points
 * (rarity bonus + captain 2x) - the product's main live display.
 */
import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";
import type { Config } from "../config.js";
import { logger } from "../logger.js";
import type { OracleState } from "../state.js";
import type { ChainContext } from "../chain/program.js";
import type { Rarity } from "../domain.js";
import type { TxlineClient } from "../txline/client.js";
import { playerNftMetadata } from "./nftMetadata.js";
import { createMatchesApi } from "./matches.js";

const RARITY_BPS: Record<Rarity, number> = { Common: 10_000, Rare: 10_500, Legendary: 11_000 };

interface UserRow {
  owner: string;
  nickname: string;
  countryCode: string | null;
  finalPoints: number; // onchain settled
  provisionalPoints: number; // live (active matchday)
  rank: number;
}

export interface ApiHandle {
  server: Server;
  broadcast: () => void;
  close: () => Promise<void>;
}

export function startApiServer(
  cfg: Config,
  state: OracleState,
  ctx: ChainContext,
  txline: TxlineClient | null = null
): ApiHandle {
  const app: Express = express();
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
  });

  app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

  app.get("/countries", (_req: Request, res: Response) => res.json(state.countries));

  // Match hub: WC fixture list + single match detail (TxLINE live feed).
  const matches = createMatchesApi(cfg, state, txline);
  app.get("/matches/days", (req: Request, res: Response) => void matches.listDays(req, res));
  app.get("/matches", (req: Request, res: Response) => void matches.listMatches(req, res));
  app.get("/match/:fixtureId", (req: Request, res: Response) => void matches.matchDetail(req, res));

  // cNFT metadata (the endpoint the mint uri points to)
  app.get("/nft/:id", (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id ?? ""), 10);
    const player = state.universe.get(id);
    if (!player) return res.status(404).json({ error: "player not found" });
    const country = state.countries.find((c) => c.isoCode === player.nationalTeam);
    return res.json(playerNftMetadata(player, country, state.playerLivePoints(id)));
  });

  app.get("/players", (_req: Request, res: Response) => {
    res.json([...state.universe.values()]);
  });

  app.get("/player/:id", (req: Request, res: Response) => {
    const id = Number.parseInt(String(req.params.id ?? ""), 10);
    const entry = state.universe.get(id);
    if (!entry) return res.status(404).json({ error: "player not found" });
    const history = state.playerHistory(id).map((h) => ({
      matchday: h.matchday,
      fixtureId: h.result.fixtureId,
      rawPoints: h.result.rawPoints,
      wasMvp: h.result.wasMvp,
      breakdown: h.result.breakdown,
      stat: h.result.stat,
    }));
    const board = state.playerLeaderboard();
    const rank = board.find((r) => r.playerId === id)?.rank ?? null;
    const totalPoints = state.playerLivePoints(id);
    const matches = history.length;
    return res.json({
      player: entry,
      totalPoints,
      rank,
      matchesPlayed: matches,
      average: matches > 0 ? totalPoints / matches : 0,
      mvpCount: history.filter((h) => h.wasMvp).length,
      history,
    });
  });

  // Player leaderboard is served from in-memory state (total calculated from TxLINE;
  // same as the commit_score engine). Does not load the RPC (no 429).
  app.get("/leaderboard/players", (_req: Request, res: Response) => {
    const rows = state.playerLeaderboard().map((r) => ({
      ...r,
      player: state.universe.get(r.playerId) ?? null,
    }));
    res.json(rows);
  });

  app.get("/live/matchday", (_req: Request, res: Response) => {
    const md = state.matchdayResults.get(state.activeMatchday);
    const rows = md
      ? [...md.values()].map((r) => ({
          playerId: r.playerId,
          rawPoints: r.rawPoints,
          wasMvp: r.wasMvp,
        }))
      : [];
    res.json({ matchday: state.activeMatchday, players: rows });
  });

  app.get("/leaderboard/users", async (req: Request, res: Response) => {
    try {
      const scope = req.query.scope === "daily" ? "daily" : "global";
      const rows = await buildUserLeaderboard(state, ctx, scope);
      res.json(rows);
    } catch (error: unknown) {
      logger.error("user leaderboard error", { error: String(error) });
      res.status(500).json({ error: "could not build leaderboard" });
    }
  });

  // Sponsor leagues (onchain). The prize is funded by the sponsor; no entry fee.
  app.get("/leagues", async (_req: Request, res: Response) => {
    try {
      const rows = await ctx.program.account.sponsorLeague.all();
      res.json(
        rows.map((r) => ({
          name: r.account.name as string,
          sponsor: r.account.sponsor.toBase58(),
          prizeSol: (r.account.prizeLamports as { toNumber(): number }).toNumber() / 1e9,
          settled: r.account.settled as boolean,
          winner: r.account.settled ? r.account.winner.toBase58() : null,
        }))
      );
    } catch (error: unknown) {
      logger.error("leagues error", { error: String(error) });
      res.status(500).json({ error: "could not fetch leagues" });
    }
  });

  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const broadcast = (): void => {
    const msg = JSON.stringify({ type: "tick", matchday: state.activeMatchday });
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(msg);
    }
  };

  server.listen(cfg.API_PORT, () => logger.info("API listening", { port: cfg.API_PORT }));

  return {
    server,
    broadcast,
    close: () =>
      new Promise<void>((resolveClose) => {
        wss.close();
        server.close(() => resolveClose());
      }),
  };
}

/**
 * Builds the user leaderboard from on-chain profiles + squads.
 *  - global: tournament final total (onchain) + live provisional (whole tournament raw).
 *  - daily: only the latest/active matchday's provisional points (that day's ranking).
 */
async function buildUserLeaderboard(
  state: OracleState,
  ctx: ChainContext,
  scope: "global" | "daily" = "global"
): Promise<UserRow[]> {
  const [profiles, squads] = await Promise.all([
    ctx.program.account.userProfile.all(),
    ctx.program.account.squad.all(),
  ]);

  const squadByOwner = new Map<string, (typeof squads)[number]["account"]>();
  for (const s of squads) squadByOwner.set(s.account.owner.toBase58(), s.account);
  // "Today" = only the LIVE matchday. If there is no match today, activeMatchday=0 -> points 0.
  // (The latestMatchday fallback was wrong: on a match-less day it showed the last matchday.)
  const dayMd = state.activeMatchday;

  const rows: UserRow[] = profiles.map((p) => {
    const owner = p.account.owner.toBase58();
    const squad = squadByOwner.get(owner);
    let provisional = 0;
    if (squad) {
      const captain = squad.captain as number;
      for (const id of squad.starters as number[]) {
        // global: tournament total raw; daily: only that matchday's raw.
        const raw = scope === "daily" ? state.playerMatchdayPoints(dayMd, id) : state.playerLivePoints(id);
        const entry = state.universe.get(id);
        const bps = entry ? RARITY_BPS[entry.rarity] : 10_000;
        let pts = Math.floor((raw * bps) / 10_000);
        if (id === captain) pts *= 2;
        provisional += pts;
      }
    }
    const countryCode = p.account.countryCode
      ? Buffer.from(p.account.countryCode as number[]).toString("ascii")
      : null;
    // in daily scope the final (onchain tournament total) is not shown; the day's score is provisional.
    const finalPoints = scope === "daily" ? 0 : (p.account.totalPoints as { toNumber(): number }).toNumber();
    return {
      owner,
      nickname: p.account.nickname as string,
      countryCode,
      finalPoints,
      provisionalPoints: provisional,
      rank: 0,
    };
  });

  rows.sort((a, b) => b.finalPoints + b.provisionalPoints - (a.finalPoints + a.provisionalPoints));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
