import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { DataProvider } from "./lib/data";
import { SquadProvider } from "./lib/squad";
import { LiveTicker } from "./components/LiveTicker";
import { GoalCelebration } from "./components/GoalCelebration";
import { Home } from "./pages/Home";
import { PitchView } from "./pages/PitchView";
import { SquadBuilder } from "./pages/SquadBuilder";
import { Teams } from "./pages/Teams";
import { TeamDetail } from "./pages/TeamDetail";
import { PlayerDetail } from "./pages/PlayerDetail";
import { PlayerLeaderboard } from "./pages/PlayerLeaderboard";
import { UserLeaderboard } from "./pages/UserLeaderboard";
import { NftGallery } from "./pages/NftGallery";
import { Leagues } from "./pages/Leagues";
import { Rules } from "./pages/Rules";
import { Matches } from "./pages/Matches";
import { MatchDetail } from "./pages/MatchDetail";
import { LeagueDetail } from "./pages/LeagueDetail";
import { ManagerDetail } from "./pages/ManagerDetail";

const links = [
  { to: "/squad", label: "My Squad" },
  { to: "/build", label: "Build" },
  { to: "/matches", label: "Matches" },
  { to: "/teams", label: "Teams" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/managers", label: "Managers" },
  { to: "/cards", label: "My Cards" },
  { to: "/leagues", label: "Leagues" },
  { to: "/rules", label: "Rules" },
];

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}

export function App() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <DataProvider>
      <SquadProvider>
        <ScrollTop />
        <header className="broadcast-bar">
          <div className="broadcast-inner">
            <NavLink to="/" className="brand" aria-label="WorldXI home">
              <span className="brand-mark">W</span>
              <span className="brand-name">World<span className="x">XI</span></span>
            </NavLink>
            <nav className="nav" data-open={open} style={{ flex: 1 }}>
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div style={{ marginLeft: "auto" }}>
              <WalletMultiButton />
            </div>
          </div>
        </header>

        <LiveTicker />
        <GoalCelebration />

        <main>
          <div className="container" style={{ padding: "28px 26px 90px" }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/squad" element={<PitchView />} />
              <Route path="/build" element={<SquadBuilder />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/team/:iso" element={<TeamDetail />} />
              <Route path="/player/:id" element={<PlayerDetail />} />
              <Route path="/leaderboard" element={<PlayerLeaderboard />} />
              <Route path="/managers" element={<UserLeaderboard />} />
              <Route path="/cards" element={<NftGallery />} />
              <Route path="/leagues" element={<Leagues />} />
              <Route path="/league/:pubkey" element={<LeagueDetail />} />
              <Route path="/manager/:owner" element={<ManagerDetail />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/match/:fixtureId" element={<MatchDetail />} />
            </Routes>
          </div>
        </main>

        <SiteFooter />
      </SquadProvider>
    </DataProvider>
  );
}

function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", background: "linear-gradient(180deg, transparent, rgba(15,92,58,0.06))" }}>
      <div className="container" style={{ padding: "42px 26px 34px", display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div className="brand" style={{ marginBottom: 10 }}>
            <span className="brand-mark">W</span>
            <span className="brand-name">World<span className="x">XI</span></span>
          </div>
          <p className="muted" style={{ fontSize: 13, maxWidth: 320 }}>
            Live onchain fantasy football for the 2026 World Cup. Built on Solana, powered by the TxLINE live feed.
          </p>
        </div>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
          <FooterCol title="Play" items={[["Build a squad", "/build"], ["My squad", "/squad"], ["Rules & scoring", "/rules"]]} />
          <FooterCol title="Watch" items={[["Matches", "/matches"], ["Leaderboard", "/leaderboard"], ["Managers", "/managers"]]} />
          <FooterCol title="Collect" items={[["My cards", "/cards"], ["Teams", "/teams"], ["Leagues", "/leagues"]]} />
        </div>
      </div>
      <div className="container" style={{ padding: "0 26px 30px" }}>
        <div className="divider" style={{ marginBottom: 16 }} />
        <div className="between">
          <span className="mono" style={{ fontSize: 11, color: "var(--faint)", letterSpacing: "0.08em" }}>
            © 2026 WORLDXI · SOLANA DEVNET · NOT AFFILIATED WITH FIFA
          </span>
          <span className="live" style={{ color: "var(--pitch)" }}>
            <span className="live-dot" style={{ background: "var(--pitch)", boxShadow: "0 0 8px var(--pitch)" }} /> ON-CHAIN
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{title}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map(([label, to]) => (
          <Link key={to} to={to} className="muted" style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</Link>
        ))}
      </div>
    </div>
  );
}
