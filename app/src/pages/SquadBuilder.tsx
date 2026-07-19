import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useData } from "../lib/data";
import { useSquad } from "../lib/squad";
import { BUDGET_SOL, FORMATIONS, type Position } from "../lib/types";
import { getProgram, profilePda, submitSquad } from "../lib/anchor";
import { isAdminWallet } from "../lib/admin";
import { PromptModal } from "../components/PromptModal";

const fmtBudget = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const POS_TABS: Position[] = ["GK", "DEF", "MID", "FWD"];
const POS_LIMIT: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
const POS_LONG: Record<Position, string> = { GK: "Goalkeepers", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };

export function SquadBuilder() {
  const { players, countryByIso } = useData();
  const { picks, add, remove, formation, setFormation, captainId, setCaptain, spent, remaining, budget, budgetOverridden, setBudget, resetBudget, starterIds, isStarter, clear } = useSquad();
  const { connection } = useConnection();
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const admin = isAdminWallet(wallet.publicKey);
  const nav = useNavigate();

  const [tab, setTab] = useState<Position>("GK");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needProfile, setNeedProfile] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const pool = useMemo(() => {
    const picked = new Set(picks.map((p) => p.playerId));
    return players
      .filter((p) => p.position === tab && !picked.has(p.playerId))
      .filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) || p.nationalTeam.toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => b.priceSol - a.priceSol)
      .slice(0, 80);
  }, [players, tab, q, picks]);

  const shape = FORMATIONS[formation];
  const over = remaining < 0;
  const budgetPct = Math.min(100, budget > 0 ? (spent / budget) * 100 : 0);

  /** Validates the draft, then either asks for the first-time profile or submits straight away. */
  const onSubmit = async () => {
    if (!wallet.publicKey || !anchorWallet) { setMsg("Connect your wallet first."); return; }
    if (picks.length !== 15) { setMsg(`Select 15 players first (${picks.length}/15).`); return; }
    if (starterIds.length !== 11) { setMsg("Your picks don't fill this formation. Change formation or players."); return; }
    if (captainId === null || !starterIds.includes(captainId)) {
      setMsg('Pick a captain: tap the gold "C" next to one of your starters.');
      return;
    }
    setBusy(true); setMsg(null);
    try {
      // First squad? Collect the manager profile in-app first. It rides along in the same
      // transaction as the squad, so the wallet only has to open once.
      const prof = await connection.getAccountInfo(profilePda(wallet.publicKey));
      if (!prof) { setNeedProfile(true); setBusy(false); return; }
    } catch {
      setMsg("Could not reach the network. Check your connection and retry.");
      setBusy(false);
      return;
    }
    await sendSquad();
  };

  /** Sends the squad on-chain. nickname/country are only passed on the very first submit. */
  const sendSquad = async (nickname?: string, country?: string) => {
    if (!wallet.publicKey || !anchorWallet) return;
    setBusy(true); setMsg("Preparing transaction… approve it in your wallet.");
    try {
      const program = getProgram(connection, anchorWallet);
      const { signature, cardsCreated } = await submitSquad(
        program, wallet.publicKey, picks, starterIds, formation, captainId!, nickname, country
      );
      const cardNote = cardsCreated > 0 ? ` ${cardsCreated} player card${cardsCreated === 1 ? "" : "s"} minted.` : "";
      setMsg(`Squad submitted on-chain! Tx: ${signature.slice(0, 12)}…${cardNote} Taking you to your squad…`);
      // Sign complete → show the manager their line-up on the pitch.
      setTimeout(() => nav("/squad"), 1200);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      // Show wallet rejection and common errors in a user-friendly way.
      const friendly = /User rejected|reject/i.test(raw)
        ? "Transaction was rejected in your wallet."
        : /TournamentLocked|6006/i.test(raw)
        ? "A match is live right now, so squads are temporarily locked (no lineup changes while a matchday is in play). You can submit or edit your squad as soon as the current matchday finishes."
        : /insufficient|0x1\b/i.test(raw)
        ? "Not enough SOL for the transaction fee. Fund your devnet wallet and retry."
        : raw;
      setMsg(friendly);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ paddingTop: 30 }}>
      {/* ===================== HEADER ===================== */}
      <div className="rise" style={{ animationDelay: "0.03s" }}>
        <div className="eyebrow gold">Draft Room · 15 players · {fmtBudget(budget)} ◎{budgetOverridden ? " · admin" : ""}</div>
        <h1 className="display" style={{ fontSize: "clamp(38px, 6vw, 74px)", marginTop: 14, letterSpacing: "-0.01em" }}>
          Build your <span className="gold">XI</span>
        </h1>
        <p className="muted" style={{ maxWidth: 560, marginTop: 12, fontSize: 15.5 }}>
          Assemble 15 footballers on a {BUDGET_SOL} SOL budget, max 3 per nation. Pick a formation, name a
          captain, and lock it to Solana — cards mint on submit.
        </p>
      </div>

      {/* ===================== STATUS MESSAGE ===================== */}
      {msg && (
        <div className="panel panel-notch rise" style={{ marginTop: 22, padding: "14px 18px", borderColor: "var(--line-2)", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="live-dot" style={{ background: "var(--volt)", boxShadow: "none", flexShrink: 0 }} />
          <span className="mono" style={{ fontSize: 13, color: "var(--chalk-2)", lineHeight: 1.5 }}>{msg}</span>
        </div>
      )}

      <div className="grid build-grid" style={{ gridTemplateColumns: "minmax(0,1fr) 372px", marginTop: 28, alignItems: "start", gap: 22 }}>
        {/* ===================== LEFT: PLAYER POOL ===================== */}
        <div className="rise" style={{ animationDelay: "0.12s" }}>
          <div className="between" style={{ marginBottom: 14 }}>
            <div className="eyebrow">The talent pool</div>
            <span className="mono faint" style={{ fontSize: 11 }}>{pool.length} shown · by price</span>
          </div>

          {/* Segmented position control */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: 6 }}>
            {POS_TABS.map((t) => {
              const count = picks.filter((p) => p.position === t).length;
              const full = count >= POS_LIMIT[t];
              const active = t === tab;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    padding: "9px 4px", borderRadius: "var(--r-sm)",
                    background: active ? "var(--surface-3)" : "transparent",
                    border: active ? "1px solid var(--line-2)" : "1px solid transparent",
                    boxShadow: active ? "inset 0 0 0 1px rgba(232,189,84,0.12)" : "none",
                    transition: "background 0.16s var(--ease), border-color 0.16s",
                  }}
                >
                  <span className="display" style={{ fontSize: 18, color: active ? "var(--chalk)" : "var(--muted)" }}>{t}</span>
                  <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: full ? "var(--volt)" : active ? "var(--gold)" : "var(--faint)" }}>
                    {count}/{POS_LIMIT[t]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginTop: 12 }}>
            <span className="mono" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--faint)", fontSize: 13, pointerEvents: "none" }}>⌕</span>
            <input
              placeholder="Search name or country…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: "100%", paddingLeft: 34 }}
            />
          </div>

          {/* Pool list */}
          <div className="panel-flush" style={{ marginTop: 14, border: "1px solid var(--line)", borderRadius: "var(--r-lg)", background: "var(--surface)", maxHeight: 620, overflowY: "auto" }}>
            {pool.length === 0 ? (
              <div className="empty-state" style={{ border: "none", background: "transparent", padding: "60px 24px" }}>
                <div className="display" style={{ fontSize: 30, color: "var(--faint)" }}>No matches</div>
                <p className="mono" style={{ fontSize: 12, marginTop: 10 }}>
                  {q ? `Nothing found for "${q}" in ${POS_LONG[tab].toLowerCase()}.` : `No available ${POS_LONG[tab].toLowerCase()} for this filter.`}
                </p>
              </div>
            ) : (
              pool.map((p, i) => {
                const c = countryByIso.get(p.nationalTeam);
                const accent = c?.primaryColor ?? "var(--line-2)";
                return (
                  <div
                    key={p.playerId}
                    className="pool-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "4px 46px 1fr auto auto",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 16px 11px 0",
                      borderBottom: i === pool.length - 1 ? "none" : "1px solid var(--line)",
                    }}
                  >
                    {/* team color spine */}
                    <span style={{ alignSelf: "stretch", background: accent, borderRadius: "0 3px 3px 0" }} />
                    {/* flag + jersey */}
                    <div style={{ textAlign: "center", lineHeight: 1 }}>
                      <div style={{ fontSize: 19 }}>{c?.flagEmoji}</div>
                      <div className="mono" style={{ fontSize: 10, color: "var(--faint)", marginTop: 2 }}>#{p.jerseyNumber}</div>
                    </div>
                    {/* name + country */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.05em", marginTop: 2 }}>{p.nationalTeam}</div>
                    </div>
                    {/* tier + price */}
                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div><span className="pill" style={{ padding: "2px 8px" }}>{p.priceTier}</span></div>
                      <div className="num gold" style={{ fontSize: 18, marginTop: 4 }}>{p.priceSol}<span className="mono" style={{ fontSize: 10, marginLeft: 2 }}>◎</span></div>
                    </div>
                    {/* add */}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: "6px 12px", fontSize: 18, lineHeight: 1 }}
                      title={`Add ${p.name}`}
                      onClick={() => setMsg(add(p))}
                    >
                      +
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===================== RIGHT: SQUAD HUD ===================== */}
        <div className="rise build-hud" style={{ animationDelay: "0.2s", position: "sticky", top: 82 }}>
          {/* Budget scoreboard */}
          <div className="panel panel-notch" style={{ padding: "18px 20px", borderColor: over ? "var(--danger)" : "var(--line-2)", background: "linear-gradient(160deg, rgba(31,157,99,0.10), rgba(255,255,255,0.01))" }}>
            <div className="between" style={{ marginBottom: 10 }}>
              <span className="eyebrow" style={{ color: over ? "var(--danger)" : undefined }}>Budget</span>
              <span className="mono" style={{ fontSize: 11, color: over ? "var(--danger)" : "var(--muted)" }}>
                {picks.length}/15 picked
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="num" style={{ fontSize: 52, color: over ? "var(--danger)" : "var(--gold)" }}>{spent.toFixed(1)}</span>
              <span className="mono" style={{ fontSize: 15, color: budgetOverridden ? "var(--volt)" : "var(--muted)" }}>/ {fmtBudget(budget)} ◎</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: over ? "var(--danger)" : "var(--volt)", fontWeight: 700 }}>
                {over ? `${Math.abs(remaining).toFixed(1)} over` : `${remaining.toFixed(1)} left`}
              </span>
            </div>
            <div className="meter" style={{ marginTop: 12, height: 10 }}>
              <span className={over ? "over" : ""} style={{ width: `${budgetPct}%` }} />
            </div>
          </div>

          {/* ===================== ADMIN: BUDGET OVERRIDE ===================== */}
          {admin && (
            <div className="panel panel-notch" style={{ marginTop: 14, padding: "16px 18px", borderColor: "var(--volt-deep)", background: "linear-gradient(160deg, rgba(198,242,78,0.10), rgba(255,255,255,0.01))" }}>
              <div className="between" style={{ marginBottom: 12 }}>
                <span className="eyebrow" style={{ color: "var(--volt)" }}>Budget override</span>
                <span className="pill pill-volt">Admin</span>
              </div>
              <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
                Your wallet can set a custom draft budget. On-chain rules still apply on submit.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ padding: "8px 10px", minWidth: 42 }} title="−5 SOL"
                  onClick={() => setBudget(Math.max(1, Math.round((budget - 5) * 10) / 10))}>−5</button>
                <input
                  type="number" min={1} step={1} value={fmtBudget(budget)}
                  aria-label="Custom budget in SOL"
                  onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0) setBudget(v); }}
                  style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 700 }}
                />
                <button className="btn btn-ghost btn-sm" style={{ padding: "8px 10px", minWidth: 42 }} title="+5 SOL"
                  onClick={() => setBudget(Math.round((budget + 5) * 10) / 10)}>+5</button>
                <button className="btn btn-volt btn-sm" style={{ padding: "8px 10px", minWidth: 46 }} title="+25 SOL"
                  onClick={() => setBudget(budget + 25)}>+25</button>
              </div>
              <div className="between" style={{ marginTop: 12 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                  {budgetOverridden ? `Raised from ${BUDGET_SOL} ◎` : `Default ${BUDGET_SOL} ◎`}
                </span>
                <button className="pill" style={{ cursor: "pointer", opacity: budgetOverridden ? 1 : 0.5 }} disabled={!budgetOverridden}
                  onClick={resetBudget}>Reset to {BUDGET_SOL}</button>
              </div>
            </div>
          )}

          {/* Formation + submit */}
          <div className="panel" style={{ marginTop: 14, padding: 16 }}>
            <label className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Formation</label>
            <select value={formation} onChange={(e) => setFormation(e.target.value)} style={{ width: "100%" }}>
              {Object.keys(FORMATIONS).map((f) => <option key={f} value={f}>{f.replace("F", "").split("").join("-")}</option>)}
            </select>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: "10px 0 14px" }}>
              Shape {shape ? `1-${shape.def}-${shape.mid}-${shape.fwd}` : ""} · <span className="gold">captain scores 2×</span>
            </div>
            <button className="btn btn-pitch btn-lg" style={{ width: "100%" }} disabled={busy} onClick={onSubmit}>
              {busy ? "Submitting…" : "Submit on-chain ◎"}
            </button>
          </div>

          {/* Picked squad */}
          <div className="panel panel-flush" style={{ marginTop: 14, overflow: "hidden" }}>
            <div className="between" style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 2 }}>Your squad</div>
                <div className="num" style={{ fontSize: 22 }}>{picks.length}<span className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>/15</span></div>
              </div>
              {picks.length > 0 && (
                <button
                  className="pill"
                  style={{ color: "var(--danger)", borderColor: "rgba(255,90,90,0.4)", cursor: "pointer" }}
                  onClick={() => setConfirmClear(true)}
                >
                  Clear all
                </button>
              )}
            </div>

            {picks.length === 0 ? (
              <div className="empty-state" style={{ border: "none", background: "transparent", padding: "40px 22px" }}>
                <div className="display" style={{ fontSize: 26, color: "var(--faint)" }}>Empty XI</div>
                <p className="mono" style={{ fontSize: 12, marginTop: 8 }}>Add players from the pool to start your draft.</p>
              </div>
            ) : (
              <div style={{ padding: "6px 0" }}>
                {(["GK", "DEF", "MID", "FWD"] as Position[]).map((pos) => {
                  const group = picks.filter((p) => p.position === pos);
                  if (group.length === 0) return null;
                  return (
                    <div key={pos} style={{ padding: "8px 16px" }}>
                      <div className="between" style={{ marginBottom: 6 }}>
                        <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
                          {POS_LONG[pos]}
                        </span>
                        <span className="mono faint" style={{ fontSize: 10.5 }}>{group.length}/{POS_LIMIT[pos]}</span>
                      </div>
                      <div className="stack" style={{ gap: 4 }}>
                        {group.map((p) => {
                          const cap = captainId === p.playerId;
                          const starter = isStarter(p.playerId);
                          return (
                            <div key={p.playerId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: "var(--r-sm)", background: cap ? "rgba(232,189,84,0.08)" : "var(--surface-2)", border: "1px solid var(--line)" }}>
                              <button
                                onClick={() => setCaptain(p.playerId)}
                                title="Set captain"
                                aria-label={`Set ${p.name} as captain`}
                                style={{
                                  display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                                  background: cap ? "var(--gold)" : "transparent",
                                  color: cap ? "var(--on-gold)" : "var(--faint)",
                                  border: cap ? "none" : "1px solid var(--line-2)",
                                  fontFamily: "var(--font-sans)", fontWeight: 900, fontSize: 12,
                                  boxShadow: cap ? "0 2px 10px -2px rgba(232,189,84,0.9)" : "none",
                                }}
                              >
                                C
                              </button>
                              <span style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
                                {countryByIso.get(p.nationalTeam)?.flagEmoji} {p.name}
                              </span>
                              {starter && <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: "var(--volt)", letterSpacing: "0.06em" }}>XI</span>}
                              <span className="num gold" style={{ fontSize: 15 }}>{p.priceSol}</span>
                              <button
                                onClick={() => remove(p.playerId)}
                                title="Remove"
                                aria-label={`Remove ${p.name}`}
                                style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: "var(--r-sm)", color: "var(--faint)", border: "1px solid var(--line)", fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Page-scoped responsive + row hover — small, uses only tokens */}
      <style>{`
        .pool-row { transition: background 0.14s var(--ease); }
        .pool-row:hover { background: var(--surface-2); }
        @media (max-width: 900px) {
          .build-grid { grid-template-columns: 1fr !important; }
          .build-hud { position: static !important; }
        }
      `}</style>

      {/* First squad only: collect the manager profile in-app instead of a browser prompt.
          These values are sent in the same transaction as the squad. */}
      {confirmClear && (
        <PromptModal
          eyebrow="Draft room"
          title="Clear your squad?"
          fields={[]}
          hint="This removes the players you picked in this browser for the connected wallet. A squad already submitted on-chain is not affected."
          submitLabel="Clear squad"
          onSubmit={() => { setConfirmClear(false); clear(); setMsg("Squad cleared. Start building from scratch."); }}
          onClose={() => setConfirmClear(false)}
        />
      )}

      {needProfile && (
        <PromptModal
          eyebrow="Manager profile"
          title="Name your manager"
          fields={[
            { name: "nickname", label: "Manager name", placeholder: "", maxLength: 24 },
            { name: "country", label: "Country code (optional)", placeholder: "TUR", maxLength: 3, uppercase: true, optional: true },
          ]}
          hint="Created once, in the same transaction as your squad."
          submitLabel="Submit squad"
          onSubmit={(v) => {
            setNeedProfile(false);
            // Drop control characters and keep the on-chain limits.
            const nickname = (v.nickname ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 24);
            const country = (v.country ?? "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3);
            if (!nickname) { setMsg("A nickname is required for your first squad."); return; }
            void sendSquad(nickname, country || undefined);
          }}
          onClose={() => { setNeedProfile(false); setBusy(false); }}
        />
      )}
    </div>
  );
}
