import { useEffect, useRef, useState } from "react";
import { useData } from "../lib/data";
import { PlayerCard } from "./PlayerCard";
import { fetchLiveGoals, wsUrl, type LiveGoal } from "../lib/api";

/**
 * Full-screen goal celebration. Listens to the oracle WS for real goal events
 * (scorer + minute + running score, all from the TxLINE feed) and, for each new goal,
 * shows the scorer's card (same design as everywhere else) with confetti and light rays.
 * The scoring team's score number flashes red; the other stays white.
 */
const CONFETTI_COLORS = ["#c6f24e", "#e8bd54", "#1f9d63", "#f3f1e7", "#f6d788"];
const RAY_ANGLES = [-64, -48, -32, -16, 0, 16, 32, 48, 64];
const RAY_COLORS = ["#c6f24e", "#e8bd54", "#1f9d63"];
const SHOW_MS = 6500;
/** A goal this recent is still celebrated when the page loads (covers reloads mid-match). */
const FRESH_GOAL_MS = 180_000;

export function GoalCelebration() {
  const [queue, setQueue] = useState<LiveGoal[]>([]);

  useEffect(() => {
    const seen = new Set<string>();
    let closed = false;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000; // reconnect delay, doubles each failure up to a cap

    const connect = (): void => {
      if (closed) return;
      ws = new WebSocket(wsUrl());
      ws.onopen = () => { backoff = 1000; }; // reset backoff on a successful connection
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string; goal?: LiveGoal };
          if (msg.type === "goal" && msg.goal && !seen.has(msg.goal.id)) {
            seen.add(msg.goal.id);
            setQueue((q) => [...q, msg.goal as LiveGoal].slice(-4));
          }
        } catch { /* ignore malformed frame */ }
      };
      ws.onclose = () => {
        if (closed) return;
        // Capped exponential backoff so a downed oracle is not hammered.
        retry = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30000);
      };
      ws.onerror = () => ws?.close();
    };

    // Existing goals are marked as seen so old ones never re-trigger. Goals scored in the last
    // few minutes are still celebrated though: otherwise reloading the page mid-match (or a
    // brief WS drop) silently swallows a goal that just happened.
    fetchLiveGoals()
      .then((gs) => {
        const now = Date.now();
        const fresh: LiveGoal[] = [];
        for (const g of gs) {
          seen.add(g.id);
          if (now - g.ts < FRESH_GOAL_MS) fresh.push(g);
        }
        if (fresh.length > 0) setQueue((q) => [...q, ...fresh].slice(-4));
      })
      .catch(() => undefined)
      .finally(connect);

    return () => { closed = true; if (retry) clearTimeout(retry); ws?.close(); };
  }, []);

  const current = queue[0] ?? null;
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS);
    return () => clearTimeout(t);
  }, [current?.id]);

  if (!current) return null;
  return <GoalOverlay key={current.id} goal={current} />;
}

function GoalOverlay({ goal }: { goal: LiveGoal }) {
  const { playerById, countryByIso } = useData();
  const player = goal.playerId != null ? playerById.get(goal.playerId) : undefined;
  const country = player ? countryByIso.get(player.nationalTeam) : undefined;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => runConfetti(canvasRef.current), []);

  const homeScored = goal.scorerTeam === "home";
  const awayScored = goal.scorerTeam === "away";

  return (
    <div className="goal-cel" role="alert" aria-live="assertive">
      <style>{GOAL_CSS}</style>
      <canvas ref={canvasRef} className="goal-confetti" />
      <div className="goal-rays">
        {RAY_ANGLES.map((a, i) => (
          <span key={a} className="goal-ray"
            style={{ ["--ang" as string]: `${a}deg`, color: RAY_COLORS[i % RAY_COLORS.length], animationDelay: `${(i % 3) * 0.25}s` }} />
        ))}
      </div>

      <div className="goal-content">
        <div className="goal-word">{goal.ownGoal ? "OWN GOAL" : "GOAL!"}</div>
        <div className="goal-match">
          {goal.home.flag} {goal.home.name} v {goal.away.name} {goal.away.flag}
          <span className="goal-min"> · {goal.minute != null ? `${goal.minute}'` : "LIVE"}</span>
        </div>

        <div className="goal-card">
          {player ? (
            <PlayerCard player={player} country={country} width={248} pointsOverride={goal.scorerPoints} />
          ) : (
            <div className="goal-flag">{(homeScored ? goal.home.flag : goal.away.flag) ?? "GOAL"}</div>
          )}
        </div>

        <div className="goal-score">
          <span className="goal-team">{goal.home.flag} {goal.home.iso ?? goal.home.name}</span>
          <span className={`goal-num${homeScored ? " scored" : ""}`}>{goal.score.home}</span>
          <span className="goal-dash">-</span>
          <span className={`goal-num${awayScored ? " scored" : ""}`}>{goal.score.away}</span>
          <span className="goal-team">{goal.away.iso ?? goal.away.name} {goal.away.flag}</span>
        </div>
      </div>
    </div>
  );
}

