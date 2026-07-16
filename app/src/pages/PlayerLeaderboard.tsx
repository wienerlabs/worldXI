import { useEffect, useMemo, useState } from "react";
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

  // Scoreboard vitals — hero of a sports page.
  const leaderPoints = rows.length ? rows[0].totalPoints : 0;
  const totalPoints = useMemo(() => rows.reduce((s, r) => s + r.totalPoints, 0), [rows]);

  return (
    <div>
      {/* ================= BROADCAST HEADER ================= */}
      <section style={{ position: "relative", paddingTop: 30 }}>
        {/* Oversized backdrop wordmark */}
        <div aria-hidden style={{
          position: "absolute", top: -6, right: -10, left: -10, textAlign: "center",
          fontFamily: "var(--font-display)", fontSize: "clamp(70px, 15vw, 190px)", lineHeight: 0.8,
          color: "transparent", WebkitTextStroke: "1px rgba(243,241,231,0.045)", letterSpacing: "0.02em",
          pointerEvents: "none", userSelect: "none", zIndex: 0, overflow: "hidden", whiteSpace: "nowrap",
        }}>
          SCORERS
        </div>

        <div className="between" style={{ position: "relative", zIndex: 1, alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow gold rise" style={{ animationDelay: "0.04s" }}>On-chain scoring · World Cup 2026</div>
            <h1 className="display rise" style={{ animationDelay: "0.1s", fontSize: "clamp(38px, 6vw, 78px)", marginTop: 14 }}>
              Player <span className="gold">leaderboard</span>
            </h1>
            <p className="section-sub rise" style={{ animationDelay: "0.18s" }}>
              Top fantasy scorers across the tournament. Every goal, card and assist is written to
              Solana <b className="gold" style={{ fontWeight: 800 }}>live, as matches play out</b>.
            </p>
          </div>
          <span className="live rise" style={{ animationDelay: "0.22s", marginBottom: 8 }}>
            <span className="live-dot" /> Live · 5s refresh
          </span>
        </div>

        {/* Scoreboard vitals */}
        <div className="rise" style={{ animationDelay: "0.28s", display: "flex", gap: 30, marginTop: 30, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Vital value={leaderPoints.toLocaleString()} label="Top score" accent="var(--gold)" />
          <span style={{ width: 1, alignSelf: "stretch", background: "var(--line-2)" }} />
          <Vital value={rows.length.toLocaleString()} label="Scorers ranked" accent="var(--volt)" />
          <span style={{ width: 1, alignSelf: "stretch", background: "var(--line-2)" }} />
          <Vital value={totalPoints.toLocaleString()} label="Total points logged" accent="var(--chalk)" />
        </div>
      </section>

      {/* ================= LEADERBOARD ================= */}
      <section className="section" style={{ marginTop: 40 }}>
        <div className="section-head between">
          <div className="eyebrow">The board</div>
          <span className="pill pill-live">On chain</span>
        </div>

        {err ? (
          <div className="panel panel-notch rise" style={{ padding: "44px 30px", textAlign: "center", borderColor: "var(--line-2)" }}>
            <div className="eyebrow" style={{ justifyContent: "center", color: "var(--live)" }}>
              <span style={{ background: "var(--live)" }} />Signal lost
            </div>
            <h3 className="display" style={{ fontSize: "clamp(24px,4vw,40px)", marginTop: 14 }}>
              Oracle feed unreachable
            </h3>
            <p className="muted" style={{ marginTop: 10, maxWidth: "48ch", marginInline: "auto" }}>
              The scoring oracle is offline. Bring the backend up to resume the live feed:
            </p>
            <code className="mono" style={{
              display: "inline-block", marginTop: 16, padding: "10px 16px", borderRadius: "var(--r-sm)",
              background: "var(--surface-2)", border: "1px solid var(--line-2)", color: "var(--volt)", fontSize: 13,
            }}>cd oracle &amp;&amp; npm run orchestrate</code>
          </div>
        ) : (
          <div className="panel panel-flush panel-notch rise" style={{ animationDelay: "0.05s" }}>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 64 }}>Rank</th>
                    <th>Player</th>
                    <th>Nation</th>
                    <th>Pos</th>
                    <th style={{ textAlign: "right" }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const p = r.player ?? playerById.get(r.playerId);
                    const c = p ? countryByIso.get(p.nationalTeam) : undefined;
                    const isTop = r.rank <= 3;
                    const topClass = isTop ? `top${r.rank}` : "";
                    return (
                      <tr key={r.playerId} className={topClass}>
                        <td><span className="rank-num">{r.rank}</span></td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
                            {p?.photo && (
                              <img
                                className="avatar"
                                src={p.photo}
                                alt=""
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                            {p ? (
                              <Link
                                to={`/player/${r.playerId}`}
                                className="gold"
                                style={{ fontWeight: 800, letterSpacing: "-0.01em" }}
                              >
                                {p.name}
                              </Link>
                            ) : (
                              <span className="mono muted">#{r.playerId}</span>
                            )}
                          </span>
                        </td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 17, lineHeight: 1 }}>{c?.flagEmoji}</span>
                            <span className="mono" style={{ fontSize: 12, letterSpacing: "0.06em", color: "var(--chalk-2)" }}>
                              {p?.nationalTeam}
                            </span>
                          </span>
                        </td>
                        <td><span className="pill">{p?.position}</span></td>
                        <td style={{ textAlign: "right" }}>
                          <span
                            className="num"
                            style={{
                              fontSize: isTop ? 30 : 24,
                              color: isTop ? "var(--gold)" : "var(--chalk)",
                            }}
                          >
                            {r.totalPoints}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div className="empty-state" style={{ border: "none", borderRadius: 0, background: "transparent" }}>
                          <div className="eyebrow" style={{ justifyContent: "center" }}>Kickoff pending</div>
                          <p style={{ marginTop: 12, fontSize: 15 }}>
                            No points on the board yet — waiting for the first match events to settle on-chain.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Vital({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div>
      <div className="num" style={{ fontSize: "clamp(30px,4vw,46px)", color: accent }}>{value}</div>
      <div className="stat-label" style={{ textAlign: "left", marginTop: 6 }}>{label}</div>
    </div>
  );
}
