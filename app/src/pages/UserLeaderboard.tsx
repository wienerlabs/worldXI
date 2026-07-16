import { useEffect, useMemo, useState } from "react";
import { fetchUserLeaderboard } from "../lib/api";
import { useData } from "../lib/data";
import type { UserLeaderRow } from "../lib/types";

const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

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

  const liveTotal = useMemo(
    () => rows.reduce((sum, r) => sum + (r.provisionalPoints || 0), 0),
    [rows]
  );

  return (
    <div className="section" style={{ marginTop: 28 }}>
      {/* ============ HEADER ============ */}
      <div className="rise" style={{ animationDelay: "0.04s" }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="eyebrow gold">Standings · Managers</div>
          <span className="live"><span className="live-dot" /> Live</span>
        </div>

        <div className="between" style={{ marginTop: 14, alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
            <h1 className="section-title">Managers</h1>
            <span className="mono" style={{ fontSize: 12.5, color: "var(--muted)", letterSpacing: "0.06em" }}>
              {rows.length} {rows.length === 1 ? "manager" : "managers"}
            </span>
          </div>

          {/* Segmented scope toggle */}
          <div
            role="tablist"
            aria-label="Leaderboard scope"
            style={{
              display: "inline-flex",
              gap: 4,
              padding: 4,
              borderRadius: 999,
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
            }}
          >
            {(["global", "daily"] as const).map((s) => {
              const active = scope === s;
              return (
                <button
                  key={s}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setScope(s)}
                  className="mono"
                  style={{
                    padding: "7px 18px",
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    transition: "all 0.2s var(--ease)",
                    background: active ? "var(--gold)" : "transparent",
                    color: active ? "var(--on-gold)" : "var(--muted)",
                    boxShadow: active ? "0 6px 20px -8px rgba(232,189,84,0.8)" : "none",
                  }}
                >
                  {s === "global" ? "Global" : "Today"}
                </button>
              );
            })}
          </div>
        </div>

        <p className="section-sub" style={{ marginTop: 12 }}>
          {scope === "global"
            ? "Final points are settled on-chain; provisional points are computed live from your starters during a match."
            : "Today's standings — provisional points from the current/latest matchday only."}
        </p>
      </div>

      {/* ============ ERROR STATE ============ */}
      {err && (
        <div className="empty-state rise" style={{ marginTop: 26, animationDelay: "0.1s" }}>
          <div className="num" style={{ fontSize: 44, color: "var(--live)", lineHeight: 1 }}>—</div>
          <div style={{ marginTop: 14, fontWeight: 800, fontSize: 17, color: "var(--chalk)" }}>
            Oracle signal lost
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 14, maxWidth: "44ch", marginInline: "auto" }}>
            The oracle API is unreachable. Start the backend to load live manager standings.
          </p>
          <div className="mono" style={{ marginTop: 16, fontSize: 11, letterSpacing: "0.14em", color: "var(--faint)", textTransform: "uppercase" }}>
            Retrying every 5s…
          </div>
        </div>
      )}

      {/* ============ LEADERBOARD ============ */}
      {!err && (
        <div className="rise" style={{ marginTop: 26, animationDelay: "0.12s" }}>
          {rows.length === 0 ? (
            <div className="empty-state">
              <div className="num" style={{ fontSize: 46, color: "var(--gold)", lineHeight: 1 }}>01</div>
              <div style={{ marginTop: 14, fontWeight: 800, fontSize: 17, color: "var(--chalk)" }}>
                No managers on the board yet
              </div>
              <p className="muted" style={{ marginTop: 8, fontSize: 14, maxWidth: "42ch", marginInline: "auto" }}>
                Be the first to submit a squad and claim the top of the table.
              </p>
            </div>
          ) : (
            <div className="panel panel-flush">
              {/* Live tally strip */}
              <div
                className="between"
                style={{
                  padding: "12px 18px",
                  borderBottom: "1px solid var(--line)",
                  background: "rgba(255,255,255,0.012)",
                }}
              >
                <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)" }}>
                  {scope === "global" ? "Overall table" : "Matchday table"}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)" }}>
                    Live points in play
                  </span>
                  <span className="num volt" style={{ fontSize: 20 }}>+{liveTotal}</span>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>#</th>
                      <th>Manager</th>
                      <th>Nation</th>
                      <th>Wallet</th>
                      <th style={{ textAlign: "right" }}>Final</th>
                      <th style={{ textAlign: "right" }}>Live</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const country = r.countryCode ? countryByIso.get(r.countryCode) : undefined;
                      const topClass = r.rank <= 3 ? `top${r.rank}` : "";
                      const medal = MEDALS[r.rank];
                      return (
                        <tr key={r.owner} className={topClass}>
                          <td>
                            <span className="rank-num">{medal ?? r.rank}</span>
                          </td>
                          <td>
                            <span className="gold" style={{ fontWeight: 800, fontSize: 15 }}>{r.nickname}</span>
                          </td>
                          <td>
                            {country ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 17 }}>{country.flagEmoji}</span>
                                <span
                                  className="mono"
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    letterSpacing: "0.08em",
                                    color: country.primaryColor ?? "var(--chalk-2)",
                                  }}
                                >
                                  {r.countryCode}
                                </span>
                              </span>
                            ) : (
                              <span className="faint">—</span>
                            )}
                          </td>
                          <td>
                            <span className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                              {shortAddr(r.owner)}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span className="num" style={{ fontSize: 22, color: "var(--chalk)" }}>{r.finalPoints}</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span
                              className="num"
                              style={{
                                fontSize: 18,
                                color: r.provisionalPoints > 0 ? "var(--volt)" : "var(--faint)",
                              }}
                            >
                              +{r.provisionalPoints}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
