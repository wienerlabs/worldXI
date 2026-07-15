import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useData } from "../lib/data";
import { useSquad } from "../lib/squad";
import { FORMATIONS, type Position } from "../lib/types";
import { getProgram, profilePda, submitSquad } from "../lib/anchor";

const POS_TABS: Position[] = ["GK", "DEF", "MID", "FWD"];
const POS_LIMIT: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

export function SquadBuilder() {
  const { players, countryByIso } = useData();
  const { picks, add, remove, formation, setFormation, captainId, setCaptain, spent, remaining, starterIds, isStarter, clear } = useSquad();
  const { connection } = useConnection();
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();

  const [tab, setTab] = useState<Position>("GK");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pool = useMemo(() => {
    const picked = new Set(picks.map((p) => p.playerId));
    return players
      .filter((p) => p.position === tab && !picked.has(p.playerId))
      .filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) || p.nationalTeam.toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => b.priceSol - a.priceSol)
      .slice(0, 80);
  }, [players, tab, q, picks]);

  const shape = FORMATIONS[formation];

  const onSubmit = async () => {
    if (!wallet.publicKey || !anchorWallet) { setMsg("Connect your wallet first."); return; }
    if (picks.length !== 15) { setMsg(`Select 15 players first (${picks.length}/15).`); return; }
    if (starterIds.length !== 11) { setMsg("Your picks don't fill this formation. Change formation or players."); return; }
    if (captainId === null || !starterIds.includes(captainId)) {
      setMsg('Pick a captain: tap the gold "C" next to one of your starters.');
      return;
    }
    setBusy(true); setMsg("Preparing transaction… approve it in your wallet.");
    try {
      const program = getProgram(connection, anchorWallet);
      // If the profile is being created for the first time, get a nickname; it is sent in the same transaction as submit.
      const prof = await connection.getAccountInfo(profilePda(wallet.publicKey));
      let nickname: string | undefined;
      let country: string | undefined;
      if (!prof) {
        nickname = window.prompt("First time - choose a manager nickname (max 24):")?.slice(0, 24) || undefined;
        if (!nickname) { setMsg("A nickname is required for your first squad."); setBusy(false); return; }
        // Optional: the country you joined (3-letter code, e.g. TUR). Can be left blank.
        country = window.prompt("Optional - your country (3-letter code, e.g. TUR, FRA, BRA). Leave blank to skip:")
          ?.trim().toUpperCase().slice(0, 3) || undefined;
      }
      const sig = await submitSquad(program, wallet.publicKey, picks, starterIds, formation, captainId!, nickname, country);
      setMsg(`Squad submitted on-chain! Tx: ${sig.slice(0, 12)}… - your player cards are being minted.`);
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
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <h1 className="section-title">Build Your Squad</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="card" style={{ padding: "8px 14px", minWidth: 190 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span className="muted">Budget</span>
              <span><b className={remaining < 0 ? "" : "gold"} style={remaining < 0 ? { color: "var(--danger)" } : undefined}>{spent.toFixed(1)}</b> / 25 SOL</span>
            </div>
            <div className="progress">
              <span className={remaining < 0 ? "over" : ""} style={{ width: `${Math.min(100, (spent / 25) * 100)}%` }} />
            </div>
          </div>
          <select value={formation} onChange={(e) => setFormation(e.target.value)}>
            {Object.keys(FORMATIONS).map((f) => <option key={f} value={f}>{f.replace("F", "").split("").join("-")}</option>)}
          </select>
          <button className="btn btn-green" disabled={busy} onClick={onSubmit}>{busy ? "Submitting…" : "Submit On-chain"}</button>
        </div>
      </div>
      {msg && <div className="card" style={{ marginTop: 12 }}>{msg}</div>}

      <div className="grid" style={{ gridTemplateColumns: "1fr 340px", marginTop: 16, alignItems: "start" }}>
        {/* Pool */}
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {POS_TABS.map((t) => (
              <button key={t} className={t === tab ? "btn btn-primary" : "btn btn-outline"} style={{ padding: "8px 14px" }} onClick={() => setTab(t)}>
                {t} ({picks.filter((p) => p.position === t).length}/{POS_LIMIT[t]})
              </button>
            ))}
            <input placeholder="search name / country" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 150 }} />
          </div>
          <div className="card" style={{ padding: 0, maxHeight: 540, overflowY: "auto" }}>
            <table>
              <tbody>
                {pool.map((p) => (
                  <tr key={p.playerId}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{countryByIso.get(p.nationalTeam)?.flagEmoji} #{p.jerseyNumber}</td>
                    <td>{p.name}</td>
                    <td className="muted">{p.priceTier}</td>
                    <td className="gold" style={{ fontWeight: 700 }}>{p.priceSol}</td>
                    <td><button className="btn btn-outline" style={{ padding: "5px 12px" }} onClick={() => setMsg(add(p))}>Add</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected squad */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 17 }}>My Squad ({picks.length}/15)</h3>
            {picks.length > 0 && (
              <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: 12, color: "var(--danger)", borderColor: "var(--danger)" }}
                onClick={() => { if (window.confirm("Clear your whole squad and start over? This only resets your local picks.")) { clear(); setMsg("Squad cleared. Start building from scratch."); } }}>
                Clear all
              </button>
            )}
          </div>
          <div className="muted" style={{ fontSize: 12, margin: "4px 0 12px" }}>
            Formation {shape ? `1-${shape.def}-${shape.mid}-${shape.fwd}` : ""} · captain scores 2x
          </div>
          {(["GK", "DEF", "MID", "FWD"] as Position[]).map((pos) => (
            <div key={pos} style={{ marginBottom: 10 }}>
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>{pos}</div>
              {picks.filter((p) => p.position === pos).map((p) => (
                <div key={p.playerId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                  <span style={{ fontSize: 14 }}>
                    <button onClick={() => setCaptain(p.playerId)} title="Set captain"
                      style={{ color: captainId === p.playerId ? "var(--gold)" : "var(--text-muted)", fontWeight: 900, marginRight: 6 }}>C</button>
                    {p.name} <span className="muted" style={{ fontSize: 12 }}>{p.priceSol}</span>
                  </span>
                  <button className="btn btn-outline" style={{ padding: "2px 9px" }} onClick={() => remove(p.playerId)}>x</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
