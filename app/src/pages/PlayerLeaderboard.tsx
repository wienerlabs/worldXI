import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fetchPlayerLeaderboard, fetchTeamLeaderboard, type TeamLeaderRow } from "../lib/api";
import { useData } from "../lib/data";
import type { PlayerLeaderRow } from "../lib/types";

type View = "players" | "teams";

/** Live leaderboard (oracle, on-chain totals). Toggles between player and team boards. */
export function PlayerLeaderboard() {
  const { playerById, countryByIso } = useData();
  const [view, setView] = useState<View>("players");
  const [rows, setRows] = useState<PlayerLeaderRow[]>([]);
  const [teams, setTeams] = useState<TeamLeaderRow[]>([]);
  const [err, setErr] = useState(false);
  const [openIso, setOpenIso] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([fetchPlayerLeaderboard(), fetchTeamLeaderboard()])
        .then(([p, t]) => { if (alive) { setRows(p); setTeams(t); setErr(false); } })
        .catch(() => alive && setErr(true));
    load();
    const timer = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  // Scoreboard vitals depend on the active board.
  const playerTotal = useMemo(() => rows.reduce((s, r) => s + r.totalPoints, 0), [rows]);
  const isTeams = view === "teams";
  const topScore = isTeams ? (teams[0]?.totalPoints ?? 0) : (rows[0]?.totalPoints ?? 0);
  const rankedCount = isTeams ? teams.length : rows.length;
  const wordmark = isTeams ? "NATIONS" : "SCORERS";

  return (
    <div>
      {/* ================= BROADCAST HEADER ================= */}
      <section style={{ position: "relative", paddingTop: 30 }}>
        <div aria-hidden style={{
          position: "absolute", top: -6, right: -10, left: -10, textAlign: "center",
          fontFamily: "var(--font-display)", fontSize: "clamp(70px, 15vw, 190px)", lineHeight: 0.8,
          color: "transparent", WebkitTextStroke: "1px rgba(243,241,231,0.045)", letterSpacing: "0.02em",
          pointerEvents: "none", userSelect: "none", zIndex: 0, overflow: "hidden", whiteSpace: "nowrap",
        }}>
          {wordmark}
        </div>

        <div className="between" style={{ position: "relative", zIndex: 1, alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow gold rise" style={{ animationDelay: "0.04s" }}>On-chain scoring · World Cup 2026</div>
            <h1 className="display rise" style={{ animationDelay: "0.1s", fontSize: "clamp(38px, 6vw, 78px)", marginTop: 14 }}>
              {isTeams ? <>Team <span className="gold">leaderboard</span></> : <>Player <span className="gold">leaderboard</span></>}
            </h1>
            <p className="section-sub rise" style={{ animationDelay: "0.18s" }}>
              {isTeams
                ? <>Every nation ranked by its players' combined fantasy output. Tap a team to see <b className="gold" style={{ fontWeight: 800 }}>how many points it scored in each match</b>.</>
                : <>Top fantasy scorers across the tournament. Every goal, card and assist is written to Solana <b className="gold" style={{ fontWeight: 800 }}>live, as matches play out</b>.</>}
            </p>
          </div>
          <span className="live rise" style={{ animationDelay: "0.22s", marginBottom: 8 }}>
            <span className="live-dot" /> Live · 5s refresh
          </span>
        </div>

        {/* Scoreboard vitals */}
        <div className="rise" style={{ animationDelay: "0.28s", display: "flex", gap: 30, marginTop: 30, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Vital value={topScore.toLocaleString()} label={isTeams ? "Top team score" : "Top score"} accent="var(--gold)" />
          <span style={{ width: 1, alignSelf: "stretch", background: "var(--line-2)" }} />
          <Vital value={rankedCount.toLocaleString()} label={isTeams ? "Nations ranked" : "Scorers ranked"} accent="var(--volt)" />
          <span style={{ width: 1, alignSelf: "stretch", background: "var(--line-2)" }} />
          <Vital value={playerTotal.toLocaleString()} label="Total points logged" accent="var(--chalk)" />
        </div>
      </section>

      {/* ================= BOARD ================= */}
      <section className="section" style={{ marginTop: 40 }}>
        <div className="section-head between" style={{ alignItems: "center" }}>
          <div className="row" style={{ gap: 16, alignItems: "center" }}>
            <div className="eyebrow">The board</div>
            {/* Players / Teams toggle */}
            <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 9, border: "1px solid var(--line-2)" }}>
              {(["players", "teams"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => { setView(v); setOpenIso(null); }}
                  style={{
                    padding: "6px 18px", borderRadius: 6, fontSize: 13, fontWeight: 800, textTransform: "capitalize",
                    background: view === v ? "var(--gold)" : "transparent",
                    color: view === v ? "#0b0b0b" : "var(--muted)",
                    border: "none", cursor: "pointer", transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <span className="pill pill-live">On chain</span>
        </div>

        {err ? (
          <div className="panel panel-notch rise" style={{ padding: "44px 30px", textAlign: "center", borderColor: "var(--line-2)" }}>
            <div className="eyebrow" style={{ justifyContent: "center", color: "var(--live)" }}>
              <span style={{ background: "var(--live)" }} />Signal lost
            </div>
            <h3 className="display" style={{ fontSize: "clamp(24px,4vw,40px)", marginTop: 14 }}>Oracle feed unreachable</h3>
            <p className="muted" style={{ marginTop: 10, maxWidth: "48ch", marginInline: "auto" }}>
              The scoring oracle is offline. Bring the backend up to resume the live feed:
            </p>
            <code className="mono" style={{
              display: "inline-block", marginTop: 16, padding: "10px 16px", borderRadius: "var(--r-sm)",
              background: "var(--surface-2)", border: "1px solid var(--line-2)", color: "var(--volt)", fontSize: 13,
            }}>cd oracle &amp;&amp; npm run orchestrate</code>
          </div>
        ) : isTeams ? (
          <TeamBoard teams={teams} openIso={openIso} onToggle={(iso) => setOpenIso(openIso === iso ? null : iso)} />
        ) : (
          <PlayerBoard rows={rows} playerById={playerById} countryByIso={countryByIso} />
        )}
      </section>
    </div>
  );
}

/* ---------------- Player board (existing) ---------------- */
function PlayerBoard({ rows, playerById, countryByIso }: {
  rows: PlayerLeaderRow[];
  playerById: ReturnType<typeof useData>["playerById"];
  countryByIso: ReturnType<typeof useData>["countryByIso"];
}) {
  return (
    <div className="panel panel-flush panel-notch rise" style={{ animationDelay: "0.05s" }}>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 64 }}>Rank</th><th>Player</th><th>Nation</th><th>Pos</th><th style={{ textAlign: "right" }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = r.player ?? playerById.get(r.playerId);
              const c = p ? countryByIso.get(p.nationalTeam) : undefined;
              const isTop = r.rank <= 3;
              return (
                <tr key={r.playerId} className={isTop ? `top${r.rank}` : ""}>
                  <td><span className="rank-num">{r.rank}</span></td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
                      {p?.photo && <img className="avatar" src={p.photo} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                      {p ? <Link to={`/player/${r.playerId}`} className="gold" style={{ fontWeight: 800, letterSpacing: "-0.01em" }}>{p.name}</Link> : <span className="mono muted">#{r.playerId}</span>}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 17, lineHeight: 1 }}>{c?.flagEmoji}</span>
                      <span className="mono" style={{ fontSize: 12, letterSpacing: "0.06em", color: "var(--chalk-2)" }}>{p?.nationalTeam}</span>
                    </span>
                  </td>
                  <td><span className="pill">{p?.position}</span></td>
                  <td style={{ textAlign: "right" }}>
                    <span className="num" style={{ fontSize: isTop ? 30 : 24, color: isTop ? "var(--gold)" : "var(--chalk)" }}>{r.totalPoints}</span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 0 }}>
                <div className="empty-state" style={{ border: "none", borderRadius: 0, background: "transparent" }}>
                  <div className="eyebrow" style={{ justifyContent: "center" }}>Kickoff pending</div>
                  <p style={{ marginTop: 12, fontSize: 15 }}>No points on the board yet — waiting for the first match events to settle on-chain.</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Team board (new, expandable) ---------------- */
function TeamBoard({ teams, openIso, onToggle }: {
  teams: TeamLeaderRow[];
  openIso: string | null;
  onToggle: (iso: string) => void;
}) {
  return (
    <div className="panel panel-flush panel-notch rise" style={{ animationDelay: "0.05s" }}>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 64 }}>Rank</th><th>Nation</th><th style={{ textAlign: "right" }}>Squad</th><th style={{ textAlign: "right" }}>Points</th><th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const isTop = t.rank <= 3;
              const open = openIso === t.iso;
              return (
                <FragmentRow key={t.iso}>
                  <tr className={isTop ? `top${t.rank}` : ""} onClick={() => onToggle(t.iso)} style={{ cursor: "pointer" }}>
                    <td><span className="rank-num">{t.rank}</span></td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
                        <span style={{ fontSize: 22, lineHeight: 1 }}>{t.flag}</span>
                        <span style={{ fontWeight: 800, letterSpacing: "-0.01em", color: isTop ? "var(--gold)" : "var(--chalk)" }}>{t.name}</span>
                        <span className="mono" style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--muted)" }}>{t.iso}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}><span className="mono" style={{ color: "var(--muted)" }}>{t.playerCount}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <span className="num" style={{ fontSize: isTop ? 30 : 24, color: isTop ? "var(--gold)" : "var(--chalk)" }}>{t.totalPoints}</span>
                    </td>
                    <td style={{ textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{open ? "▲" : "▼"}</td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0, background: "var(--surface-2)" }}>
                        <div style={{ padding: "16px 22px" }}>
                          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 12 }}>
                            Points per match
                          </div>
                          {t.breakdown.length === 0 ? (
                            <p className="muted" style={{ fontSize: 13, margin: 0 }}>No scored matches yet for this team.</p>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                              {t.breakdown.map((b) => (
                                <div key={b.matchday} className="panel" style={{ padding: "10px 14px", minWidth: 92, textAlign: "center" }}>
                                  <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--muted)" }}>MD{b.matchday}</div>
                                  <div className="num" style={{ fontSize: 22, color: b.points >= 0 ? "var(--volt)" : "var(--danger)", marginTop: 2 }}>{b.points}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
            {teams.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 0 }}>
                <div className="empty-state" style={{ border: "none", borderRadius: 0, background: "transparent" }}>
                  <div className="eyebrow" style={{ justifyContent: "center" }}>Kickoff pending</div>
                  <p style={{ marginTop: 12, fontSize: 15 }}>No team points yet — waiting for the first matches to settle on-chain.</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Wrapper so a team row + its expanded detail row share one key without an extra DOM node. */
function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function Vital({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div>
      <div className="num" style={{ fontSize: "clamp(30px,4vw,46px)", color: accent }}>{value}</div>
      <div className="stat-label" style={{ textAlign: "left", marginTop: 6 }}>{label}</div>
    </div>
  );
}
