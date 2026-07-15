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
  const { playerById, countryByIso } = useData();
  const { picks } = useSquad();

  const [cards, setCards] = useState<OnchainCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!wallet) return;
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

  if (!connected) return <div className="card" style={{ marginTop: 24 }}>Connect your wallet to view your cards.</div>;

  const mintedIds = new Set(cards.map((c) => c.playerId));
  const unminted = picks.filter((p) => !mintedIds.has(p.playerId));

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h1 className="section-title">My Cards</h1>
        {unminted.length > 0 && (
          <button className="btn btn-green" disabled={busy} onClick={onMint}>
            {busy ? "Minting…" : `Mint ${unminted.length} card(s) on-chain`}
          </button>
        )}
      </div>
      <p className="section-sub">
        Living cards, not static collectibles - each is an on-chain PlayerCard that builds a real performance history (matches, points, MVP, best score).
      </p>
      {msg && <div className="card" style={{ marginBottom: 14 }}>{msg}</div>}

      {loading && <div className="card">Loading your on-chain cards…</div>}
      {!loading && cards.length === 0 && (
        <div className="card">
          {picks.length === 0
            ? <>No cards yet. <Link className="gold" to="/build">Build a squad</Link>, submit it, then mint your cards here.</>
            : <>Your squad isn't minted on-chain yet. Tap "Mint" above to create your living cards.</>}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 22, justifyItems: "center" }}>
        {cards.map((c) => {
          const p = playerById.get(c.playerId);
          if (!p) return null;
          return (
            <div key={c.playerId} style={{ width: 200 }}>
              <Link to={`/player/${c.playerId}`}><PlayerCard player={p} country={countryByIso.get(p.nationalTeam)} width={200} /></Link>
              <div className="card" style={{ marginTop: 8, padding: "8px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12 }}>
                <span className="muted">Matches</span><span style={{ textAlign: "right", fontWeight: 700 }}>{c.matchesPlayed}</span>
                <span className="muted">Points</span><span className="gold" style={{ textAlign: "right", fontWeight: 800 }}>{c.totalPoints}</span>
                <span className="muted">MVP</span><span style={{ textAlign: "right", fontWeight: 700 }}>{c.mvpCount}</span>
                <span className="muted">Best</span><span style={{ textAlign: "right", fontWeight: 700 }}>{c.bestSingleScore}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
