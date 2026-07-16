import { useData } from "../lib/data";
import { PlayerCard } from "./PlayerCard";
import { FORMATIONS, type Position } from "../lib/types";

/** Renders a starting 11 on a pitch (formation rows), My Squad style. Used for a manager's
 *  active squad and for each matchday's saved lineup. Players resolved from the data context. */
export function SquadPitch({ starters, formation, captain, width = 82 }: {
  starters: number[];
  formation: string;
  captain: number;
  width?: number;
}) {
  const { playerById, countryByIso } = useData();
  const shape = FORMATIONS[formation.toUpperCase()] ?? FORMATIONS.F433;
  const line = (pos: Position, count: number) =>
    starters.map((id) => playerById.get(id)).filter((p): p is NonNullable<typeof p> => p?.position === pos).slice(0, count);
  const rows = [line("FWD", shape.fwd), line("MID", shape.mid), line("DEF", shape.def), line("GK", 1)];

  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(31,157,99,0.5)", background: "linear-gradient(180deg, rgba(18,53,35,0.55), rgba(10,30,20,0.4))", padding: "22px 12px" }}>
      {/* pitch centre line + circle */}
      <svg viewBox="0 0 100 130" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }}>
        <g fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="0.4">
          <rect x="2" y="2" width="96" height="126" />
          <line x1="2" y1="65" x2="98" y2="65" />
          <circle cx="50" cy="65" r="9" />
        </g>
      </svg>
      <div style={{ position: "relative", zIndex: 1 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", margin: "8px 0" }}>
            {row.map((p) => (
              <div key={p.playerId} style={{ position: "relative" }}>
                <PlayerCard player={p} country={countryByIso.get(p.nationalTeam)} width={width} />
                {captain === p.playerId && (
                  <span style={{ position: "absolute", top: 2, right: 2, zIndex: 2, background: "var(--gold)", color: "#0b0b0b", fontWeight: 900, fontSize: 11, width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center" }} title="Captain">C</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
