import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPlayerLeaderboard } from "../lib/api";
import { useData } from "../lib/data";
import type { PlayerLeaderRow } from "../lib/types";

/** Player leaderboard, read live from the oracle API (on-chain totals). */
export function PlayerLeaderboard() {
  const { playerById, countryByIso } = useData();
  const [rows, setRows] = useState<PlayerLeaderRow[]>([]);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchPlayerLeaderboard()
        .then((r) => { if (alive) { setRows(r); setErr(false); } })
        .catch(() => alive && setErr(true));
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="section-title">Player Leaderboard</h1>
        <span className="live"><span className="live-dot" /> Live</span>
      </div>
      <p className="section-sub">
        Top fantasy scorers across the World Cup, points are written on-chain as matches play out.
      </p>
      {err && (
        <div className="card">Oracle API unreachable. Start the backend: <code>cd oracle &amp;&amp; npm run orchestrate</code>.</div>
      )}
      {!err && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>#</th><th>Player</th><th>Team</th><th>Pos</th><th style={{ textAlign: "right" }}>Points</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = r.player ?? playerById.get(r.playerId);
                const c = p ? countryByIso.get(p.nationalTeam) : undefined;
                const topClass = r.rank <= 3 ? `top${r.rank}` : "";
                return (
                  <tr key={r.playerId} className={topClass}>
                    <td><span className="rank-num">{r.rank}</span></td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        {p?.photo && <img className="avatar" src={p.photo} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                        {p ? <Link className="gold" to={`/player/${r.playerId}`} style={{ fontWeight: 700 }}>{p.name}</Link> : r.playerId}
                      </span>
                    </td>
                    <td>{c?.flagEmoji} {p?.nationalTeam}</td>
                    <td><span className="pill">{p?.position}</span></td>
                    <td style={{ fontWeight: 800, textAlign: "right", color: r.rank <= 3 ? "var(--gold)" : undefined }}>{r.totalPoints}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={5} className="muted">No points yet, waiting for match data.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
