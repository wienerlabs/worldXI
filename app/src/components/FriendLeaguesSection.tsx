import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getProgram, createFriendLeague, joinFriendLeague, generateLeagueCode } from "../lib/anchor";
import { fetchMyFriendLeagues, type FriendLeagueRow } from "../lib/api";
import { PromptModal } from "./PromptModal";

function errText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return /reject/i.test(raw) ? "Transaction rejected in your wallet." : `Error: ${raw}`;
}

/** Private, invite-code friend leagues: create one (get a code), or join with a code.
 *  Everything else in the game stays the same; a league is just a private leaderboard.
 *  There is no "leave" action; membership is permanent once you join. */
export function FriendLeaguesSection() {
  const { connected } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [leagues, setLeagues] = useState<FriendLeagueRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "join" | null>(null);

  const load = useCallback(async () => {
    if (!wallet) return;
    try { setLeagues(await fetchMyFriendLeagues(wallet.publicKey.toBase58())); } catch { setLeagues([]); }
  }, [wallet]);
  useEffect(() => { void load(); }, [load]);

  const submitCreate = async (rawName: string) => {
    const name = rawName.trim().slice(0, 32);
    if (!wallet || !name) return;
    setModal(null); setBusy(true); setMsg("Creating your league on-chain, approve it in your wallet.");
    try {
      const program = getProgram(connection, wallet);
      const r = await createFriendLeague(program, wallet.publicKey, generateLeagueCode(), name);
      setMsg(`League created. Share this invite code with friends: ${r.code}`);
      await load();
    } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  };

  const submitJoin = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!wallet) return;
    // Validate against the same safe alphabet generateLeagueCode uses (no O/0/I/1)
    // before building any transaction.
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
      setMsg("Invite codes are 6 characters (letters and digits, no O/0/I/1).");
      return;
    }
    setModal(null); setBusy(true); setMsg("Joining the league on-chain, approve it in your wallet.");
    try {
      const program = getProgram(connection, wallet);
      await joinFriendLeague(program, wallet.publicKey, code);
      setMsg("Joined the league.");
      await load();
    } catch (e) {
      const raw = String(e);
      setMsg(/already in use|0x0\b/i.test(raw) ? "You are already in this league, or the code is invalid." : errText(e));
    } finally { setBusy(false); }
  };

  const copyCode = (code: string) => { void navigator.clipboard?.writeText(code); setMsg(`Copied code ${code} to clipboard.`); };

  return (
    <section className="section">
      <div className="between section-head">
        <div>
          <div className="eyebrow" style={{ color: "var(--volt)" }}>Private · invite-code</div>
          <h2 className="section-title" style={{ marginTop: 12 }}>Friend leagues</h2>
          <p className="section-sub">
            Create a league, share the code, and race your friends on the same squads and scoring.
            Lineups stay hidden until kickoff.
          </p>
        </div>
        {connected && (
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-outline" disabled={busy} onClick={() => setModal("join")}>Join with code</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => setModal("create")}>Create league</button>
          </div>
        )}
      </div>

      {msg && (
        <div className="panel rise" style={{ padding: "12px 16px", marginBottom: 16, borderColor: "var(--line-2)" }}>
          <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--volt)", marginRight: 10 }}>On-chain</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{msg}</span>
        </div>
      )}

      {!connected ? (
        <div className="empty-state">
          <div className="num" style={{ fontSize: 40, color: "var(--volt)" }}>◎</div>
          <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8, color: "var(--chalk)" }}>Connect a wallet</div>
          <p className="mono" style={{ fontSize: 12.5, marginTop: 8, letterSpacing: "0.04em" }}>
            Connect your wallet from the top bar to create a friend league or join one with a code.
          </p>
        </div>
      ) : leagues.length === 0 ? (
        <div className="empty-state">
          <div className="num" style={{ fontSize: 40, color: "var(--gold)" }}>+</div>
          <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8, color: "var(--chalk)" }}>No friend leagues yet</div>
          <p className="mono" style={{ fontSize: 12.5, marginTop: 8, letterSpacing: "0.04em" }}>
            Create your own and invite friends, or join one with a code.
          </p>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
          {leagues.map((l, i) => (
            <div key={l.pubkey} className="panel hover-lift rise" style={{ animationDelay: `${0.05 + i * 0.05}s`, padding: 22, borderTop: "2px solid var(--volt)" }}>
              <div className="between" style={{ alignItems: "flex-start" }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, maxWidth: "16ch" }}>{l.name}</h3>
                {l.isCreator && <span className="pill pill-gold">Owner</span>}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 14, alignItems: "center" }}>
                <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)" }}>Code</span>
                <button onClick={() => copyCode(l.code)} className="num" title="Copy code"
                  style={{ fontSize: 22, color: "var(--gold)", letterSpacing: "0.14em", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  {l.code}
                </button>
              </div>
              <div className="divider" style={{ margin: "14px 0" }} />
              <div className="between">
                <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                  <b className="volt" style={{ fontWeight: 700 }}>{l.memberCount}</b> member{l.memberCount === 1 ? "" : "s"}
                </span>
                <Link to={`/league/${l.pubkey}`} className="btn btn-outline" style={{ padding: "5px 14px", fontSize: 13 }}>View league</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === "create" && (
        <PromptModal
          eyebrow="Friend league"
          title="Create a friend league"
          fields={[{ name: "name", label: "League name", placeholder: "e.g. Sunday Legends", maxLength: 32 }]}
          hint="A 6-character invite code will be generated for you to share."
          submitLabel="Create league"
          onSubmit={(v) => submitCreate(v.name ?? "")}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "join" && (
        <PromptModal
          eyebrow="Friend league"
          title="Join a friend league"
          fields={[{ name: "code", label: "Invite code", placeholder: "6-character code", maxLength: 6, uppercase: true }]}
          hint="Ask the league owner for the code they shared."
          submitLabel="Join league"
          onSubmit={(v) => submitJoin(v.code ?? "")}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  );
}
