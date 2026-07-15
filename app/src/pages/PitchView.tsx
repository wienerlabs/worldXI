import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "../lib/data";
import { useSquad } from "../lib/squad";
import { PlayerCard } from "../components/PlayerCard";
import { FORMATIONS, type Player, type Position } from "../lib/types";

export function PitchView() {
  const { countryByIso } = useData();
  const squad = useSquad();
  const { starters, bench, formation, captainId, spent, clear } = squad;
  const [sel, setSel] = useState<Player | null>(null);
  const [subFor, setSubFor] = useState<Player | null>(null);
  const [subOutFor, setSubOutFor] = useState<Player | null>(null);

  if (squad.picks.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 52, marginTop: 24 }}>
        <h2 style={{ fontSize: 24 }}>You haven't built a squad yet</h2>
        <p className="muted" style={{ margin: "10px 0 22px" }}>Pick 15 players with a 25 SOL budget and set your starting XI.</p>
        <Link to="/build" className="btn btn-primary">Build Your Squad</Link>
      </div>
    );
  }

  const shape = FORMATIONS[formation] ?? FORMATIONS.F433;
  const line = (pos: Position, count: number) => starters.filter((p) => p.position === pos).slice(0, count);

  const Cell = ({ p }: { p: Player }) => (
    <button onClick={() => setSel(p)} style={{ background: "none", position: "relative", padding: 0 }}>
      <PlayerCard player={p} country={countryByIso.get(p.nationalTeam)} width={96} />
      {captainId === p.playerId && (
        <span className="badge-c" style={{ position: "absolute", top: 2, right: 6, zIndex: 2 }} title="Captain">C</span>
      )}
    </button>
  );
  const Row = ({ list }: { list: Player[] }) => (
    <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", margin: "10px 0" }}>
      {list.map((p) => <Cell key={p.playerId} p={p} />)}
    </div>
  );

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h1 className="section-title">My Squad · {formation.replace("F", "").split("").join("-")}</h1>
        <div className="muted" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>Spent: <b className="gold">{spent.toFixed(1)} / 25 SOL</b></span>
          <Link className="gold" to="/build">Edit</Link>
          <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: 12, color: "var(--danger)", borderColor: "var(--danger)" }}
            onClick={() => { if (window.confirm("Reset your whole squad and start over? This clears your local picks.")) clear(); }}>
            Reset squad
          </button>
        </div>
      </div>

      <div style={{ position: "relative", marginTop: 16, borderRadius: 16, overflow: "hidden", border: "1px solid var(--green)", background: "#15503c" }}>
        <FieldLines />
        <div style={{ position: "relative", zIndex: 1, padding: "26px 12px" }}>
          <Row list={line("FWD", shape.fwd)} />
          <Row list={line("MID", shape.mid)} />
          <Row list={line("DEF", shape.def)} />
          <Row list={line("GK", 1)} />
        </div>
      </div>

      <h2 className="section-title" style={{ fontSize: 18, marginTop: 26 }}>Substitutes</h2>
      <p className="section-sub">Tap a sub, then a same-position starter to bring them into the XI.</p>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {bench.map((p) => (
          <button key={p.playerId} onClick={() => setSubFor(p)} style={{ borderRadius: 12, padding: 6, background: "none", border: subFor?.playerId === p.playerId ? "1px solid var(--gold)" : "1px solid transparent" }}>
            <PlayerCard player={p} country={countryByIso.get(p.nationalTeam)} width={92} />
          </button>
        ))}
        {bench.length === 0 && <span className="muted">No substitutes.</span>}
      </div>

      {subFor && (
        <Modal onClose={() => setSubFor(null)} title={`Bring ${subFor.name.split(",")[0]} into the XI`}>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Choose a {subFor.position} starter to replace:</p>
          {starters.filter((p) => p.position === subFor.position).map((p) => (
            <button key={p.playerId} className="btn btn-outline" style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8 }}
              onClick={() => { squad.swapToStarter(subFor.playerId, p.playerId); setSubFor(null); }}>
              #{p.jerseyNumber} {p.name}
            </button>
          ))}
          {starters.filter((p) => p.position === subFor.position).length === 0 && (
            <p className="muted">No same-position starter to swap.</p>
          )}
        </Modal>
      )}

      {subOutFor && (
        <Modal onClose={() => setSubOutFor(null)} title={`Substitute ${subOutFor.name.split(",")[0]}`}>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Choose a {subOutFor.position} substitute to bring on:</p>
          {bench.filter((p) => p.position === subOutFor.position).map((p) => (
            <button key={p.playerId} className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", marginBottom: 8 }}
              onClick={() => { squad.swapToStarter(p.playerId, subOutFor.playerId); setSubOutFor(null); }}>
              <span className="pill pill-gold">{p.jerseyNumber}</span> {p.name} <span className="muted" style={{ fontSize: 12 }}>{countryByIso.get(p.nationalTeam)?.flagEmoji} {p.nationalTeam}</span>
            </button>
          ))}
          {bench.filter((p) => p.position === subOutFor.position).length === 0 && (
            <p className="muted">No {subOutFor.position} substitute on the bench. Add one from Build Squad.</p>
          )}
        </Modal>
      )}

      {sel && (
        <PlayerMenu
          player={sel}
          isCaptain={captainId === sel.playerId}
          isStarter={squad.isStarter(sel.playerId)}
          onClose={() => setSel(null)}
          onCaptain={() => { squad.setCaptain(sel.playerId); setSel(null); }}
          onSub={() => { setSubOutFor(sel); setSel(null); }}
          onRemove={() => { squad.remove(sel.playerId); setSel(null); }}
        />
      )}
    </div>
  );
}

function FieldLines() {
  return (
    <svg viewBox="0 0 100 130" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }}>
      <g fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="0.4">
        <rect x="2" y="2" width="96" height="126" />
        <line x1="2" y1="65" x2="98" y2="65" />
        <circle cx="50" cy="65" r="9" />
        <rect x="32" y="2" width="36" height="16" />
        <rect x="43" y="2" width="14" height="6" />
        <rect x="32" y="112" width="36" height="16" />
        <rect x="43" y="122" width="14" height="6" />
      </g>
    </svg>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "min(420px, 92vw)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 17 }}>{title}</h3>
          <button className="btn btn-outline" style={{ padding: "4px 10px" }} onClick={onClose}>x</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PlayerMenu({ player, isCaptain, isStarter, onClose, onCaptain, onSub, onRemove }: {
  player: Player; isCaptain: boolean; isStarter: boolean; onClose: () => void; onCaptain: () => void; onSub: () => void; onRemove: () => void;
}) {
  const nav = useNavigate();
  return (
    <Modal title={player.name} onClose={onClose}>
      <div style={{ display: "grid", gap: 8 }}>
        <button className="btn btn-primary" onClick={onCaptain}>{isCaptain ? "Captain (selected)" : "Make captain (2x points)"}</button>
        {isStarter && <button className="btn btn-green" onClick={onSub}>Substitute (move to bench)</button>}
        <button className="btn btn-outline" onClick={() => nav(`/player/${player.playerId}`)}>View details & stats</button>
        <button className="btn btn-outline" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={onRemove}>Remove from squad</button>
      </div>
    </Modal>
  );
}
