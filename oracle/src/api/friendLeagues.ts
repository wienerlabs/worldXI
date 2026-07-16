/**
 * Friend-league API: private invite-code leagues where friends compete among themselves.
 *
 * On-chain source (real): FriendLeague + LeagueMembership accounts. A member's points are
 * the same provisional total used by the global Managers board (rarity bonus + captain 2x),
 * so a player ranks BOTH inside the league and globally. Squads are withheld until the first
 * match has started (matchStarted) so friends cannot see each other's lineups beforehand.
 */
import type { Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import type { Config } from "../config.js";
import type { OracleState } from "../state.js";
import { type ChainContext, tournamentPda, squadPda, profilePda } from "../chain/program.js";
import type { Rarity } from "../domain.js";
import { logger, errorMessage } from "../logger.js";

const RARITY_BPS: Record<Rarity, number> = { Common: 10_000, Rare: 10_500, Legendary: 11_000 };

/** Decodes the on-chain [u8; 6] invite code into a readable string. */
function codeToString(code: number[] | Uint8Array): string {
  return Buffer.from(code as number[]).toString("ascii").replace(/\0+$/, "");
}

export interface FriendLeaguesApi {
  listUserLeagues: (req: Request, res: Response) => Promise<void>;
  leagueDetail: (req: Request, res: Response) => Promise<void>;
  managerDetail: (req: Request, res: Response) => Promise<void>;
}

export function createFriendLeaguesApi(cfg: Config, state: OracleState, ctx: ChainContext): FriendLeaguesApi {
  // A member's provisional points: same formula as the global Managers leaderboard.
  const provisionalPoints = (squad: { starters: number[]; captain: number }): number => {
    let total = 0;
    for (const id of squad.starters) {
      const raw = state.playerLivePoints(id);
      const entry = state.universe.get(id);
      const bps = entry ? RARITY_BPS[entry.rarity] : 10_000;
      let pts = Math.floor((raw * bps) / 10_000);
      if (id === squad.captain) pts *= 2;
      total += pts;
    }
    return total;
  };

  const listUserLeagues = async (req: Request, res: Response): Promise<void> => {
    try {
      const owner = String(req.params.owner ?? "");
      new PublicKey(owner); // validate
      // LeagueMembership layout: disc(8) + league(32) + owner(32) -> owner at offset 40.
      const memberships = await ctx.program.account.leagueMembership.all([
        { memcmp: { offset: 8 + 32, bytes: owner } },
      ]);
      const leagues = await Promise.all(
        memberships.map(async (m) => {
          const lg = await ctx.program.account.friendLeague.fetch(m.account.league as PublicKey);
          return {
            pubkey: (m.account.league as PublicKey).toBase58(),
            name: lg.name as string,
            code: codeToString(lg.code as number[]),
            memberCount: lg.memberCount as number,
            isCreator: (lg.creator as PublicKey).toBase58() === owner,
          };
        })
      );
      res.json(leagues);
    } catch (error: unknown) {
      logger.error("list user leagues failed", { error: errorMessage(error) });
      res.status(500).json({ error: "could not load leagues" });
    }
  };

  const leagueDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const pubkey = String(req.params.pubkey ?? "");
      const leagueKey = new PublicKey(pubkey);
      const lg = await ctx.program.account.friendLeague.fetch(leagueKey);

      // Members: LeagueMembership with league at offset 8.
      const memberships = await ctx.program.account.leagueMembership.all([
        { memcmp: { offset: 8, bytes: pubkey } },
      ]);
      const owners = new Set(memberships.map((m) => (m.account.owner as PublicKey).toBase58()));

      const [profiles, squads] = await Promise.all([
        ctx.program.account.userProfile.all(),
        ctx.program.account.squad.all(),
      ]);
      const profileByOwner = new Map(profiles.map((p) => [(p.account.owner as PublicKey).toBase58(), p.account]));
      const squadByOwner = new Map(squads.map((s) => [(s.account.owner as PublicKey).toBase58(), s.account]));

      // Lineups are only revealed once the tournament has produced/entered a live matchday.
      const matchStarted = state.matchdayResults.size > 0 || state.activeMatchday > 0;

      const members = [...owners]
        .map((owner) => {
          const prof = profileByOwner.get(owner) as { nickname?: string } | undefined;
          const squad = squadByOwner.get(owner) as
            | { starters: number[]; players: number[]; captain: number; formation: Record<string, unknown> }
            | undefined;
          const points = squad ? provisionalPoints(squad) : 0;
          return {
            owner,
            nickname: prof?.nickname ?? `${owner.slice(0, 4)}..${owner.slice(-4)}`,
            hasSquad: !!squad,
            points,
            // Hidden until kickoff; frontend also guards, but we withhold the data too.
            squad:
              matchStarted && squad
                ? {
                    players: squad.players,
                    starters: squad.starters,
                    captain: squad.captain,
                    formation: Object.keys(squad.formation)[0] ?? "f433",
                  }
                : null,
          };
        })
        .sort((a, b) => b.points - a.points)
        .map((m, i) => ({ ...m, rank: i + 1 }));

      res.json({
        pubkey,
        name: lg.name as string,
        code: codeToString(lg.code as number[]),
        creator: (lg.creator as PublicKey).toBase58(),
        memberCount: lg.memberCount as number,
        matchStarted,
        members,
      });
    } catch (error: unknown) {
      logger.error("league detail failed", { error: errorMessage(error) });
      res.status(500).json({ error: "could not load league" });
    }
  };

  // A single manager's detail: active squad (#1) + per-matchday lineup & points history
  // (#2, #3) from on-chain SquadSnapshot accounts. Past snapshots stay viewable even after
  // the manager changes their active lineup.
  const managerDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const owner = String(req.params.owner ?? "");
      const ownerPk = new PublicKey(owner);
      const tournament = tournamentPda(ctx.programId, cfg.TOURNAMENT_NAME);
      const [squad, prof, snaps] = await Promise.all([
        ctx.program.account.squad.fetchNullable(squadPda(ctx.programId, tournament, ownerPk)),
        ctx.program.account.userProfile.fetchNullable(profilePda(ctx.programId, ownerPk)),
        // SquadSnapshot layout: disc(8) + owner(32) -> owner at offset 8.
        ctx.program.account.squadSnapshot.all([{ memcmp: { offset: 8, bytes: owner } }]),
      ]);

      const matchStarted = state.matchdayResults.size > 0 || state.activeMatchday > 0;
      const activeSquad = squad
        ? {
            players: squad.players as number[],
            starters: squad.starters as number[],
            captain: squad.captain as number,
            formation: Object.keys(squad.formation as Record<string, unknown>)[0] ?? "f433",
            points: provisionalPoints(squad as { starters: number[]; captain: number }),
          }
        : null;

      const history = snaps
        .map((s) => ({
          matchday: s.account.matchday as number,
          starters: s.account.starters as number[],
          captain: s.account.captain as number,
          formation: Object.keys(s.account.formation as Record<string, unknown>)[0] ?? "f433",
          points: (s.account.points as { toNumber(): number }).toNumber(),
        }))
        .sort((a, b) => a.matchday - b.matchday);

      res.json({
        owner,
        nickname: (prof?.nickname as string | undefined) ?? `${owner.slice(0, 4)}..${owner.slice(-4)}`,
        matchStarted,
        activeSquad,
        history,
      });
    } catch (error: unknown) {
      logger.error("manager detail failed", { error: errorMessage(error) });
      res.status(500).json({ error: "could not load manager" });
    }
  };

  return { listUserLeagues, leagueDetail, managerDetail };
}
