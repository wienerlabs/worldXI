import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "../lib/data";
import { useSquad } from "../lib/squad";
import { PlayerCard } from "../components/PlayerCard";
import { FORMATIONS, type Country, type Player, type Position } from "../lib/types";

export function PitchView() {
  const { countryByIso } = useData();
  const squad = useSquad();
  const { starters, bench, formation, captainId, spent, budget, budgetOverridden, clear } = squad;
  const [sel, setSel] = useState<Player | null>(null);
  const [subFor, setSubFor] = useState<Player | null>(null);
  const [subOutFor, setSubOutFor] = useState<Player | null>(null);
  // Viewport width -> responsive pitch card size (formation always fits one row).
  const [vw, setVw] = useState(() => (typeof document !== "undefined" ? document.documentElement.clientWidth : 1200));
  useEffect(() => {
    const onResize = () => setVw(document.documentElement.clientWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---- Drag & drop: drag a bench card onto a same-position starter to swap.
  // Works with mouse + touch (pointer events + hit-testing). The tap→modal flow
  // stays as a fallback. Position rule is enforced by squad.swapToStarter.
  type DragUI = { player: Player; x: number; y: number; overId: number | null; valid: boolean };
  const [drag, setDrag] = useState<DragUI | null>(null);
  const dragRef = useRef<{ player: Player; startX: number; startY: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const swapRef = useRef(squad.swapToStarter);
  swapRef.current = squad.swapToStarter;

  useEffect(() => {
    // Which starter (if any) is under (x,y), and whether it is a legal target.
    const hit = (x: number, y: number): { id: number | null; valid: boolean } => {
      const d = dragRef.current;
      if (!d) return { id: null, valid: false };
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const slot = el?.closest?.("[data-slot-id]") as HTMLElement | null;
      if (!slot) return { id: null, valid: false };
      const id = Number(slot.dataset.slotId);
      if (id === d.player.playerId) return { id: null, valid: false };
      return { id, valid: slot.dataset.slotPos === d.player.position };
    };
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 8) return; // drag threshold vs tap
        d.active = true;
        document.body.style.userSelect = "none";
      }
      const t = hit(e.clientX, e.clientY);
      setDrag({ player: d.player, x: e.clientX, y: e.clientY, overId: t.id, valid: t.valid });
    };
    const end = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      document.body.style.userSelect = "";
      if (d.active) {
        suppressClick.current = true; // swallow the click that follows a drag
        window.setTimeout(() => { suppressClick.current = false; }, 350);
        // hit() reads dragRef.current, so resolve the drop BEFORE clearing it.
        const t = e.type === "pointercancel" ? { id: null, valid: false } : hit(e.clientX, e.clientY);
        if (t.valid && t.id != null) swapRef.current(d.player.playerId, t.id);
      }
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const beginBenchDrag = (e: ReactPointerEvent, player: Player) => {
    if (e.pointerType === "mouse" && e.button !== 0) return; // primary button only
    dragRef.current = { player, startX: e.clientX, startY: e.clientY, active: false };
  };

  // ------------------------------------------------------------------ EMPTY
  if (squad.picks.length === 0) {
    return (
      <div style={{ paddingTop: 40 }}>
        <div className="rise" style={{ animationDelay: "0.05s" }}>
          <div className="eyebrow gold">My Squad</div>
        </div>
        <div
          className="panel panel-notch sweep rise"
          style={{
            animationDelay: "0.12s",
            marginTop: 20,
            padding: "clamp(40px,7vw,72px) clamp(24px,5vw,56px)",
            textAlign: "center",
            background:
              "linear-gradient(140deg, rgba(31,157,99,0.16), rgba(232,189,84,0.07))",
            borderColor: "var(--line-2)",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.5,
              zIndex: 0,
              pointerEvents: "none",
            }}
            className="pitch-turf"
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="eyebrow" style={{ justifyContent: "center" }}>
              No line-up on file
            </div>
            <h1
              className="display"
              style={{
                fontSize: "clamp(34px,6vw,68px)",
                marginTop: 16,
                lineHeight: 0.92,
              }}
            >
              Your <span className="volt">XI</span> is still
              <br />
              in the <span className="gold">tunnel</span>
            </h1>
            <p
              className="muted"
              style={{
                margin: "18px auto 0",
                maxWidth: "46ch",
                fontSize: 16,
                lineHeight: 1.6,
              }}
            >
              Draft 15 players on a{" "}
              <b className="gold" style={{ fontWeight: 800 }}>
                25 SOL
              </b>{" "}
              budget, lock a formation and name your captain. Then watch them
              score live, on-chain.
            </p>
            <div
              style={{
                display: "flex",
                gap: 14,
                justifyContent: "center",
                marginTop: 30,
                flexWrap: "wrap",
              }}
            >
              <Link to="/build" className="btn btn-primary btn-lg">
                Build your squad →
              </Link>
              <Link to="/rules" className="btn btn-ghost btn-lg">
                Read the rules
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ PITCH
  const shape = FORMATIONS[formation] ?? FORMATIONS.F433;
  const line = (pos: Position, count: number) =>
    starters.filter((p) => p.position === pos).slice(0, count);
  const formationLabel = formation.replace("F", "").split("").join("-");
  const pct = Math.min(100, budget > 0 ? (spent / budget) * 100 : 0);
  const over = spent > budget;
  const budgetLabel = Number.isInteger(budget) ? String(budget) : budget.toFixed(1);

  // Card width so the widest formation row fits one line on tablet/desktop. Very
  // narrow phones wrap by design — the min clamp is a readability floor.
  const ROW_GAP = 20; // horizontal space between cards on the pitch
  const maxPerRow = Math.max(shape.def, shape.mid, shape.fwd, 1);
  const pitchContentW = Math.min(1240, vw) - 80; // page padding + pitch border + inner padding
  const cardW = Math.max(70, Math.min(124, Math.floor((pitchContentW - (maxPerRow - 1) * ROW_GAP) / maxPerRow)));

  const Cell = ({ p }: { p: Player }) => {
    const isCap = captainId === p.playerId;
    const badge = Math.max(20, Math.round(cardW * 0.22));
    // Drop-target state while a bench card is being dragged.
    const canDrop = !!drag && drag.player.position === p.position && drag.player.playerId !== p.playerId;
    const isOver = canDrop && drag!.overId === p.playerId && drag!.valid;
    const dimmed = !!drag && !canDrop;
    return (
      <button
        data-slot-id={p.playerId}
        data-slot-pos={p.position}
        onClick={() => setSel(p)}
        title={p.name}
        style={{
          background: "none",
          position: "relative",
          padding: 0,
          lineHeight: 0,
          opacity: dimmed ? 0.5 : 1,
          transform: isOver ? "scale(1.06)" : "scale(1)",
          transition: "opacity 0.15s, transform 0.12s var(--ease), filter 0.15s",
          // volt glow marks a legal drop target (stronger when hovered); else captain gold.
          filter: isOver
            ? "drop-shadow(0 0 13px var(--volt)) drop-shadow(0 0 5px var(--volt))"
            : canDrop
            ? "drop-shadow(0 0 7px rgba(198,242,78,0.65))"
            : isCap
            ? "drop-shadow(0 0 6px rgba(232,189,84,0.85)) drop-shadow(0 0 16px rgba(232,189,84,0.4))"
            : "none",
        }}
      >
        <PlayerCard player={p} country={countryByIso.get(p.nationalTeam)} width={cardW} />
        {isCap && (
          <span
            className="badge-c"
            style={{
              position: "absolute",
              top: Math.round(cardW * 0.2),
              right: Math.round(cardW * 0.08),
              zIndex: 6,
              width: badge,
              height: badge,
              fontSize: Math.max(11, Math.round(cardW * 0.12)),
            }}
            title="Captain (2× points)"
          >
            C
          </span>
        )}
      </button>
    );
  };

  const Row = ({ list }: { list: Player[] }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: ROW_GAP,
        flexWrap: "wrap",
        margin: "clamp(16px,2.6vw,30px) 0",
      }}
    >
      {list.map((p) => (
        <Cell key={p.playerId} p={p} />
      ))}
    </div>
  );

  return (
    <div style={{ paddingTop: 28 }}>
      {/* ================= BROADCAST HEADER ================= */}
      <div className="rise" style={{ animationDelay: "0.04s" }}>
        <div className="eyebrow gold">My Squad</div>
      </div>

      <div
        className="between rise"
        style={{ animationDelay: "0.1s", marginTop: 12, alignItems: "flex-end" }}
      >
        <div>
          <h1 className="section-title" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            Starting XI
            <span className="pill pill-volt" style={{ fontSize: 12, transform: "translateY(-2px)" }}>
              {formationLabel}
            </span>
          </h1>
          <p className="section-sub" style={{ marginTop: 8 }}>
            Your on-chain line-up. Tap any card for captain, sub and stat options.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link to="/build" className="btn btn-ghost btn-sm">
            Edit squad
          </Link>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--danger)", borderColor: "rgba(255,90,90,0.4)" }}
            onClick={() => {
              if (
                window.confirm(
                  "Reset your whole squad and start over? This clears your local picks."
                )
              )
                clear();
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Budget HUD */}
      <div
        className="panel rise"
        style={{
          animationDelay: "0.16s",
          marginTop: 18,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 22,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="num" style={{ fontSize: 34, color: over ? "var(--danger)" : "var(--gold)" }}>
            {spent.toFixed(1)}
          </span>
          <span className="mono" style={{ fontSize: 13, color: budgetOverridden ? "var(--volt)" : "var(--muted)" }}>
            / {budgetLabel} SOL ◎
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="meter">
            <span className={over ? "over" : ""} style={{ width: `${pct}%` }} />
          </div>
          <div
            className="mono"
            style={{
              marginTop: 8,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--faint)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Budget spent</span>
            <span>{squad.picks.length}/15 signed · {starters.length} starting</span>
          </div>
        </div>
      </div>

      {/* ================= THE PITCH ================= */}
      <div
        className="pitch-turf rise"
        style={{
          animationDelay: "0.22s",
          position: "relative",
          marginTop: 20,
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          border: "1px solid var(--line-2)",
          boxShadow: "var(--shadow), inset 0 0 120px rgba(0,0,0,0.35)",
        }}
      >
        {/* Floodlight glow pools */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(90% 55% at 50% -12%, rgba(255,255,255,0.14), transparent 60%), radial-gradient(70% 60% at 50% 118%, rgba(198,242,78,0.08), transparent 60%)",
          }}
        />
        <FieldLines />
        <div style={{ position: "relative", zIndex: 1, padding: "clamp(28px,3.4vw,44px) 12px" }}>
          <Row list={line("FWD", shape.fwd)} />
          <Row list={line("MID", shape.mid)} />
          <Row list={line("DEF", shape.def)} />
          <Row list={line("GK", 1)} />
        </div>
      </div>

      {/* ================= SUBSTITUTES ================= */}
      <div className="section" style={{ marginTop: 40 }}>
        <div className="section-head" style={{ marginBottom: 14 }}>
          <div className="eyebrow">The bench</div>
          <h2 className="section-title" style={{ fontSize: "clamp(20px,2.4vw,26px)", marginTop: 10 }}>
            Substitutes
          </h2>
          <p className="section-sub" style={{ marginTop: 6 }}>
            Drag a sub onto a same-position starter to swap — or tap a card for options.
          </p>
        </div>

        {bench.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: 15 }}>No substitutes on the bench.</p>
            <Link className="link-gold" to="/build" style={{ marginTop: 8, display: "inline-block" }}>
              Add depth from Build Squad →
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 16,
              overflowX: "auto",
              paddingBottom: 12,
              scrollSnapType: "x mandatory",
            }}
          >
            {bench.map((p) => {
              const active = subFor?.playerId === p.playerId;
              const isSource = drag?.player.playerId === p.playerId;
              return (
                <button
                  key={p.playerId}
                  onPointerDown={(e) => beginBenchDrag(e, p)}
                  onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setSubFor(p); }}
                  style={{
                    flexShrink: 0,
                    scrollSnapAlign: "start",
                    borderRadius: 10,
                    padding: 6,
                    background: active ? "rgba(232,189,84,0.08)" : "none",
                    border: active ? "1px solid var(--gold)" : "1px solid var(--line)",
                    transition: "border-color 0.18s var(--ease), background 0.18s, opacity 0.15s",
                    lineHeight: 0,
                    touchAction: "none",
                    cursor: isSource ? "grabbing" : "grab",
                    opacity: isSource ? 0.4 : 1,
                  }}
                  title={`Drag ${p.name.split(",")[0]} onto a ${p.position} starter to swap`}
                >
                  <PlayerCard player={p} country={countryByIso.get(p.nationalTeam)} width={126} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Drag ghost — the lifted card follows the pointer; volt glow = legal drop. */}
      {drag && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -54%) rotate(-5deg)`,
            zIndex: 300,
            pointerEvents: "none",
            opacity: 0.96,
            filter: drag.valid
              ? "drop-shadow(0 8px 18px rgba(0,0,0,0.6)) drop-shadow(0 0 14px var(--volt))"
              : "drop-shadow(0 12px 24px rgba(0,0,0,0.7))",
          }}
        >
          <PlayerCard player={drag.player} country={countryByIso.get(drag.player.nationalTeam)} width={122} />
        </div>
      )}

      {/* ================= MODALS ================= */}
      {subFor && (
        <Modal
          onClose={() => setSubFor(null)}
          title={`Bring ${subFor.name.split(",")[0]} into the XI`}
          eyebrow={`${subFor.position} · sub in`}
        >
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Choose a {subFor.position} starter to replace:
          </p>
          {starters
            .filter((p) => p.position === subFor.position)
            .map((p) => (
              <button
                key={p.playerId}
                className="btn btn-ghost"
                style={{ display: "flex", justifyContent: "flex-start", width: "100%", marginBottom: 8 }}
                onClick={() => {
                  squad.swapToStarter(subFor.playerId, p.playerId);
                  setSubFor(null);
                }}
              >
                <span className="pill pill-volt">#{p.jerseyNumber}</span> {p.name}
              </button>
            ))}
          {starters.filter((p) => p.position === subFor.position).length === 0 && (
            <p className="muted">No same-position starter to swap.</p>
          )}
        </Modal>
      )}

      {subOutFor && (
        <Modal
          onClose={() => setSubOutFor(null)}
          title={`Substitute ${subOutFor.name.split(",")[0]}`}
          eyebrow={`${subOutFor.position} · sub out`}
        >
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Choose a {subOutFor.position} substitute to bring on:
          </p>
          {bench
            .filter((p) => p.position === subOutFor.position)
            .map((p) => (
              <button
                key={p.playerId}
                className="btn btn-ghost"
                style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start", width: "100%", marginBottom: 8 }}
                onClick={() => {
                  squad.swapToStarter(p.playerId, subOutFor.playerId);
                  setSubOutFor(null);
                }}
              >
                <span className="pill pill-gold">{p.jerseyNumber}</span> {p.name}{" "}
                <span className="mono muted" style={{ fontSize: 12 }}>
                  {countryByIso.get(p.nationalTeam)?.flagEmoji} {p.nationalTeam}
                </span>
              </button>
            ))}
          {bench.filter((p) => p.position === subOutFor.position).length === 0 && (
            <p className="muted">
              No {subOutFor.position} substitute on the bench. Add one from Build Squad.
            </p>
          )}
        </Modal>
      )}

      {sel && (
        <PlayerMenu
          player={sel}
          country={countryByIso.get(sel.nationalTeam)}
          isCaptain={captainId === sel.playerId}
          isStarter={squad.isStarter(sel.playerId)}
          onClose={() => setSel(null)}
          onCaptain={() => {
            squad.setCaptain(sel.playerId);
            setSel(null);
          }}
          onSub={() => {
            setSubOutFor(sel);
            setSel(null);
          }}
          onRemove={() => {
            squad.remove(sel.playerId);
            setSel(null);
          }}
        />
      )}
    </div>
  );
}

function FieldLines() {
  return (
    <svg
      viewBox="0 0 100 130"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }}
    >
      <g fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="0.4">
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

function Modal({
  title,
  eyebrow,
  children,
  onClose,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3,5,4,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
        padding: 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel panel-notch pop"
        style={{ width: "min(440px, 94vw)", boxShadow: "var(--shadow-lg)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
          <div>
            {eyebrow && (
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                {eyebrow}
              </div>
            )}
            <h3 style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.1 }}>{title}</h3>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: "6px 12px", flexShrink: 0 }}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PlayerMenu({
  player,
  country,
  isCaptain,
  isStarter,
  onClose,
  onCaptain,
  onSub,
  onRemove,
}: {
  player: Player;
  country?: Country;
  isCaptain: boolean;
  isStarter: boolean;
  onClose: () => void;
  onCaptain: () => void;
  onSub: () => void;
  onRemove: () => void;
}) {
  const nav = useNavigate();
  return (
    <Modal title={player.name} eyebrow={`${player.position} · #${player.jerseyNumber}`} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>
          {country?.flagEmoji} {country?.countryNameEn ?? player.nationalTeam}
        </span>
        <span className="pill pill-gold">{player.priceSol}◎</span>
      </div>
      <div style={{ display: "grid", gap: 9 }}>
        <button className="btn btn-primary" onClick={onCaptain}>
          {isCaptain ? "Captain (selected)" : "Make captain · 2× points"}
        </button>
        {isStarter && (
          <button className="btn btn-pitch" onClick={onSub}>
            Substitute · move to bench
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => nav(`/player/${player.playerId}`)}>
          View details & stats
        </button>
        <button
          className="btn btn-ghost"
          style={{ color: "var(--danger)", borderColor: "rgba(255,90,90,0.4)" }}
          onClick={onRemove}
        >
          Remove from squad
        </button>
      </div>
    </Modal>
  );
}
