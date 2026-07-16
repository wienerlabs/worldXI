import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchLeagueDetail, type LeagueDetailData } from "../lib/api";

/** A friend league's standings. Members rank by the same points as the global Managers
 *  board. Tapping a member opens their own page (/manager/:owner) with their active squad
 *  and every matchday's saved lineup. Lineups stay hidden until the first match starts. */
export function LeagueDetail() {
  const { pubkey } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<LeagueDetailData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!pubkey) return;
    let alive = true;
    const load = () =>
      fetchLeagueDetail(pubkey)
        .then((d) => { if (alive) { setData(d); setErr(false); } })
        .catch(() => alive && setErr(true));
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [pubkey]);

  if (err) return <div className="empty-state" style={{ marginTop: 48 }}>Could not load this league. <Link className="gold" to="/leagues">Back to leagues</Link></div>;
  if (!data) return <div className="panel" style={{ marginTop: 40, padding: "40px 24px", textAlign: "center" }}><span className="mono muted">Loading league…</span></div>;

  const copyCode = () => void navigator.clipboard?.writeText(data.code);

  return (
    <div style={{ marginTop: 26 }}>
      <Link className="mono muted" to="/leagues" style={{ fontSize: 12 }}>Back to leagues</Link>

      {/* ================= HEADER ================= */}
      <section className="panel panel-notch sweep rise" style={{ marginTop: 10, padding: "clamp(22px,3vw,34px)", borderTop: "2px solid var(--volt)" }}>
        <div className="between" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div className="eyebrow" style={{ color: "var(--volt)" }}>Friend league</div>
            <h1 className="display" style={{ fontSize: "clamp(30px,5vw,58px)", marginTop: 12 }}>{data.name}</h1>
            <div className="row" style={{ gap: 10, marginTop: 14, alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)" }}>Invite code</span>
              <button onClick={copyCode} className="num" title="Copy code"
                style={{ fontSize: 24, color: "var(--gold)", letterSpacing: "0.16em", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {data.code}
              </button>
              <span className="mono muted" style={{ fontSize: 11 }}>· {data.memberCount} member{data.memberCount === 1 ? "" : "s"}</span>
            </div>
          </div>
          {data.matchStarted ? (
            <span className="pill pill-live"><span className="live-dot" style={{ width: 6, height: 6 }} /> Lineups revealed</span>
          ) : (
            <span className="pill">Lineups hidden until kickoff</span>
          )}
        </div>
      </section>

      {/* ================= STANDINGS ================= */}
      <section className="section">
        <div className="section-head"><div className="eyebrow gold">Standings</div><h2 className="section-title" style={{ marginTop: 12 }}>League table</h2>
          <p className="section-sub">Tap a manager to see their squad and every matchday's lineup.</p>
        </div>

        {!data.matchStarted && (
          <p className="mono" style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
            Members' lineups stay secret until the first match kicks off. Points still update live.
          </p>
        )}

        <div className="panel panel-flush panel-notch rise">
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th style={{ width: 64 }}>Rank</th><th>Manager</th><th style={{ textAlign: "right" }}>Points</th><th style={{ width: 40 }} /></tr>
              </thead>
              <tbody>
                {data.members.map((m) => {
                  const isTop = m.rank <= 3;
                  return (
                    <tr key={m.owner} className={isTop ? `top${m.rank}` : ""} onClick={() => navigate(`/manager/${m.owner}`)} style={{ cursor: "pointer" }}>
                      <td><span className="rank-num">{m.rank}</span></td>
                      <td>
                        <span style={{ fontWeight: 800, color: isTop ? "var(--gold)" : "var(--chalk)" }}>{m.nickname}</span>
                        {!m.hasSquad && <span className="mono muted" style={{ fontSize: 11, marginLeft: 8 }}>no squad</span>}
                      </td>
                      <td style={{ textAlign: "right" }}><span className="num" style={{ fontSize: isTop ? 28 : 22, color: isTop ? "var(--gold)" : "var(--chalk)" }}>{m.points}</span></td>
                      <td style={{ textAlign: "center", color: "var(--muted)", fontSize: 13 }}>›</td>
                    </tr>
                  );
                })}
                {data.members.length === 0 && (
                  <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: "34px 16px" }}>No members yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