/** Confetti burst from the card area, then gravity. Returns a cleanup fn. */
function runConfetti(canvas: HTMLCanvasElement | null): () => void {
  if (!canvas) return () => undefined;
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;
  const dpr = window.devicePixelRatio || 1;
  const resize = (): void => { canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; };
  resize();
  window.addEventListener("resize", resize);

  interface P { x: number; y: number; vx: number; vy: number; g: number; size: number; color: string; rot: number; vr: number; }
  const spawn = (): P => ({
    x: (0.5 + (Math.random() - 0.5) * 0.24) * canvas.width,
    y: canvas.height * (0.5 + Math.random() * 0.12),
    vx: (Math.random() - 0.5) * 16 * dpr,
    vy: -(9 + Math.random() * 13) * dpr,
    g: (0.20 + Math.random() * 0.14) * dpr,
    size: (4 + Math.random() * 6) * dpr,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
  });
  const parts: P[] = Array.from({ length: 190 }, spawn);

  let raf = 0;
  let frame = 0;
  const draw = (): void => {
    frame += 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fade = frame < 300 ? 1 : Math.max(0, 1 - (frame - 300) / 60);
    ctx.globalAlpha = fade;
    for (const p of parts) {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (frame < 360) raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
}

const GOAL_CSS = `
.goal-cel {
  position: fixed; inset: 0; z-index: 9999; pointer-events: none; overflow: hidden;
  display: grid; place-items: center;
  background: radial-gradient(circle at 50% 46%, rgba(9,16,11,0.92), rgba(4,7,5,0.98));
  -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  animation: goalIn 0.35s ease both;
}
@keyframes goalIn { from { opacity: 0; } to { opacity: 1; } }
.goal-confetti { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
.goal-rays { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
.goal-ray {
  position: absolute; bottom: -8%; left: 50%; width: 13vmax; height: 150vh;
  transform-origin: bottom center; mix-blend-mode: screen; filter: blur(7px);
  background: linear-gradient(to top, currentColor, transparent 68%);
  animation: rayPulse 2.4s ease-in-out infinite;
}
@keyframes rayPulse {
  0%, 100% { opacity: 0.06; transform: translateX(-50%) rotate(var(--ang)) scaleY(0.9); }
  50%      { opacity: 0.42; transform: translateX(-50%) rotate(var(--ang)) scaleY(1.12); }
}
.goal-content {
  position: relative; z-index: 2; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 22px;
  width: min(680px, 94vw); margin: 0 auto;
}
.goal-word {
  font-family: var(--font-display, inherit); font-weight: 900; letter-spacing: 0.04em;
  font-size: clamp(58px, 12vw, 132px); line-height: 1; white-space: nowrap; max-width: 100%;
  color: var(--gold); text-shadow: 0 0 40px rgba(232,189,84,0.65), 0 6px 26px rgba(0,0,0,0.6);
  animation: wordPop 0.5s cubic-bezier(0.2,1.4,0.4,1) both;
}
@keyframes wordPop { from { transform: scale(0.55); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.goal-match { font-size: clamp(15px, 2.6vw, 22px); font-weight: 700; color: var(--chalk); letter-spacing: 0.02em; }
.goal-min { color: var(--volt); }
.goal-card { animation: cardPop 0.55s cubic-bezier(0.2,1.3,0.35,1) 0.08s both; filter: drop-shadow(0 24px 44px rgba(0,0,0,0.55)); }
@keyframes cardPop { from { transform: translateY(22px) scale(0.7); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
.goal-flag { font-size: 124px; line-height: 1; }
.goal-score {
  display: inline-flex; align-items: center; gap: 18px; margin-top: 6px;
  padding: 13px 28px; border-radius: 999px;
  background: rgba(7,10,8,0.7); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(4px);
}
.goal-team { font-size: clamp(15px, 2.4vw, 21px); font-weight: 800; color: var(--chalk-2); }
.goal-num { font-family: var(--font-num, inherit); font-weight: 900; font-size: clamp(38px, 6.4vw, 62px); color: #ffffff; min-width: 0.7em; }
.goal-num.scored { color: var(--live); animation: scoreBlink 0.6s steps(1, end) infinite; text-shadow: 0 0 22px rgba(255,71,71,0.75); }
@keyframes scoreBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.2; } }
.goal-dash { color: var(--faint, #6b736c); font-weight: 700; font-size: clamp(28px, 4vw, 42px); }
`;
