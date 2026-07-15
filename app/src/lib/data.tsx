import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadCountries, loadPlayers } from "./api";
import type { Country, Player } from "./types";

interface DataCtx {
  players: Player[];
  countries: Country[];
  countryByIso: Map<string, Country>;
  playerById: Map<number, Player>;
  playersByCountry: Map<string, Player[]>;
  loading: boolean;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
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

  const value = useMemo<DataCtx>(() => {
    const countryByIso = new Map(countries.map((c) => [c.isoCode, c]));
    const playerById = new Map(players.map((p) => [p.playerId, p]));
    const playersByCountry = new Map<string, Player[]>();
    for (const p of players) {
      const arr = playersByCountry.get(p.nationalTeam) ?? [];
      arr.push(p);
      playersByCountry.set(p.nationalTeam, arr);
    }
    return { players, countries, countryByIso, playerById, playersByCountry, loading };
  }, [players, countries, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData must be used within DataProvider");
  return c;
}
