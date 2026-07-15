import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Player, Position } from "./types";
import { BUDGET_SOL, FORMATIONS, MAX_PER_COUNTRY } from "./types";
import { useData } from "./data";

interface SquadCtx {
  picks: Player[];
  starterIds: number[]; // manuel ilk 11
  bench: Player[];
  starters: Player[];
  formation: string;
  captainId: number | null;
  spent: number;
  remaining: number;
  add: (p: Player) => string | null;
  remove: (id: number) => void;
  setFormation: (f: string) => void;
  setCaptain: (id: number) => void;
  /** Swaps a bench player with a starter in the same position (moves into the starting 11). */
  swapToStarter: (benchId: number, starterOutId: number) => string | null;
  isStarter: (id: number) => boolean;
  clear: () => void;
}

const Ctx = createContext<SquadCtx | null>(null);
const KEY = "worldxi.squad.v2";

interface Persisted {
  picks: Player[];
  formation: string;
  captainId: number | null;
  starterIds: number[];
}

const POS_LIMITS: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

/** Starter position needs for the formation (1 GK fixed). */
function need(formation: string): Record<Position, number> {
  const s = FORMATIONS[formation] ?? FORMATIONS.F433;
  return { GK: 1, DEF: s.def, MID: s.mid, FWD: s.fwd };
}

/** Picks the default starting 11 from the current picks according to the formation. */
function defaultStarters(picks: Player[], formation: string): number[] {
  const n = need(formation);
  const out: number[] = [];
  (["GK", "DEF", "MID", "FWD"] as Position[]).forEach((pos) => {
    picks.filter((p) => p.position === pos).slice(0, n[pos]).forEach((p) => out.push(p.playerId));
  });
  return out;
}

export function SquadProvider({ children }: { children: ReactNode }) {
  const [rawState, setState] = useState<Persisted>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Persisted;
    } catch {
      /* ignore */
    }
    return { picks: [], formation: "F433", captainId: null, starterIds: [] };
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(rawState));
  }, [rawState]);

  // Always enrich picks with the current data set (photo, price, position).
  // localStorage only stores which players were selected; fields like photo
  // are refreshed from players.json (by playerId) - so old squads also
  // get the new photos/data.
  const { playerById } = useData();
  const state = useMemo<Persisted>(
    () => ({ ...rawState, picks: rawState.picks.map((p) => playerById.get(p.playerId) ?? p) }),
    [rawState, playerById]
  );

  const spent = useMemo(() => state.picks.reduce((s, p) => s + p.priceSol, 0), [state.picks]);

  const value = useMemo<SquadCtx>(() => {
    const posCount = (pos: string) => state.picks.filter((p) => p.position === pos).length;
    const countryCount = (iso: string) => state.picks.filter((p) => p.nationalTeam === iso).length;
    const starterSet = new Set(state.starterIds);
    const posById = new Map(state.picks.map((p) => [p.playerId, p.position]));

    const add = (p: Player): string | null => {
      if (state.picks.length >= 15) return "Squad full (15 players).";
      if (state.picks.some((x) => x.playerId === p.playerId)) return "Already in your squad.";
      if (posCount(p.position) >= POS_LIMITS[p.position]) return `${p.position} slots are full.`;
      if (countryCount(p.nationalTeam) >= MAX_PER_COUNTRY) return "Max 3 players per country.";
      if (spent + p.priceSol > BUDGET_SOL) return "Not enough budget.";
      setState((s) => {
        const n = need(s.formation);
        const startersInPos = s.starterIds.filter((id) => posById.get(id) === p.position).length;
        const starterIds =
          startersInPos < n[p.position] ? [...s.starterIds, p.playerId] : s.starterIds;
        return { ...s, picks: [...s.picks, p], starterIds };
      });
      return null;
    };

    const remove = (id: number) =>
      setState((s) => {
        const pos = posById.get(id);
        let starterIds = s.starterIds.filter((x) => x !== id);
        // if a starter was removed, move a bench player from the same position into the starting 11
        if (s.starterIds.includes(id) && pos) {
          const sub = s.picks.find((p) => p.position === pos && !starterIds.includes(p.playerId) && p.playerId !== id);
          if (sub) starterIds = [...starterIds, sub.playerId];
        }
        return {
          ...s,
          picks: s.picks.filter((p) => p.playerId !== id),
          starterIds,
          captainId: s.captainId === id ? null : s.captainId,
        };
      });

    const setFormation = (f: string) =>
      setState((s) => ({ ...s, formation: f, starterIds: defaultStarters(s.picks, f) }));

    const setCaptain = (id: number) => setState((s) => ({ ...s, captainId: id }));

    const swapToStarter = (benchId: number, starterOutId: number): string | null => {
      const inPos = posById.get(benchId);
      const outPos = posById.get(starterOutId);
      if (!inPos || inPos !== outPos) return "Players must be the same position.";
      setState((s) => ({
        ...s,
        starterIds: s.starterIds.map((x) => (x === starterOutId ? benchId : x)),
        captainId: s.captainId === starterOutId ? benchId : s.captainId,
      }));
      return null;
    };

    const clear = () => setState({ picks: [], formation: "F433", captainId: null, starterIds: [] });

    const starters = state.starterIds
      .map((id) => state.picks.find((p) => p.playerId === id))
      .filter((p): p is Player => !!p);
    const bench = state.picks.filter((p) => !starterSet.has(p.playerId));

    return {
      picks: state.picks,
      starterIds: state.starterIds,
      starters,
      bench,
      formation: state.formation,
      captainId: state.captainId,
      spent,
      remaining: BUDGET_SOL - spent,
      add,
      remove,
      setFormation,
      setCaptain,
      swapToStarter,
      isStarter: (id: number) => starterSet.has(id),
      clear,
    };
  }, [state, spent]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSquad(): SquadCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSquad must be used within SquadProvider");
  return c;
}
