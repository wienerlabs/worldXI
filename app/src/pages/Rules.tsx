import type { ReactNode } from "react";
import {
  SCORING,
  RARITY_BONUS_PCT,
  CAPTAIN_MULTIPLIER,
  TIER_PRICE_SOL,
  POS_LIMITS,
  FORMATIONS,
  BUDGET_SOL,
  MAX_PER_COUNTRY,
  SQUAD_SIZE,
  STARTERS_SIZE,
  type Position,
} from "../lib/types";

/**
 * Puanlama sistemi ve genel kurallar. Tum degerler lib/types.ts'teki tek gercek
 * kaynaktan gelir; bunlar oracle rules.ts (POINTS) ve program enums.rs/settle ile
 * birebir ayni. Statik dokuman - kullanici tum kurallari buradan okuyabilir.
 */

interface ScoreRow {
  label: string;
  pts: number;
  note?: string;
}

const SCORE_POSITIVE: ScoreRow[] = [
  { label: "Match appearance", pts: SCORING.appearance, note: "Plays any minutes" },
  { label: "Playing 60+ minutes", pts: SCORING.minutes60 },
  { label: "Goal (Goalkeeper)", pts: SCORING.goalGk },
  { label: "Goal (Defender)", pts: SCORING.goalDef },
  { label: "Goal (Midfielder)", pts: SCORING.goalMid },
  { label: "Goal (Forward)", pts: SCORING.goalFwd },
  { label: "Assist", pts: SCORING.assist },
  { label: "Clean sheet (GK / DEF)", pts: SCORING.cleanSheet, note: "60+ min, team concedes 0" },
  { label: "Penalty save", pts: SCORING.penaltySave },
  { label: "Man of the match (MVP)", pts: SCORING.mvp, note: "Top scorer with a goal/assist" },
];

const SCORE_NEGATIVE: ScoreRow[] = [
  { label: "Yellow card", pts: SCORING.yellowCard },
  { label: "Red card", pts: SCORING.redCard },
  { label: "Own goal", pts: SCORING.ownGoal },
];

const RARITIES: Array<{ name: string; pct: number }> = [
  { name: "Common", pct: RARITY_BONUS_PCT.Common },
  { name: "Rare", pct: RARITY_BONUS_PCT.Rare },
  { name: "Legendary", pct: RARITY_BONUS_PCT.Legendary },
];

const fmtShape = (k: string): string => {
  const s = FORMATIONS[k];
  return `1-${s.def}-${s.mid}-${s.fwd}`;
};

function Section({ n, title, sub, children }: { n: number; title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: sub ? 4 : 12 }}>
        <span className="gold" style={{ fontWeight: 900, fontSize: 15 }}>{n}</span>
        <h2 style={{ fontSize: 19 }}>{title}</h2>
      </div>
      {sub && <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{sub}</p>}
      {children}
    </section>
  );
}

function PtsCell({ pts }: { pts: number }) {
  const pos = pts >= 0;
  return (
    <span style={{ fontWeight: 800, color: pos ? "var(--green)" : "var(--danger)" }}>
      {pos ? "+" : ""}{pts}
    </span>
  );
}

