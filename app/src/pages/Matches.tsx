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

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="section-title">Matches</h1>
        <span className="live"><span className="live-dot" /> Live</span>
      </div>
      <p className="section-sub">Every World Cup match, live from the TxLINE feed. Scores and events update as they happen.</p>

      {/* Gun secici - tum turnuva */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "6px 0", marginBottom: 12 }}>
        {days.map(({ day: d }) => {
          const f = fmtDay(d);
          const active = d === day;
          return (
            <button key={d} ref={active ? activeRef : null} onClick={() => setDay(d)}
              className={active ? "btn btn-primary" : "btn btn-outline"}
              style={{ padding: "6px 14px", minWidth: 66, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
              <span style={{ fontSize: 11, opacity: 0.8 }}>{f.dow}{d === today ? " (today)" : ""}</span>
              <span style={{ fontWeight: 800, fontSize: 13 }}>{f.date}</span>
            </button>
          );
        })}
        {days.length === 0 && !err && <span className="muted" style={{ fontSize: 13, padding: "8px 0" }}>Loading schedule...</span>}
      </div>

      {err && <div className="card">Oracle API unreachable, or the live match feed is off. Start the backend to load matches.</div>}
      {!err && loading && <div className="card muted">Loading matches...</div>}
      {!err && !loading && matches.length === 0 && <div className="card muted">No World Cup matches on this day.</div>}

      <div style={{ display: "grid", gap: 10 }}>
        {matches.map((m) => <MatchRow key={m.fixtureId} m={m} onClick={() => nav(`/match/${m.fixtureId}`)} />)}
      </div>
    </div>
  );
}

function MatchRow({ m, onClick }: { m: MatchSummary; onClick: () => void }) {
  const time = new Date(m.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <button onClick={onClick} className="card hover-lift"
      style={{ display: "grid", gridTemplateColumns: "72px 1fr auto 1fr", alignItems: "center", gap: 12, textAlign: "left", padding: "12px 16px" }}>
      <StatusBadge m={m} time={time} />
      <TeamCell team={m.home} align="right" />
      <ScoreCell m={m} />
      <TeamCell team={m.away} align="left" />
    </button>
  );
}

function StatusBadge({ m, time }: { m: MatchSummary; time: string }) {
  if (m.status === "halftime") {
    return <span style={{ fontWeight: 800, fontSize: 13, color: "var(--danger)" }}>HT</span>;
  }
  if (m.status === "live") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, color: "var(--danger)" }}>
        <span className="live-dot" />
        {m.minute !== null ? `${m.minute}'` : "LIVE"}
      </span>
    );
  }
  if (m.status === "finished") return <span className="muted" style={{ fontWeight: 700, fontSize: 13 }}>FT</span>;
  return <span className="muted" style={{ fontSize: 13 }}>{time}</span>;
}

function TeamCell({ team, align }: { team: MatchSummary["home"]; align: "left" | "right" }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
      {align === "right" && <b style={{ fontSize: 15 }}>{team.name}</b>}
      <span style={{ fontSize: 20 }}>{team.flag ?? ""}</span>
      {align === "left" && <b style={{ fontSize: 15 }}>{team.name}</b>}
    </span>
  );
}

function ScoreCell({ m }: { m: MatchSummary }) {
  const live = m.status === "live";
  if (m.score) {
    return (
      <span style={{ fontWeight: 900, fontSize: 20, minWidth: 56, textAlign: "center", color: live ? "var(--danger)" : undefined }}>
        {m.score.home}-{m.score.away}
      </span>
    );
  }
  return <span className="muted" style={{ minWidth: 56, textAlign: "center" }}>vs</span>;
}
