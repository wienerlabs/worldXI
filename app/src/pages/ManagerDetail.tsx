import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchManagerDetail, type ManagerDetailData } from "../lib/api";
import { SquadPitch } from "../components/SquadPitch";

const shape = (f: string) => f.toUpperCase().replace("F", "").split("").join("-");

/** A manager's page: active squad (#1) + every matchday's saved lineup and points (#2, #3).
 *  Reached by tapping a member in a friend league. Past matchday lineups come from on-chain
 *  SquadSnapshot accounts, so they stay viewable even after the manager changes their lineup. */
export function ManagerDetail() {
  const { owner } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ManagerDetailData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!owner) return;
    let alive = true;
    const load = () =>
      fetchManagerDetail(owner)
        .then((d) => { if (alive) { setData(d); setErr(false); } })
        .catch(() => alive && setErr(true));
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [owner]);

  if (err) return <div className="empty-state" style={{ marginTop: 48 }}>Could not load this manager. <Link className="gold" to="/leagues">Back</Link></div>;
  if (!data) return <div className="panel" style={{ marginTop: 40, padding: "40px 24px", textAlign: "center" }}><span className="mono muted">Loading manager…</span></div>;

  return (
    <div style={{ marginTop: 26 }}>
      <button className="mono muted" onClick={() => navigate(-1)} style={{ fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Back</button>

      {/* ================= HEADER ================= */}
      <section className="panel panel-notch sweep rise" style={{ marginTop: 10, padding: "clamp(22px,3vw,34px)", borderTop: "2px solid var(--gold)" }}>
        <div className="between" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div className="eyebrow gold">Manager</div>
            <h1 className="display" style={{ fontSize: "clamp(30px,5vw,58px)", marginTop: 12 }}>{data.nickname}</h1>
            <div className="mono muted" style={{ fontSize: 12, marginTop: 8 }}>{data.owner.slice(0, 8)}…{data.owner.slice(-6)}</div>
          </div>
          {data.activeSquad && (
            <div style={{ textAlign: "right" }}>
              <div className="num gold" style={{ fontSize: "clamp(30px,4vw,46px)" }}>{data.activeSquad.points}</div>
              <div className="stat-label" style={{ textAlign: "right" }}>Live points</div>
            </div>
          )}
        </div>
      </section>

      {/* ================= ACTIVE SQUAD (#1) ================= */}
      <section className="section">
        <div className="section-head"><div className="eyebrow gold">Now</div><h2 className="section-title" style={{ marginTop: 12 }}>Active squad</h2></div>
        {!data.matchStarted ? (
          <div className="empty-state">
            <div className="num" style={{ fontSize: 40, color: "var(--volt)" }}>◎</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8, color: "var(--chalk)" }}>Lineup hidden until kickoff</div>
            <p className="mono" style={{ fontSize: 12.5, marginTop: 8, letterSpacing: "0.04em" }}>This manager's active lineup unlocks when the next match starts.</p>
          </div>
        ) : data.activeSquad ? (
          <div>
            <div className="mono muted" style={{ fontSize: 11, letterSpacing: "0.1em", marginBottom: 10 }}>Formation {shape(data.activeSquad.formation)}</div>
            <SquadPitch starters={data.activeSquad.starters} captain={data.activeSquad.captain} formation={data.activeSquad.formation} />
          </div>
        ) : (
          <div className="empty-state"><div style={{ fontWeight: 800, fontSize: 17, color: "var(--chalk)" }}>No squad submitted yet</div></div>
        )}
      </section>

      {/* ================= MATCHDAY HISTORY (#2, #3) ================= */}
      <section className="section">
        <div className="section-head"><div className="eyebrow gold">Every matchday</div><h2 className="section-title" style={{ marginTop: 12 }}>Lineup &amp; points history</h2>
          <p className="section-sub">The exact lineup used each matchday, saved on-chain, with the points it scored.</p>
        </div>
        {data.history.length === 0 ? (
          <div className="empty-state">
            <div className="num" style={{ fontSize: 40, color: "var(--faint)" }}>0</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8, color: "var(--chalk)" }}>No matchday history yet</div>
            <p className="mono" style={{ fontSize: 12.5, marginTop: 8, letterSpacing: "0.04em", maxWidth: "52ch", marginInline: "auto" }}>
              Each matchday's lineup is snapshotted on-chain the moment it settles. History fills in from the next settled match onward.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 26 }}>
            {data.history.map((md) => (
              <div key={md.matchday} className="rise">
                <div className="between" style={{ marginBottom: 12, alignItems: "baseline" }}>
                  <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
                    <span className="num" style={{ fontSize: 26, color: "var(--chalk)" }}>MD{md.matchday}</span>
                    <span className="mono muted" style={{ fontSize: 11, letterSpacing: "0.1em" }}>Formation {shape(md.formation)}</span>
                  </div>
                  <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
                    <span className="num gold" style={{ fontSize: 30 }}>{md.points}</span>
                    <span className="mono muted" style={{ fontSize: 11 }}>points</span>
                  </div>
                </div>
                <SquadPitch starters={md.starters} captain={md.captain} formation={md.formation} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
