import { useCallback, useEffect, useState } from "react";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { useSquad } from "../lib/squad";
import { PlayerCard } from "../components/PlayerCard";
import { fetchMyCards, getProgram, type OnchainCard } from "../lib/anchor";

/**
 * My Cards - the user's REAL on-chain "living cards" (PlayerCard accounts).
 * Each card accumulates a performance history on the chain (matches played, points, MVP, best
 * score). Cards are created automatically when a squad is submitted, and they are kept when the
 * squad changes: only players in the active squad keep earning new points.
 */
export function NftGallery() {
  const { connected } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const { playerById, countryByIso, statsById } = useData();
  const { picks } = useSquad();

  const [cards, setCards] = useState<OnchainCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [onlyActive, setOnlyActive] = useState(false);

  const load = useCallback(async () => {
    // No wallet (or one was just disconnected): show nothing rather than leaving the
    // previous wallet's cards on screen. Switching accounts re-runs this with the new key.
    if (!wallet) { setCards([]); return; }
    setLoading(true);
    try {
      const program = getProgram(connection, wallet);
      setCards(await fetchMyCards(program, wallet.publicKey));
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [wallet, connection]);

  useEffect(() => { void load(); }, [load]);

  /* ---------- Wallet gate ---------- */
  if (!connected) {
    return (
      <section className="section" style={{ marginTop: 40 }}>
        <div className="eyebrow gold rise">The vault is locked</div>
        <h1 className="display rise" style={{ animationDelay: "0.06s", fontSize: "clamp(38px,6vw,72px)", marginTop: 16 }}>
          Connect to open<br />your <span className="gold">card vault</span>
        </h1>
        <div
          className="panel panel-notch rise"
          style={{
            animationDelay: "0.14s",
            marginTop: 28,
            padding: "clamp(28px,4vw,44px)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            background: "linear-gradient(140deg, rgba(232,189,84,0.10), rgba(31,157,99,0.06))",
            borderColor: "var(--line-2)",
          }}
        >
          <p className="muted" style={{ maxWidth: "52ch", fontSize: 16, lineHeight: 1.6, margin: 0 }}>
            Your living cards live on Solana. Connect the wallet that holds them using the
            button in the top bar to enter the vault.
          </p>
          <Link to="/build" className="btn btn-primary btn-lg">Build a squad →</Link>
        </div>
      </section>
    );
  }

  // Cards belong to the wallet for good; the active squad only decides which ones keep
  // earning points. The filter lets the manager narrow the vault down to those.
  const activeIds = new Set(picks.map((p) => p.playerId));
  const shownCards = onlyActive ? cards.filter((c) => activeIds.has(c.playerId)) : cards;
  const activeCount = cards.filter((c) => activeIds.has(c.playerId)).length;

  /* ---------- Vault aggregates: REAL tournament stats for owned cards ---------- */
  const totalPoints = cards.reduce((s, c) => s + (statsById.get(c.playerId)?.totalPoints ?? 0), 0);
  const totalMatches = cards.reduce((s, c) => s + (statsById.get(c.playerId)?.matchesPlayed ?? 0), 0);
  const totalMvp = cards.reduce((s, c) => s + (statsById.get(c.playerId)?.mvpCount ?? 0), 0);

  return (
    <div style={{ marginTop: 24 }}>
      {/* ================= HEADER ================= */}
      <section className="between rise" style={{ alignItems: "flex-end", gap: 18 }}>
        <div>
          <div className="eyebrow gold">On-chain · Living cards</div>
          <h1 className="display" style={{ fontSize: "clamp(36px,6vw,76px)", marginTop: 14, lineHeight: 0.9 }}>
            My <span className="gold">cards</span>
          </h1>
          <p className="section-sub" style={{ marginTop: 14 }}>
            Not static collectibles — each is an on-chain PlayerCard that builds a real
            performance history: matches, points, MVPs and best score.
          </p>
          <p className="mono" style={{ marginTop: 12, fontSize: 12.5, color: "var(--faint)", maxWidth: "62ch", lineHeight: 1.6 }}>
            Cards are created with your squad and stay yours even after you change it. Only players
            in your active squad keep earning new points; the rest keep the history they already have.
          </p>
        </div>
        {cards.length > 0 && (
          <div className="row" style={{ gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: 5, flexShrink: 0 }}>
            {[
              { key: false, label: `All ${cards.length}` },
              { key: true, label: `Active squad ${activeCount}` },
            ].map((opt) => (
              <button
                key={String(opt.key)}
                onClick={() => setOnlyActive(opt.key)}
                className="mono"
                style={{
                  padding: "8px 14px", fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase",
                  borderRadius: "var(--r-sm)", fontWeight: 700,
                  background: onlyActive === opt.key ? "var(--surface-3)" : "transparent",
                  border: onlyActive === opt.key ? "1px solid var(--line-2)" : "1px solid transparent",
                  color: onlyActive === opt.key ? "var(--chalk)" : "var(--muted)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ================= VAULT HUD ================= */}
      {cards.length > 0 && (
        <section
          className="panel sweep rise"
          style={{
            animationDelay: "0.08s",
            marginTop: 30,
            padding: "22px 28px",
            display: "flex",
            justifyContent: "space-around",
            flexWrap: "wrap",
            gap: 22,
          }}
        >
          <HudStat value={cards.length.toString()} label="Cards owned" accent="chalk" />
          <span style={{ width: 1, background: "var(--line-2)", alignSelf: "stretch" }} />
          <HudStat value={totalPoints.toLocaleString()} label="Total points" accent="gold" />
          <span style={{ width: 1, background: "var(--line-2)", alignSelf: "stretch" }} />
          <HudStat value={totalMatches.toString()} label="Matches played" accent="volt" />
          <span style={{ width: 1, background: "var(--line-2)", alignSelf: "stretch" }} />
          <HudStat value={totalMvp.toString()} label="MVP awards" accent="gold" />
        </section>
      )}

      {/* ================= LOADING ================= */}
      {loading && (
        <section
          className="grid"
          style={{ marginTop: 30, gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 22, justifyItems: "center" }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rise" style={{ animationDelay: `${i * 0.06}s`, width: 200 }}>
              <div
                style={{
                  width: 200,
                  aspectRatio: "280 / 400",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "linear-gradient(180deg, var(--surface-2), var(--surface))",
                }}
              />
              <div className="panel" style={{ marginTop: 8, padding: "12px 14px", textAlign: "center" }}>
                <span className="mono muted" style={{ fontSize: 11, letterSpacing: "0.12em" }}>LOADING…</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ================= EMPTY STATE ================= */}
      {!loading && cards.length === 0 && (
        <div className="empty-state rise" style={{ marginTop: 30, padding: "56px 26px" }}>
          <div className="num" style={{ fontSize: 56, color: "var(--line-2)", lineHeight: 0.9 }}>◎</div>
          <h3 style={{ fontSize: 22, fontWeight: 800, marginTop: 16, color: "var(--chalk)" }}>
            {picks.length === 0 ? "Your vault is empty" : "Your squad isn't on-chain yet"}
          </h3>
          <p className="muted" style={{ marginTop: 10, maxWidth: "46ch", marginInline: "auto", fontSize: 14.5 }}>
            {picks.length === 0
              ? "Build a national-team XI and submit it. Your cards are created with it and start their on-chain career straight away."
              : "Submit your squad on-chain from the draft room. Cards for all 15 players are created in the same step."}
          </p>
          <Link to="/build" className="btn btn-primary btn-lg" style={{ marginTop: 24 }}>
            {picks.length === 0 ? "Build a squad →" : "Go to draft room →"}
          </Link>
        </div>
      )}

      {!loading && cards.length > 0 && shownCards.length === 0 && (
        <div className="empty-state rise" style={{ marginTop: 30, padding: "40px 26px" }}>
          <p className="muted" style={{ fontSize: 14.5, margin: 0 }}>
            None of your cards are in the active squad right now.
          </p>
        </div>
      )}

      {/* ================= CARD VAULT GRID ================= */}
      {!loading && shownCards.length > 0 && (
        <section
          className="grid"
          style={{ marginTop: 30, gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 26, justifyItems: "center" }}
        >
          {shownCards.map((c, i) => {
            const p = playerById.get(c.playerId);
            if (!p) return null;
            const inSquad = activeIds.has(c.playerId);
            return (
              <div key={c.playerId} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s`, width: 200 }}>
                <div style={{ position: "relative" }}>
                  <Link to={`/player/${c.playerId}`}>
                    <PlayerCard player={p} country={countryByIso.get(p.nationalTeam)} width={200} />
                  </Link>
                  {/* Marks the cards that are still earning points, so the vault reads at a glance. */}
                  {inSquad && (
                    <span
                      className="mono"
                      title="In your active squad: still earning points"
                      style={{
                        position: "absolute", top: 8, left: 8, zIndex: 2,
                        background: "var(--volt)", color: "var(--on-volt)",
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
                        padding: "3px 7px", borderRadius: 999,
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>

                {/* On-chain dossier strip */}
                <div className="panel panel-notch" style={{ marginTop: 12, padding: "12px 14px" }}>
                  <div
                    className="mono"
                    style={{
                      fontSize: 9.5,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--faint)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--volt)", boxShadow: "0 0 6px var(--volt)" }} />
                    On-chain dossier
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 14px" }}>
                    <Dossier label="Matches" value={statsById.get(c.playerId)?.matchesPlayed ?? 0} />
                    <Dossier label="Points" value={statsById.get(c.playerId)?.totalPoints ?? 0} accent="var(--gold)" />
                    <Dossier label="MVP" value={statsById.get(c.playerId)?.mvpCount ?? 0} />
                    <Dossier label="Best" value={statsById.get(c.playerId)?.bestScore ?? 0} />
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function HudStat({ value, label, accent }: { value: string; label: string; accent: "gold" | "volt" | "chalk" }) {
  const color = accent === "gold" ? "var(--gold)" : accent === "volt" ? "var(--volt)" : "var(--chalk)";
  return (
    <div className="stat">
      <div className="num" style={{ fontSize: "clamp(28px,4vw,46px)", color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Dossier({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
        {label}
      </span>
      <span className="num" style={{ fontSize: 22, color: accent ?? "var(--chalk)" }}>{value}</span>
    </div>
  );
}
