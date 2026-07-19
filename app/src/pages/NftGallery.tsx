import { useCallback, useEffect, useState } from "react";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import { useSquad } from "../lib/squad";
import { PlayerCard } from "../components/PlayerCard";
import { fetchMyCards, getProgram, mintPlayerCards, type OnchainCard } from "../lib/anchor";

/**
 * My Cards - the user's REAL on-chain "living cards" (PlayerCard accounts).
 * Each card accumulates a performance history on the chain (matches played, points, MVP, best
 * score). After the squad is submitted, they are created on-chain via "Mint".
 */
export function NftGallery() {
  const { connected } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const { playerById, countryByIso, statsById } = useData();
  const { picks } = useSquad();

  const [cards, setCards] = useState<OnchainCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  const onMint = async () => {
    if (!wallet || picks.length === 0) return;
    setBusy(true); setMsg("Minting your living cards on-chain… approve in your wallet.");
    try {
      const program = getProgram(connection, wallet);
      const n = await mintPlayerCards(program, wallet.publicKey, picks.map((p) => p.playerId));
      setMsg(n > 0 ? `${n} card(s) minted on-chain.` : "All your cards are already minted.");
      await load();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setMsg(/reject/i.test(raw) ? "Transaction rejected in your wallet." : `Error: ${raw}`);
    } finally {
      setBusy(false);
    }
  };

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

  const mintedIds = new Set(cards.map((c) => c.playerId));
  const unminted = picks.filter((p) => !mintedIds.has(p.playerId));

  /* ---------- Vault aggregates: REAL tournament stats for owned cards ---------- */
  const totalPoints = cards.reduce((s, c) => s + (statsById.get(c.playerId)?.totalPoints ?? 0), 0);
  const totalMatches = cards.reduce((s, c) => s + (statsById.get(c.playerId)?.matchesPlayed ?? 0), 0);
  const totalMvp = cards.reduce((s, c) => s + (statsById.get(c.playerId)?.mvpCount ?? 0), 0);
  const msgIsError = msg ? /error|reject/i.test(msg) : false;

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
        </div>
        {unminted.length > 0 && (
          <button className="btn btn-pitch btn-lg" disabled={busy} onClick={onMint}>
            {busy ? "Minting…" : `Mint ${unminted.length} card${unminted.length > 1 ? "s" : ""} on-chain`}
          </button>
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

      {/* ================= MINT STATUS MESSAGE ================= */}
      {msg && (
        <div
          className="panel rise"
          style={{
            marginTop: 20,
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderColor: msgIsError ? "var(--danger)" : "var(--line-2)",
            background: msgIsError
              ? "rgba(255,90,90,0.06)"
              : "linear-gradient(180deg, rgba(198,242,78,0.05), rgba(255,255,255,0))",
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: msgIsError ? "var(--danger)" : "var(--volt)",
              flexShrink: 0,
            }}
          >
            {busy ? "Signing" : msgIsError ? "Notice" : "On-chain"}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{msg}</span>
        </div>
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
              ? "Build a national-team XI, submit it, then mint your living cards here — each one starts its on-chain career the moment it's minted."
              : 'Tap "Mint" above to create your living cards on Solana and start tracking their real performance history.'}
          </p>
          {picks.length === 0 ? (
            <Link to="/build" className="btn btn-primary btn-lg" style={{ marginTop: 24 }}>Build a squad →</Link>
          ) : (
            <button className="btn btn-pitch btn-lg" style={{ marginTop: 24 }} disabled={busy} onClick={onMint}>
              {busy ? "Minting…" : `Mint ${unminted.length} card${unminted.length > 1 ? "s" : ""} on-chain`}
            </button>
          )}
        </div>
      )}

      {/* ================= CARD VAULT GRID ================= */}
      {!loading && cards.length > 0 && (
        <section
          className="grid"
          style={{ marginTop: 30, gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 26, justifyItems: "center" }}
        >
          {cards.map((c, i) => {
            const p = playerById.get(c.playerId);
            if (!p) return null;
            return (
              <div key={c.playerId} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s`, width: 200 }}>
                <Link to={`/player/${c.playerId}`}>
                  <PlayerCard player={p} country={countryByIso.get(p.nationalTeam)} width={200} />
                </Link>

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
