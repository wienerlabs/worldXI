import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { PlayerCard } from "../components/PlayerCard";
import { BUDGET_SOL, type Player, type Tier } from "../lib/types";

export function Home() {
  const { players, countries, countryByIso } = useData();

  // Hero fan: three top legendary names with a photo (all render as holo "special").
  const heroPicks = useMemo(() => {
    const withPhoto = players.filter((p) => p.photo && p.rarity === "Legendary");
    const pref = ["FWD", "MID", "DEF", "GK"];
    return [...withPhoto]
      .sort((a, b) => (pref.indexOf(a.position) - pref.indexOf(b.position)) || b.priceSol - a.priceSol)
      .slice(0, 3);
  }, [players]);

  // Featured strip: a spread across price tiers so every card tier is on show.
  const featured = useMemo(() => {
    const withPhoto = players.filter((p) => p.photo);
    const byTier = (t: Tier, n: number) =>
      withPhoto.filter((p) => p.priceTier === t).sort((a, b) => b.priceSol - a.priceSol).slice(0, n);
    return [...byTier("Legendary", 3), ...byTier("Star", 2), ...byTier("Solid", 1), ...byTier("Rotation", 1)];
  }, [players]);

  const renderCard = (p: Player, width: number) => (
    <PlayerCard player={p} country={countryByIso.get(p.nationalTeam)} width={width} />
  );

  return (
    <div>
      {/* ================= HERO ================= */}
      <section style={{ position: "relative", paddingTop: 34 }}>
        {/* Oversized backdrop wordmark */}
        <div aria-hidden style={{
          position: "absolute", top: -18, left: -10, right: -10, textAlign: "center",
          fontFamily: "var(--font-display)", fontSize: "clamp(90px, 20vw, 300px)", lineHeight: 0.8,
          color: "transparent", WebkitTextStroke: "1px rgba(243,241,231,0.045)", letterSpacing: "0.02em",
          pointerEvents: "none", userSelect: "none", zIndex: 0, overflow: "hidden", whiteSpace: "nowrap",
        }}>
          WORLD CUP
        </div>

        <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,0.85fr)", gap: 40, alignItems: "center" }}
          className="hero-grid">
          {/* Left: copy */}
          <div>
            <div className="eyebrow rise" style={{ animationDelay: "0.05s" }}>Solana · FIFA World Cup 2026</div>
            <h1 className="display rise" style={{ animationDelay: "0.12s", fontSize: "clamp(46px, 7.2vw, 104px)", marginTop: 18, letterSpacing: "-0.01em" }}>
              The <span className="volt">pitch</span> is<br />
              on the <span className="gold">chain</span>.
            </h1>
            <p className="rise muted" style={{ animationDelay: "0.2s", maxWidth: 500, marginTop: 22, fontSize: 17.5, lineHeight: 1.6 }}>
              Build a national-team XI on a {BUDGET_SOL} SOL budget. Every goal, card and assist becomes
              fantasy points written to Solana <b className="gold" style={{ fontWeight: 800 }}>live, during the match</b> —
              and the leaderboard moves in real time.
            </p>
            <div className="rise" style={{ animationDelay: "0.28s", display: "flex", gap: 14, marginTop: 34, flexWrap: "wrap" }}>
              <Link to="/build" className="btn btn-primary btn-lg">Build your squad →</Link>
              <Link to="/matches" className="btn btn-ghost btn-lg">Watch live matches</Link>
            </div>
            <div className="rise" style={{ animationDelay: "0.36s", display: "flex", gap: 26, marginTop: 34, flexWrap: "wrap" }}>
              <MiniStat value={players.length.toLocaleString()} label="Real players" />
              <span style={{ width: 1, background: "var(--line-2)" }} />
              <MiniStat value={countries.length.toString()} label="Nations" />
              <span style={{ width: 1, background: "var(--line-2)" }} />
              <MiniStat value="100%" label="On-chain" />
            </div>
          </div>

          {/* Right: floating card fan */}
          <div className="hero-fan rise" style={{ animationDelay: "0.24s", position: "relative", height: 440 }}>
            {heroPicks.map((p, i) => {
              const cfg = [
                { left: "0%", top: "14%", rot: -8, z: 1, delay: "0s" },
                { left: "31%", top: "0%", rot: 2, z: 3, delay: "0.7s" },
                { left: "62%", top: "16%", rot: 9, z: 2, delay: "1.3s" },
              ][i];
              if (!cfg) return null;
              return (
                <div key={p.playerId} style={{ position: "absolute", left: cfg.left, top: cfg.top, zIndex: cfg.z, transform: `rotate(${cfg.rot}deg)` }}>
                  <div style={{ animation: `floaty 6s ease-in-out ${cfg.delay} infinite` }}>
                    <Link to={`/player/${p.playerId}`}>
                      {renderCard(p, 176)}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= TRUST STRIP ================= */}
      <section className="panel sweep" style={{ marginTop: 56, padding: "26px 30px", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 24 }}>
        <BigStat value={players.length.toLocaleString()} label="Real footballers" accent="gold" />
        <BigStat value={countries.length.toString()} label="National teams" accent="volt" />
        <BigStat value="25" label="SOL budget" accent="gold" suffix="◎" />
        <BigStat value="Live" label="Match settlement" accent="pitch" />
      </section>

      {/* ================= DIFFERENTIATORS ================= */}
      <section className="section">
        <div className="section-head">
          <div className="eyebrow gold">Why WorldXI</div>
          <h2 className="section-title" style={{ marginTop: 12 }}>Not just another fantasy app</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
          <Feature n="01" title="Live on-chain settlement" accent="var(--volt)"
            body="Points hit Solana as goals, cards and subs happen — not after the whistle. You watch your rank climb in real time." />
          <Feature n="02" title="Living cards" accent="var(--gold)"
            body="Every player is a compressed NFT that accrues a real career on-chain: matches, points, MVPs, best score. Not a static collectible." />
          <Feature n="03" title="No risk, all thrill" accent="var(--pitch)"
            body="No entry fees, no betting, no pooled prizes. Sponsor-funded leagues only. Matchday-based and quick to enter." />
        </div>
      </section>

      {/* ================= FEATURED CARDS ================= */}
      <section className="section">
        <div className="between section-head">
          <div>
            <div className="eyebrow">The vault</div>
            <h2 className="section-title" style={{ marginTop: 12 }}>Player cards</h2>
          </div>
          <Link to="/teams" className="btn btn-ghost btn-sm">Browse all teams →</Link>
        </div>
        <div style={{ display: "flex", gap: 26, overflowX: "auto", padding: "18px 4px 20px", scrollSnapType: "x mandatory" }}>
          {featured.map((p) => (
            <Link key={p.playerId} to={`/player/${p.playerId}`} style={{ flexShrink: 0, scrollSnapAlign: "start" }}>
              {renderCard(p, 190)}
            </Link>
          ))}
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="section">
        <div className="section-head">
          <div className="eyebrow gold">Kickoff in 4</div>
          <h2 className="section-title" style={{ marginTop: 12 }}>How it works</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16 }}>
          <Step n={1} title="Connect wallet" body="Sign in with your Solana wallet and pick a manager name." />
          <Step n={2} title="Build your XI" body={`15 players, ${BUDGET_SOL} SOL, max 3 per nation. Choose a formation and captain.`} />
          <Step n={3} title="Submit on-chain" body="Your squad is validated and stored on Solana; player cards are minted." />
          <Step n={4} title="Watch it live" body="Real match events score your players live. Climb the leaderboard." />
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="panel panel-notch sweep" style={{ marginTop: 60, padding: "clamp(30px,5vw,58px)", textAlign: "center", background: "linear-gradient(140deg, rgba(31,157,99,0.14), rgba(232,189,84,0.08))", borderColor: "var(--line-2)" }}>
        <div className="eyebrow" style={{ justifyContent: "center" }}>Your XI is waiting</div>
        <h2 className="display" style={{ fontSize: "clamp(34px,5.5vw,64px)", marginTop: 16 }}>
          Draft the team the <span className="gold">world</span> is watching
        </h2>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
          <Link to="/build" className="btn btn-primary btn-lg">Build your squad</Link>
          <Link to="/rules" className="btn btn-ghost btn-lg">Read the rules</Link>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="num" style={{ fontSize: 30, color: "var(--chalk)" }}>{value}</div>
      <div className="mono" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function BigStat({ value, label, accent, suffix }: { value: string; label: string; accent: string; suffix?: string }) {
  const color = accent === "gold" ? "var(--gold)" : accent === "volt" ? "var(--volt)" : "var(--pitch)";
  return (
    <div className="stat">
      <div className="num" style={{ fontSize: "clamp(32px,4.4vw,54px)", color }}>{value}<span style={{ fontSize: "0.6em" }}>{suffix}</span></div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Feature({ n, title, body, accent }: { n: string; title: string; body: string; accent: string }) {
  return (
    <div className="panel hover-lift" style={{ padding: 24, borderTop: `2px solid ${accent}` }}>
      <div className="num" style={{ fontSize: 30, color: accent, opacity: 0.85 }}>{n}</div>
      <h3 style={{ fontSize: 20, margin: "14px 0 10px", fontWeight: 800 }}>{title}</h3>
      <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="panel" style={{ padding: 22, position: "relative", overflow: "hidden" }}>
      <div className="num" style={{ position: "absolute", top: -8, right: 6, fontSize: 84, color: "rgba(243,241,231,0.05)" }}>{n}</div>
      <div style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "var(--surface-3)", border: "1px solid var(--line-2)", borderRadius: 8, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--gold)" }}>{n}</div>
      <h4 style={{ fontSize: 16.5, margin: "14px 0 7px", fontWeight: 800 }}>{title}</h4>
      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55 }}>{body}</p>
    </div>
  );
}
