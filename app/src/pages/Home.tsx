import { Link } from "react-router-dom";
import { useData } from "../lib/data";

export function Home() {
  const { players, countries } = useData();

  return (
    <div>
      {/* Hero */}
      <section style={{ padding: "72px 0 56px", textAlign: "center" }}>
        <span className="pill pill-gold" style={{ marginBottom: 18, display: "inline-block" }}>
          Solana · 2026 FIFA World Cup
        </span>
        <h1 style={{ fontSize: "clamp(34px, 6vw, 60px)", maxWidth: 860, margin: "0 auto", lineHeight: 1.05 }}>
          Live <span className="gold">onchain</span> fantasy football for the{" "}
          <span className="green">World Cup</span>
        </h1>
        <p className="muted" style={{ maxWidth: 620, margin: "22px auto 0", fontSize: 18 }}>
          Build a national-team squad with a 25 SOL budget. Player points are computed from real
          match events and written to the chain <b className="gold">live, during the match</b>, the
          leaderboard moves in real time.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
          <Link to="/build" className="btn btn-primary">Build Your Squad</Link>
          <Link to="/leaderboard" className="btn btn-outline">View Live Leaderboard</Link>
        </div>
      </section>

      {/* Stats strip */}
      <section className="card" style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 20, padding: "22px 18px" }}>
        <Stat value={players.length.toLocaleString()} label="Real players" />
        <Stat value={countries.length.toString()} label="National teams" />
        <Stat value="100%" label="On-chain scoring" />
        <Stat value="Live" label="Match settlement" />
      </section>

      {/* What makes it different */}
      <section style={{ marginTop: 56 }}>
        <h2 className="section-title" style={{ textAlign: "center" }}>Not just another fantasy app</h2>
        <p className="section-sub" style={{ textAlign: "center" }}>Three things set WorldXI apart.</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", marginTop: 22 }}>
          <Feature
            title="Live onchain settlement"
            body="Points are committed to Solana as goals, cards and substitutions happen, not after the final whistle. Watch the leaderboard climb in real time."
          />
          <Feature
            title="Living cards"
            body="Every player is a compressed NFT that accumulates an onchain career: matches played, total points, MVPs and best score. Not a static collectible, a living card."
          />
          <Feature
            title="Lightweight & replayable"
            body="Matchday-based, quick to enter, built for the casual fan who opens it during every game. No season-long grind."
          />
        </div>
      </section>

      {/* How it works */}
      <section style={{ marginTop: 56 }}>
        <h2 className="section-title" style={{ textAlign: "center" }}>How it works</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: 22 }}>
          <Step n={1} title="Connect wallet" body="Sign in with your Solana wallet and pick a nickname." />
          <Step n={2} title="Build your XI" body="15 players, 25 SOL budget, max 3 per country. Choose a formation and captain." />
          <Step n={3} title="Submit onchain" body="Your squad is validated and stored on-chain; player cards are minted." />
          <Step n={4} title="Watch it live" body="Real match events score your players live. Climb the leaderboard." />
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "56px 0 24px", color: "var(--text-muted)", fontSize: 13 }}>
        WorldXI · Built on Solana · Powered by TxLINE live World Cup data
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div className="gold" style={{ fontSize: 30, fontWeight: 900 }}>{value}</div>
      <div className="muted" style={{ fontSize: 13 }}>{label}</div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
      <h3 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h3>
      <p className="muted" style={{ fontSize: 14 }}>{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="card">
      <div className="badge-c" style={{ width: 28, height: 28, fontSize: 14, marginBottom: 10 }}>{n}</div>
      <h4 style={{ fontSize: 16, marginBottom: 6 }}>{title}</h4>
      <p className="muted" style={{ fontSize: 13.5 }}>{body}</p>
    </div>
  );
}
