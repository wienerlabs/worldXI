import { useEffect, useState } from "react";
import { fetchLeagues, type SponsorLeagueRow } from "../lib/api";

const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/**
 * Leagues & Model - sponsor-funded prize leagues (onchain) + the revenue model.
 * No gambling, no entry fees, no pooled prizes by design: users never risk money.
 * A compliance-first design choice and a commercial differentiation.
 */
export function Leagues() {
  const [leagues, setLeagues] = useState<SponsorLeagueRow[]>([]);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetchLeagues().then(setLeagues).catch(() => setErr(true));
  }, []);

  return (
    <div style={{ marginTop: 20 }}>
      <h1 className="section-title">Leagues &amp; Model</h1>
      <p className="section-sub">Sponsor-funded prize leagues and a clean, gambling-free revenue model.</p>

      {/* No-risk model banner */}
      <div className="card" style={{ borderColor: "var(--green)", marginBottom: 18 }}>
        <span className="muted" style={{ fontSize: 14 }}>
          No gambling · No entry fees · No pooled prizes. Prize leagues are <b className="gold">100% sponsor-funded</b> - players never risk money.
        </span>
      </div>

      {/* Sponsor ligleri (onchain) */}
      <h2 className="section-title" style={{ fontSize: 18 }}>Sponsor Prize Leagues</h2>
      <p className="section-sub">Sponsors fund the prize on-chain; joining is free. Winner is settled from the leaderboard.</p>
      {err && <div className="card">Oracle API unreachable - start the backend to load leagues.</div>}
      {!err && leagues.length === 0 && <div className="card">No sponsor leagues yet.</div>}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", marginBottom: 26 }}>
        {leagues.map((l) => (
          <div key={l.name} className="card hover-lift">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 17 }}>{l.name}</h3>
              <span className="pill pill-gold">{l.settled ? "Settled" : "Live"}</span>
            </div>
            <div className="gold" style={{ fontSize: 26, fontWeight: 900, margin: "8px 0" }}>{l.prizeSol} SOL</div>
            <div className="muted" style={{ fontSize: 12 }}>Sponsor {shortAddr(l.sponsor)} · free to join</div>
            {l.winner && <div style={{ fontSize: 13, marginTop: 6 }}>Winner: <span className="gold">{shortAddr(l.winner)}</span></div>}
          </div>
        ))}
      </div>

      {/* Gelir modeli */}
      <h2 className="section-title" style={{ fontSize: 18 }}>Revenue Model</h2>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
        <div className="card">
          <div className="gold" style={{ fontWeight: 800, marginBottom: 6 }}>Secondary market royalties</div>
          <div className="muted" style={{ fontSize: 13 }}>A small royalty on player-card resales. Cards with strong on-chain history are worth more.</div>
        </div>
        <div className="card">
          <div className="gold" style={{ fontWeight: 800, marginBottom: 6 }}>Premium &amp; cosmetic mints</div>
          <div className="muted" style={{ fontSize: 13 }}>Optional cosmetic card styles and premium mints - pure opt-in, never pay-to-win.</div>
        </div>
        <div className="card">
          <div className="gold" style={{ fontWeight: 800, marginBottom: 6 }}>Sponsor partnerships</div>
          <div className="muted" style={{ fontSize: 13 }}>Brands fund prize leagues for reach and engagement. Users never pay; sponsors do.</div>
        </div>
      </div>
    </div>
  );
}
