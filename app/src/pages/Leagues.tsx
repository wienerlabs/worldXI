import { useEffect, useMemo, useState } from "react";
import { fetchLeagues, type SponsorLeagueRow } from "../lib/api";
import { FriendLeaguesSection } from "../components/FriendLeaguesSection";

const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/**
 * Leagues & Model - sponsor-funded prize leagues (onchain) + the revenue model.
 * No gambling, no entry fees, no pooled prizes by design: users never risk money.
 * A compliance-first design choice and a commercial differentiation.
 */
export function Leagues() {
  const [leagues, setLeagues] = useState<SponsorLeagueRow[]>([]);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetchLeagues().then(setLeagues).catch(() => setErr(true));
  }, []);

  const { totalPrize, liveCount, settledCount } = useMemo(() => {
    return {
      totalPrize: leagues.reduce((s, l) => s + l.prizeSol, 0),
      liveCount: leagues.filter((l) => !l.settled).length,
      settledCount: leagues.filter((l) => l.settled).length,
    };
  }, [leagues]);

  return (
    <div style={{ paddingTop: 34 }}>
      {/* ================= HERO / NO-RISK BANNER ================= */}
      <section
        className="panel panel-notch sweep rise"
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "clamp(28px, 4.4vw, 52px)",
          borderColor: "var(--line-2)",
          background:
            "linear-gradient(140deg, rgba(31,157,99,0.18), rgba(15,92,58,0.05) 55%, rgba(198,242,78,0.06))",
        }}
      >
        {/* Oversized backdrop wordmark */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: -34,
            right: -12,
            fontFamily: "var(--font-display)",
            fontSize: "clamp(80px, 14vw, 200px)",
            lineHeight: 0.8,
            color: "transparent",
            WebkitTextStroke: "1px rgba(31,157,99,0.10)",
            letterSpacing: "0.02em",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 0,
            whiteSpace: "nowrap",
          }}
        >
          NO RISK
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="eyebrow" style={{ color: "var(--pitch)" }}>
            <span style={{ background: "var(--pitch)", boxShadow: "0 0 8px var(--pitch)", width: 16, height: 2, display: "inline-block" }} />
            Compliance-first by design
          </div>
          <h1
            className="display"
            style={{ fontSize: "clamp(38px, 6.4vw, 86px)", marginTop: 16, letterSpacing: "-0.01em", maxWidth: "16ch" }}
          >
            Prize leagues,<br />
            <span className="pitch">zero</span> risk.
          </h1>
          <p className="muted" style={{ maxWidth: 560, marginTop: 20, fontSize: 17, lineHeight: 1.6 }}>
            Every prize league is <b className="pitch" style={{ fontWeight: 800 }}>100% sponsor-funded</b>. Players never
            stake, wager, or pay to enter — and winners are settled straight from the on-chain leaderboard.
          </p>

          {/* No-risk guarantee chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 26 }}>
            {["No gambling", "No entry fees", "No pooled prizes", "100% sponsor-funded"].map((t) => (
              <span
                key={t}
                className="chip"
                style={{ borderColor: "rgba(31,157,99,0.4)", background: "rgba(31,157,99,0.08)", color: "var(--chalk)" }}
              >
                <span style={{ color: "var(--pitch)", fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1 }}>✓</span>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FRIEND LEAGUES ================= */}
      <FriendLeaguesSection />

      {/* ================= SPONSOR PRIZE LEAGUES ================= */}
      <section className="section">
        <div className="between section-head">
          <div>
            <div className="eyebrow gold">On-chain · settled from the leaderboard</div>
            <h2 className="section-title" style={{ marginTop: 12 }}>Sponsor prize leagues</h2>
            <p className="section-sub">
              Sponsors fund the prize on-chain; joining is always free. Winners are settled directly from live standings.
            </p>
          </div>

          {/* Aggregate HUD */}
          {!err && leagues.length > 0 && (
            <div className="row" style={{ gap: 26, alignItems: "flex-end" }}>
              <HudStat value={`${totalPrize}`} suffix="◎" label="Total prize pool" color="var(--gold)" />
              <span style={{ width: 1, height: 46, background: "var(--line-2)" }} />
              <HudStat value={`${liveCount}`} label="Live" color="var(--live)" />
              <span style={{ width: 1, height: 46, background: "var(--line-2)" }} />
              <HudStat value={`${settledCount}`} label="Settled" color="var(--pitch)" />
            </div>
          )}
        </div>

        {err && (
          <div className="empty-state" style={{ borderColor: "rgba(255,90,90,0.4)" }}>
            <div className="num" style={{ fontSize: 40, color: "var(--danger)" }}>—</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8, color: "var(--chalk)" }}>Oracle offline</div>
            <p className="mono" style={{ fontSize: 12.5, marginTop: 8, letterSpacing: "0.04em" }}>
              Couldn't reach the leagues feed. Start the backend oracle to load sponsor leagues.
            </p>
          </div>
        )}

        {!err && leagues.length === 0 && (
          <div className="empty-state">
            <div className="num" style={{ fontSize: 40, color: "var(--gold)" }}>◎</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8, color: "var(--chalk)" }}>No sponsor leagues yet</div>
            <p className="mono" style={{ fontSize: 12.5, marginTop: 8, letterSpacing: "0.04em" }}>
              Brands haven't funded a prize league yet. Check back at kickoff.
            </p>
          </div>
        )}

        {!err && leagues.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
            {leagues.map((l, i) => (
              <div
                key={l.name}
                className="panel hover-lift rise"
                style={{
                  animationDelay: `${0.05 + i * 0.05}s`,
                  padding: 22,
                  overflow: "hidden",
                  position: "relative",
                  borderTop: `2px solid ${l.settled ? "var(--pitch)" : "var(--live)"}`,
                }}
              >
                <div className="between" style={{ alignItems: "flex-start" }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, maxWidth: "16ch" }}>{l.name}</h3>
                  {l.settled ? (
                    <span className="pill" style={{ color: "var(--pitch)", borderColor: "rgba(31,157,99,0.4)", background: "rgba(31,157,99,0.08)" }}>
                      Settled
                    </span>
                  ) : (
                    <span className="pill pill-live">
                      <span className="live-dot" style={{ width: 6, height: 6 }} />
                      Live
                    </span>
                  )}
                </div>

                {/* Prize — hero number */}
                <div style={{ margin: "16px 0 4px", display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span className="num gold" style={{ fontSize: 46, lineHeight: 0.85 }}>{l.prizeSol}</span>
                  <span className="num gold" style={{ fontSize: 24, opacity: 0.8 }}>◎</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--muted)", marginLeft: 2 }}>SOL</span>
                </div>
                <div className="eyebrow gold" style={{ fontSize: 10 }}>Sponsor-funded prize</div>

                <div className="divider" style={{ margin: "16px 0 14px" }} />

                <div className="between" style={{ gap: 8 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)" }}>
                      Sponsor
                    </div>
                    <div className="mono" style={{ fontSize: 13, color: "var(--chalk-2)", marginTop: 3 }}>{shortAddr(l.sponsor)}</div>
                  </div>
                  <span className="pill pill-volt">Free to join</span>
                </div>

                {l.winner && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "10px 12px",
                      borderRadius: "var(--r-sm)",
                      background: "rgba(232,189,84,0.07)",
                      border: "1px solid rgba(232,189,84,0.28)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gold)" }}>
                      Winner
                    </span>
                    <span className="mono gold" style={{ fontSize: 13, fontWeight: 700 }}>{shortAddr(l.winner)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ================= REVENUE MODEL ================= */}
      <section className="section">
        <div className="section-head">
          <div className="eyebrow gold">How WorldXI makes money — without your wallet</div>
          <h2 className="section-title" style={{ marginTop: 12 }}>The revenue model</h2>
          <p className="section-sub">
            A clean, gambling-free economy. Every revenue line is opt-in or sponsor-side — never pay-to-win, never a fee to play.
          </p>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18 }}>
          <RevPanel
            n="01"
            accent="var(--volt)"
            title="Secondary market royalties"
            body="A small royalty on player-card resales. Cards with a strong on-chain history — points, MVPs, best scores — are worth more."
          />
          <RevPanel
            n="02"
            accent="var(--gold)"
            title="Premium & cosmetic mints"
            body="Optional cosmetic card styles and premium mints. Purely opt-in expression — never a competitive advantage, never pay-to-win."
          />
          <RevPanel
            n="03"
            accent="var(--pitch)"
            title="Sponsor partnerships"
            body="Brands fund prize leagues for reach and engagement. Users never pay a cent; sponsors cover the prizes on-chain."
          />
        </div>
      </section>
    </div>
  );
}

function HudStat({ value, label, color, suffix }: { value: string; label: string; color: string; suffix?: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div className="num" style={{ fontSize: 34, color }}>
        {value}
        {suffix && <span style={{ fontSize: "0.55em", opacity: 0.8 }}>{suffix}</span>}
      </div>
      <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function RevPanel({ n, title, body, accent }: { n: string; title: string; body: string; accent: string }) {
  return (
    <div className="panel hover-lift" style={{ padding: 26, borderTop: `2px solid ${accent}`, position: "relative", overflow: "hidden" }}>
      <div className="num" style={{ position: "absolute", top: -6, right: 10, fontSize: 74, color: "rgba(243,241,231,0.05)" }}>{n}</div>
      <div className="num" style={{ fontSize: 28, color: accent, opacity: 0.9 }}>{n}</div>
      <h3 style={{ fontSize: 19, margin: "14px 0 10px", fontWeight: 800 }}>{title}</h3>
      <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}
