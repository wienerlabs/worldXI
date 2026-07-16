import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMatches, type MatchSummary } from "../lib/api";

/**
 * Broadcast-style live score strip under the nav. Pulls the current day's matches
 * from the oracle feed and scrolls them like a sports channel ticker. When the feed
 * is unavailable it falls back to a branded marquee so the bar never looks broken.
 */
export function LiveTicker() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchMatches()
        .then((r) => { if (alive) setMatches(r.matches); })
        .catch(() => { if (alive) setMatches([]); });
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const anyLive = matches.some((m) => m.status === "live" || m.status === "halftime");

  const items = matches.length
    ? matches
    : []; // empty -> fallback strip below

  const Fallback = (
    <>
      {FALLBACK.map((f, i) => (
        <span className="tick" key={i}>
          <span className="tick-dot" style={{ background: f.dot }} />
          <span style={{ color: "var(--muted)" }}>{f.text}</span>
        </span>
      ))}
    </>
  );

  const Content = (
    <>
      {items.map((m) => <TickItem key={m.fixtureId} m={m} />)}
    </>
  );

  return (
    <div className="ticker" aria-label="Live match ticker">
      <div className="ticker-label">
        <span className="live-dot" style={anyLive ? undefined : { background: "#fff", animation: "none", boxShadow: "none" }} />
        {anyLive ? "LIVE" : "WORLDXI"}
      </div>
      <div className="ticker-viewport">
        <div className="ticker-track">
          {items.length ? Content : Fallback}
          {items.length ? Content : Fallback}
        </div>
      </div>
    </div>
  );
}

function TickItem({ m }: { m: MatchSummary }) {
  const live = m.status === "live" || m.status === "halftime";
  const score = m.score ? `${m.score.home}–${m.score.away}` : "vs";
  const status =
    m.status === "live" ? (m.minute !== null ? `${m.minute}'` : "LIVE")
    : m.status === "halftime" ? "HT"
    : m.status === "finished" ? "FT"
    : new Date(m.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <Link to={`/match/${m.fixtureId}`} className="tick">
      <span className="tick-dot" style={{ background: live ? "var(--live)" : "var(--faint)" }} />
      <span>{m.home.flag} {m.home.iso ?? m.home.name}</span>
      <span className="t-score">{score}</span>
      <span>{m.away.iso ?? m.away.name} {m.away.flag}</span>
      <span className={live ? "t-min" : "t-sep"}>{status}</span>
    </Link>
  );
}

const FALLBACK = [
  { dot: "var(--volt)", text: "1,246 real World Cup footballers" },
  { dot: "var(--gold)", text: "Points settled live, on Solana" },
  { dot: "var(--pitch)", text: "48 national teams · 25 SOL budget" },
  { dot: "var(--volt)", text: "Build your XI · captain scores 2×" },
  { dot: "var(--gold)", text: "Living cards accrue real on-chain history" },
  { dot: "var(--pitch)", text: "No entry fees · no risk · sponsor-funded prizes" },
];
