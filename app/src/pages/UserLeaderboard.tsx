import { useEffect, useState } from "react";
import { fetchUserLeaderboard } from "../lib/api";
import { useData } from "../lib/data";
import type { UserLeaderRow } from "../lib/types";

const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/** Manager leaderboard, final (settled) + live provisional totals. */
export function UserLeaderboard() {
  const { countryByIso } = useData();
  const [rows, setRows] = useState<UserLeaderRow[]>([]);
  const [err, setErr] = useState(false);
  const [scope, setScope] = useState<"global" | "daily">("global");

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchUserLeaderboard(scope)
        .then((r) => { if (alive) { setRows(r); setErr(false); } })
        .catch(() => alive && setErr(true));
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [scope]);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="section-title">Managers</h1>
        <span className="live"><span className="live-dot" /> Live</span>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button className={scope === "global" ? "btn btn-primary" : "btn btn-outline"} style={{ padding: "6px 14px" }} onClick={() => setScope("global")}>Global</button>
          <button className={scope === "daily" ? "btn btn-primary" : "btn btn-outline"} style={{ padding: "6px 14px" }} onClick={() => setScope("daily")}>Today</button>
        </div>
      </div>
      <p className="section-sub">
        {scope === "global"
          ? "Final points are settled on-chain; provisional points are computed live from your starters during a match."
          : "Today's standings - provisional points from the current/latest matchday only."}
      </p>
      {err && <div className="card">Oracle API unreachable. Start the backend to load manager standings.</div>}
      {!err && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>#</th><th>Manager</th><th>Country</th><th>Wallet</th><th>Final</th><th>Live</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.owner}>
                  <td className="muted">{r.rank}</td>
                  <td className="gold">{r.nickname}</td>
                  <td>{r.countryCode ? `${countryByIso.get(r.countryCode)?.flagEmoji ?? ""} ${r.countryCode}` : "-"}</td>
                  <td className="muted">{shortAddr(r.owner)}</td>
                  <td>{r.finalPoints}</td>
                  <td className="green" style={{ fontWeight: 800 }}>+{r.provisionalPoints}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="muted">No managers yet. Be the first to submit a squad.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