export function Rules() {
  return (
    <div style={{ marginTop: 20, maxWidth: 860 }}>
      <h1 className="section-title">Scoring &amp; Rules</h1>
      <p className="section-sub">
        Everything about how WorldXI works: build a squad, earn live fantasy points from real
        World Cup matches, and settle them on-chain. All values below are the exact ones the
        game runs on.
      </p>

      <Section n={1} title="Build your squad" sub="Pick a 15-player squad within a fixed budget, then set your starting 11.">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          <Fact k="Budget" v={`${BUDGET_SOL} SOL`} />
          <Fact k="Squad size" v={`${SQUAD_SIZE} players`} />
          <Fact k="Starting XI" v={`${STARTERS_SIZE} players`} />
          <Fact k="Max per country" v={`${MAX_PER_COUNTRY}`} />
        </div>
        <p className="muted" style={{ fontSize: 13, margin: "14px 0 6px" }}>Position limits (across your 15):</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.keys(POS_LIMITS) as Position[]).map((p) => (
            <span key={p} className="pill">{p}: max {POS_LIMITS[p]}</span>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13, margin: "14px 0 6px" }}>Available formations (starting XI shape):</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.keys(FORMATIONS).map((k) => <span key={k} className="pill pill-gold">{fmtShape(k)}</span>)}
        </div>
      </Section>

      <Section n={2} title="Player prices by tier" sub="Every player has a tier that sets their price. Scarcity is real: you cannot fill a squad with only top-tier players.">
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead><tr><th>Tier</th><th style={{ textAlign: "right" }}>Price</th></tr></thead>
            <tbody>
              {(Object.keys(TIER_PRICE_SOL) as Array<keyof typeof TIER_PRICE_SOL>).map((t) => (
                <tr key={t}>
                  <td style={{ fontWeight: 700 }}>{t}</td>
                  <td className="gold" style={{ textAlign: "right", fontWeight: 800 }}>{TIER_PRICE_SOL[t].toFixed(1)} SOL</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={3} title="How points are scored" sub="Points come from real match events (ESPN box score + TxLINE live feed). Goal value depends on position.">
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "8px 12px", fontWeight: 800 }} className="gold">Positive</div>
            <table>
              <tbody>
                {SCORE_POSITIVE.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}{r.note && <div className="muted" style={{ fontSize: 11 }}>{r.note}</div>}</td>
                    <td style={{ textAlign: "right" }}><PtsCell pts={r.pts} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "8px 12px", fontWeight: 800, color: "var(--danger)" }}>Penalties</div>
            <table>
              <tbody>
                {SCORE_NEGATIVE.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td style={{ textAlign: "right" }}><PtsCell pts={r.pts} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section n={4} title="Multipliers: rarity and captain" sub="Your raw match points are boosted on-chain when your squad matchday is settled.">
        <div className="card" style={{ padding: 0, overflowX: "auto", marginBottom: 12 }}>
          <table>
            <thead><tr><th>Card rarity</th><th style={{ textAlign: "right" }}>Point bonus</th></tr></thead>
            <tbody>
              {RARITIES.map((r) => (
                <tr key={r.name}>
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td className="gold" style={{ textAlign: "right", fontWeight: 800 }}>+{r.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ borderColor: "var(--gold)" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Captain</div>
          <p className="muted" style={{ fontSize: 13 }}>Your captain scores <b className="gold">{CAPTAIN_MULTIPLIER}x</b> points. Pick one starter to wear the armband.</p>
        </div>
        <div className="card" style={{ marginTop: 12, background: "var(--bg-elevated)" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Final formula (applied on-chain per player):</div>
          <code style={{ fontSize: 13 }}>final = raw_points x rarity_bonus x (captain ? {CAPTAIN_MULTIPLIER} : 1)</code>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Example: a Legendary captain forward scores a goal (+{SCORING.goalFwd}) and plays 90 min
            (+{SCORING.appearance}+{SCORING.minutes60}). Raw = {SCORING.goalFwd + SCORING.appearance + SCORING.minutes60}.
            Legendary +{RARITY_BONUS_PCT.Legendary}% then captain {CAPTAIN_MULTIPLIER}x ={" "}
            <b className="gold">
              {Math.round((SCORING.goalFwd + SCORING.appearance + SCORING.minutes60) * (1 + RARITY_BONUS_PCT.Legendary / 100) * CAPTAIN_MULTIPLIER)}
            </b>{" "}
            points.
          </p>
        </div>
      </Section>

      <Section n={5} title="Where the data comes from" sub="No made-up numbers. Every point traces back to a real event, and the totals live on-chain.">
        <ul style={{ paddingLeft: 18, lineHeight: 1.9, fontSize: 14 }}>
          <li><b>TxLINE</b> - the core live feed: which matches are on, kickoff times, and real-time goal/card events during play.</li>
          <li><b>ESPN box score</b> - the scoring truth: appearances, minutes, goals, assists, cards, clean sheets, matched by athlete id.</li>
          <li><b>On-chain (Solana devnet)</b> - each player's match points are written with <code>commit_score</code>; your squad is settled with <code>settle_squad_matchday</code>, where rarity and captain multipliers apply.</li>
        </ul>
      </Section>

      <Section n={6} title="Fair play and the model" sub="A prize game, not a betting game.">
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.8 }}>
          No gambling, no entry fees, no pooled prizes. Prize leagues are <b className="gold">100% sponsor-funded</b>,
          so players never risk money. Living player cards gain value from real on-chain performance history,
          and the revenue model is built on card royalties, cosmetic mints, and sponsor partnerships - never pay-to-win.
        </p>
      </Section>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="card" style={{ background: "var(--bg-elevated)" }}>
      <div className="gold" style={{ fontSize: 20, fontWeight: 900 }}>{v}</div>
      <div className="muted" style={{ fontSize: 12 }}>{k}</div>
    </div>
  );
}
