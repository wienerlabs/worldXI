import { NavLink, Route, Routes } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { DataProvider } from "./lib/data";
import { SquadProvider } from "./lib/squad";
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

export function App() {
  return (
    <DataProvider>
      <SquadProvider>
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <NavLink to="/" className="brand">
              <span className="brand-mark">W</span>
              <span>World<span className="x">XI</span></span>
            </NavLink>
            <nav className="nav">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <WalletMultiButton />
        </header>
        <main className="container" style={{ padding: "10px 22px 60px" }}>
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
            <Route path="/rules" element={<Rules />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/match/:fixtureId" element={<MatchDetail />} />
          </Routes>
        </main>
      </SquadProvider>
    </DataProvider>
  );
}
