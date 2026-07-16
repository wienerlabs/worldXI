import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadCountries, loadPlayers, fetchPlayerStats, type PlayerStats } from "./api";
import type { Country, Player } from "./types";

interface DataCtx {
  players: Player[];
  countries: Country[];
  countryByIso: Map<string, Country>;
  playerById: Map<number, Player>;
  playersByCountry: Map<string, Player[]>;
  /** Real per-player tournament stats (live from oracle): points, matches, MVP, best. */
  statsById: Map<number, PlayerStats>;
  loading: boolean;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadPlayers(), loadCountries()])
      .then(([p, c]) => {
        setPlayers(p);
        setCountries(c);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  // Live tournament stats from the oracle; refreshed periodically so cards/leaderboards move.
  useEffect(() => {
    let alive = true;
    const load = () => fetchPlayerStats().then((s) => { if (alive) setStats(s); }).catch(() => undefined);
    load();
    const t = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const value = useMemo<DataCtx>(() => {
    const countryByIso = new Map(countries.map((c) => [c.isoCode, c]));
    const playerById = new Map(players.map((p) => [p.playerId, p]));
    const statsById = new Map(stats.map((s) => [s.playerId, s]));
    const playersByCountry = new Map<string, Player[]>();
    for (const p of players) {
      const arr = playersByCountry.get(p.nationalTeam) ?? [];
      arr.push(p);
      playersByCountry.set(p.nationalTeam, arr);
    }
    return { players, countries, countryByIso, playerById, playersByCountry, statsById, loading };
  }, [players, countries, stats, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData must be used within DataProvider");
  return c;
}
