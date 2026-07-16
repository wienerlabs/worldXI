import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMatches, fetchMatchDays, type MatchSummary } from "../lib/api";

const DAY_MS = 86_400_000;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Dunya Kupasi mac merkezi: TUM turnuva gun secici + canli/gelecek/gecmis maclar.
 *  Veri TxLINE canli feed'inden (oracle /matches). Canli maclar 6sn'de yenilenir. */
export function Matches() {
  const today = Math.floor(Date.now() / DAY_MS);
  const [days, setDays] = useState<Array<{ day: number; count: number }>>([]);
  const [day, setDay] = useState<number | null>(null);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Turnuva gunlerini bir kez yukle; bugune en yakin (gecmeyen) gunu sec.
  useEffect(() => {
    fetchMatchDays()
      .then((r) => {
        setDays(r.days);
        if (r.days.length === 0) { setLoading(false); return; }
        const exact = r.days.find((d) => d.day === today);
        const upcoming = r.days.find((d) => d.day >= today);
        setDay((exact ?? upcoming ?? r.days[r.days.length - 1]).day);
      })
      .catch(() => { setErr(true); setLoading(false); });
  }, [today]);

  useEffect(() => {
    if (day === null) return;
    let alive = true;
    setLoading(true);
    const load = () =>
      fetchMatches(day)
        .then((r) => { if (alive) { setMatches(r.matches); setErr(false); setLoading(false); } })
        .catch(() => { if (alive) { setErr(true); setLoading(false); } });
    load();
    const t = setInterval(load, 6000);
    return () => { alive = false; clearInterval(t); };
  }, [day]);

  // Secili gunu goruse kaydir.
  useEffect(() => { activeRef.current?.scrollIntoView({ inline: "center", block: "nearest" }); }, [day, days.length]);

  const fmtDay = (d: number) => {
    const dt = new Date(d * DAY_MS);
    return { dow: DOW[dt.getUTCDay()], date: `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}` };
  };

  const liveNow = matches.filter((m) => m.status === "live" || m.status === "halftime").length;
  const sel = day !== null ? fmtDay(day) : null;

  return (
    <div style={{ marginTop: 28 }}>
      {/* ================= HEADER ================= */}
      <header className="rise" style={{ animationDelay: "0.02s" }}>
        <div className="between" style={{ alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow">TxLINE · Match Center</div>
            <h1 className="display" style={{ fontSize: "clamp(40px, 6.5vw, 78px)", marginTop: 14 }}>
              World Cup <span className="gold">Live</span>
            </h1>
            <p className="section-sub" style={{ marginTop: 12 }}>
              Every 2026 fixture, streamed from the on-chain oracle feed. Scores and events
              settle to Solana the instant they happen.
            </p>
          </div>
          <span className="pill pill-live" style={{ padding: "6px 12px", fontSize: 11 }}>
            <span className="live-dot" style={{ width: 6, height: 6, background: "#fff", boxShadow: "none" }} />
            {liveNow > 0 ? `${liveNow} live now` : "Live feed"}
          </span>
        </div>
      </header>

      {/* ================= DAY SELECTOR ================= */}
      <div className="rise" style={{ animationDelay: "0.1s", marginTop: 26 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Tournament schedule</div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x proximity" }}>
          {days.map(({ day: d, count }) => {
            const f = fmtDay(d);
            const active = d === day;
            const isToday = d === today;
            return (
              <button key={d} ref={active ? activeRef : null} onClick={() => setDay(d)}
                style={{
                  flexShrink: 0, minWidth: 74, scrollSnapAlign: "center",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  padding: "10px 14px", borderRadius: "var(--r-sm)",
                  background: active ? "var(--gold)" : "var(--surface-2)",
                  border: `1px solid ${active ? "var(--gold)" : isToday ? "var(--line-2)" : "var(--line)"}`,
                  color: active ? "var(--on-gold)" : "var(--chalk)",
                  boxShadow: active ? "0 10px 30px -12px rgba(232,189,84,0.7)" : "none",
                  transition: "transform 0.14s var(--ease), border-color 0.2s, background 0.2s",
                }}>
                <span className="mono" style={{
                  fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                  color: active ? "var(--on-gold)" : isToday ? "var(--volt)" : "var(--muted)", fontWeight: 700,
                }}>
                  {isToday ? "Today" : f.dow}
                </span>
                <span className="num" style={{ fontSize: 18, color: active ? "var(--on-gold)" : "var(--chalk)" }}>{f.date}</span>
                <span className="mono" style={{ fontSize: 9, opacity: active ? 0.7 : 0.55 }}>{count} {count === 1 ? "match" : "matches"}</span>
              </button>
            );
          })}
          {days.length === 0 && !err && (
            <span className="mono muted" style={{ fontSize: 12, padding: "16px 4px" }}>Loading schedule…</span>
          )}
        </div>
      </div>

      {/* ================= FIXTURE LIST HEADER ================= */}
      {sel && (
        <div className="between" style={{ marginTop: 30, marginBottom: 14 }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="num" style={{ fontSize: 22, color: "var(--chalk)" }}>{sel.date}</span>
            <span className="mono muted" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {day === today ? "Today's fixtures" : "Fixtures"}
            </span>
          </div>
          {!err && !loading && matches.length > 0 && (
            <span className="pill">{matches.length} {matches.length === 1 ? "match" : "matches"}</span>
          )}
        </div>
      )}

      {/* ================= STATES ================= */}
      {err && (
        <div className="empty-state" style={{ borderColor: "rgba(255,90,90,0.4)" }}>
          <div className="num" style={{ fontSize: 40, color: "var(--danger)" }}>—</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--chalk)", marginTop: 10 }}>Feed unreachable</div>
          <p className="muted" style={{ fontSize: 14, marginTop: 8, maxWidth: "42ch", marginInline: "auto" }}>
            The oracle API is offline or the live match feed is off. Start the backend to load World Cup fixtures.
          </p>
        </div>
      )}

      {!err && loading && (
        <div style={{ display: "grid", gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="panel rise" style={{ animationDelay: `${i * 0.06}s`, height: 74, display: "grid", placeItems: "center" }}>
              <span className="mono muted" style={{ fontSize: 12, letterSpacing: "0.1em" }}>Loading…</span>
            </div>
          ))}
        </div>
      )}

      {!err && !loading && matches.length === 0 && (
        <div className="empty-state">
          <div className="num" style={{ fontSize: 40, color: "var(--faint)" }}>0</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--chalk)", marginTop: 10 }}>No fixtures scheduled</div>
          <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>There are no World Cup matches on this day. Pick another date above.</p>
        </div>
      )}

      {/* ================= FIXTURES ================= */}
      {!err && !loading && matches.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {matches.map((m, i) => (
            <div key={m.fixtureId} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
              <MatchRow m={m} onClick={() => nav(`/match/${m.fixtureId}`)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({ m, onClick }: { m: MatchSummary; onClick: () => void }) {
  const time = new Date(m.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const live = m.status === "live" || m.status === "halftime";
  return (
    <button onClick={onClick} className="panel panel-flush hover-lift"
      style={{
        width: "100%", display: "grid", gridTemplateColumns: "minmax(0,1fr) 128px minmax(0,1fr)",
        alignItems: "center", gap: 14, textAlign: "left", padding: "16px 20px",
        borderLeft: `3px solid ${live ? "var(--live)" : "var(--line)"}`,
      }}>
      <TeamCell team={m.home} />
      <CenterCell m={m} time={time} />
      <TeamCell team={m.away} flip />
    </button>
  );
}

function CenterCell({ m, time }: { m: MatchSummary; time: string }) {
  const live = m.status === "live";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0 }}>
      <StatusBadge m={m} time={time} />
      {m.score ? (
        <span className="num" style={{ fontSize: 30, color: live ? "var(--live)" : "var(--chalk)", whiteSpace: "nowrap" }}>
          {m.score.home}<span className="faint" style={{ margin: "0 4px" }}>–</span>{m.score.away}
        </span>
      ) : (
        <span className="num muted" style={{ fontSize: 22 }}>vs</span>
      )}
    </div>
  );
}

function StatusBadge({ m, time }: { m: MatchSummary; time: string }) {
  if (m.status === "halftime") {
    return (
      <span className="pill pill-live" style={{ padding: "2px 9px", fontSize: 10 }}>HT</span>
    );
  }
  if (m.status === "live") {
    return (
      <span className="live" style={{ fontSize: 11 }}>
        <span className="live-dot" />
        {m.minute !== null ? `${m.minute}'` : "LIVE"}
      </span>
    );
  }
  if (m.status === "finished") {
    return <span className="pill" style={{ padding: "2px 9px", fontSize: 10 }}>FT</span>;
  }
  return (
    <span className="mono muted" style={{ fontSize: 11, letterSpacing: "0.08em" }}>{time}</span>
  );
}

/** Home reads "name + flag"; away is mirrored to "flag + name". Both hug the centre
 *  score (home right-aligned, away left-aligned) so the two teams sit symmetrically. */
function TeamCell({ team, flip }: { team: MatchSummary["home"]; flip?: boolean }) {
  const name = (
    <b style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: flip ? "left" : "right" }}>
      {team.name}
    </b>
  );
  const flag = (
    <span style={{
      fontSize: 24, lineHeight: 1, flexShrink: 0, width: 34, textAlign: "center",
      display: "inline-grid", placeItems: "center", height: 34,
      background: "var(--surface-3)", border: "1px solid var(--line)", borderRadius: 8,
    }}>
      {team.flag ?? "🏳️"}
    </span>
  );
  return (
    <span style={{
      display: "flex", alignItems: "center", gap: 11, minWidth: 0,
      justifyContent: flip ? "flex-start" : "flex-end",
    }}>
      {flip ? <>{flag}{name}</> : <>{name}{flag}</>}
    </span>
  );
}
