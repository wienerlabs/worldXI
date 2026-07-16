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

const exampleRaw = SCORING.goalFwd + SCORING.appearance + SCORING.minutes60;
const exampleFinal = Math.round(exampleRaw * (1 + RARITY_BONUS_PCT.Legendary / 100) * CAPTAIN_MULTIPLIER);

function Section({
  n,
  eyebrow,
  title,
  sub,
  accent = "gold",
  children,
}: {
  n: number;
  eyebrow: string;
  title: string;
  sub?: string;
  accent?: "gold" | "volt";
  children: ReactNode;
}) {
  const accentVar = accent === "volt" ? "var(--volt)" : "var(--gold)";
  return (
    <section
      className="panel rise"
      style={{ marginBottom: 20, padding: "24px 24px 26px", animationDelay: `${0.06 * n}s`, borderTop: `2px solid ${accentVar}` }}
    >
      <div className="row" style={{ alignItems: "flex-start", gap: 18, marginBottom: sub ? 6 : 12 }}>
        <span
          className="num"
          aria-hidden
          style={{
            fontSize: 40,
            lineHeight: 0.8,
            color: "transparent",
            WebkitTextStroke: `1.4px ${accentVar}`,
            flexShrink: 0,
            minWidth: 34,
          }}
        >
          {String(n).padStart(2, "0")}
        </span>
        <div>
          <div className={`eyebrow${accent === "gold" ? " gold" : ""}`}>{eyebrow}</div>
          <h2 style={{ fontSize: "clamp(20px,2.6vw,26px)", fontWeight: 900, letterSpacing: "-0.02em", marginTop: 9 }}>
            {title}
          </h2>
        </div>
      </div>
      {sub && (
        <p className="muted" style={{ fontSize: 14, marginBottom: 16, maxWidth: "62ch", lineHeight: 1.6 }}>
          {sub}
        </p>
      )}
      {children}
    </section>
  );
}

function PtsCell({ pts }: { pts: number }) {
  const pos = pts >= 0;
  return (
    <span
      className="num"
      style={{ fontSize: 22, color: pos ? "var(--volt)" : "var(--danger)" }}
    >
      {pos ? "+" : ""}
      {pts}
    </span>
  );
}

export function Rules() {
  return (
    <div style={{ marginTop: 24, maxWidth: 900, marginLeft: "auto", marginRight: "auto" }}>
      {/* ================= HEADER ================= */}
      <header className="rise" style={{ marginBottom: 34 }}>
        <div className="eyebrow gold">The rulebook · On-chain fantasy</div>
        <h1
          className="display"
          style={{ fontSize: "clamp(40px,7vw,82px)", marginTop: 16, letterSpacing: "-0.01em" }}
        >
          Scoring &amp; <span className="gold">rules</span>
        </h1>
        <p className="muted" style={{ fontSize: 16.5, lineHeight: 1.6, marginTop: 18, maxWidth: "60ch" }}>
          Everything about how WorldXI works: build a squad, earn live fantasy points from real
          World Cup matches, and settle them on-chain. Every value below is the{" "}
          <b className="gold" style={{ fontWeight: 800 }}>exact one</b> the game runs on.
        </p>
      </header>

      {/* ================= 1 · BUILD SQUAD ================= */}
      <Section
        n={1}
        eyebrow="Team sheet"
        title="Build your squad"
        sub="Pick a 15-player squad within a fixed budget, then set your starting 11."
      >
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          <Fact k="Budget" v={`${BUDGET_SOL}`} suffix=" SOL" accent="gold" />
          <Fact k="Squad size" v={`${SQUAD_SIZE}`} suffix=" players" accent="volt" />
          <Fact k="Starting XI" v={`${STARTERS_SIZE}`} suffix=" players" accent="volt" />
          <Fact k="Max per country" v={`${MAX_PER_COUNTRY}`} accent="gold" />
        </div>

        <p className="eyebrow" style={{ margin: "22px 0 10px" }}>
          Position limits (across your {SQUAD_SIZE})
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.keys(POS_LIMITS) as Position[]).map((p) => (
            <span key={p} className="pill pill-volt">
              {p} · max {POS_LIMITS[p]}
            </span>
          ))}
        </div>

        <p className="eyebrow gold" style={{ margin: "22px 0 10px" }}>
          Available formations (starting XI shape)
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.keys(FORMATIONS).map((k) => (
            <span key={k} className="pill pill-gold">
              {fmtShape(k)}
            </span>
          ))}
        </div>
      </Section>

      {/* ================= 2 · TIER PRICES ================= */}
      <Section
        n={2}
        eyebrow="The market"
        title="Player prices by tier"
        sub="Every player has a tier that sets their price. Scarcity is real: you cannot fill a squad with only top-tier players."
      >
        <div className="panel-flush" style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Tier</th>
                <th style={{ textAlign: "right" }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(TIER_PRICE_SOL) as Array<keyof typeof TIER_PRICE_SOL>).map((t) => (
                <tr key={t}>
                  <td style={{ fontWeight: 800 }}>{t}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="num gold" style={{ fontSize: 22 }}>
                      {TIER_PRICE_SOL[t].toFixed(1)}
                    </span>
                    <span className="mono muted" style={{ fontSize: 12, marginLeft: 5 }}>
                      SOL
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ================= 3 · SCORING ================= */}
      <Section
        n={3}
        eyebrow="Match events"
        title="How points are scored"
        accent="volt"
        sub="Points come from real match events (ESPN box score + TxLINE live feed). Goal value depends on position."
      >
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          <div className="panel-flush" style={{ border: "1px solid rgba(198,242,78,0.25)", borderRadius: "var(--r)" }}>
            <div
              style={{
                padding: "11px 16px",
                background: "rgba(198,242,78,0.08)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span className="eyebrow" style={{ color: "var(--volt)" }}>
                Positive
              </span>
            </div>
            <table>
              <tbody>
                {SCORE_POSITIVE.map((r) => (
                  <tr key={r.label}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{r.label}</span>
                      {r.note && (
                        <div className="mono muted" style={{ fontSize: 11, marginTop: 3 }}>
                          {r.note}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <PtsCell pts={r.pts} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="panel-flush"
            style={{ border: "1px solid rgba(255,90,90,0.28)", borderRadius: "var(--r)", alignSelf: "flex-start" }}
          >
            <div
              style={{
                padding: "11px 16px",
                background: "rgba(255,90,90,0.08)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span className="eyebrow" style={{ color: "var(--danger)" }}>
                Penalties
              </span>
            </div>
            <table>
              <tbody>
                {SCORE_NEGATIVE.map((r) => (
                  <tr key={r.label}>
                    <td style={{ fontWeight: 600 }}>{r.label}</td>
                    <td style={{ textAlign: "right" }}>
                      <PtsCell pts={r.pts} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ================= 4 · MULTIPLIERS ================= */}
      <Section
        n={4}
        eyebrow="On-chain boosts"
        title="Multipliers: rarity and captain"
        sub="Your raw match points are boosted on-chain when your squad matchday is settled."
      >
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          <div className="panel-flush" style={{ border: "1px solid var(--line)", borderRadius: "var(--r)", overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Card rarity</th>
                  <th style={{ textAlign: "right" }}>Point bonus</th>
                </tr>
              </thead>
              <tbody>
                {RARITIES.map((r) => (
                  <tr key={r.name}>
                    <td style={{ fontWeight: 800 }}>{r.name}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className="num gold" style={{ fontSize: 22 }}>
                        +{r.pct}
                      </span>
                      <span className="mono muted" style={{ fontSize: 12 }}>
                        %
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="panel"
            style={{
              borderColor: "rgba(232,189,84,0.4)",
              background: "linear-gradient(140deg, rgba(232,189,84,0.08), rgba(255,255,255,0))",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div className="eyebrow gold" style={{ marginBottom: 12 }}>
              The armband
            </div>
            <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
              <span className="num gold" style={{ fontSize: 52 }}>
                {CAPTAIN_MULTIPLIER}×
              </span>
              <span style={{ fontWeight: 800, fontSize: 17 }}>Captain</span>
            </div>
            <p className="muted" style={{ fontSize: 13.5, marginTop: 10, lineHeight: 1.6 }}>
              Your captain scores <b className="gold">{CAPTAIN_MULTIPLIER}×</b> points. Pick one starter to wear the armband.
            </p>
          </div>
        </div>

        {/* Formula block */}
        <div
          className="panel-notch"
          style={{
            marginTop: 16,
            padding: "22px 24px",
            background: "linear-gradient(135deg, rgba(31,157,99,0.12), rgba(198,242,78,0.06))",
            border: "1px solid var(--line-2)",
          }}
        >
          <div className="eyebrow" style={{ color: "var(--volt)" }}>
            Final formula · applied on-chain per player
          </div>
          <code
            className="mono"
            style={{
              display: "block",
              marginTop: 14,
              fontSize: "clamp(13px,2.4vw,16px)",
              color: "var(--chalk)",
              letterSpacing: "0.01em",
            }}
          >
            <span className="volt">final</span> = raw_points × <span className="gold">rarity_bonus</span> × (captain ?{" "}
            <span className="gold">{CAPTAIN_MULTIPLIER}</span> : 1)
          </code>

          <div className="divider" style={{ margin: "20px 0", background: "var(--line-2)" }} />

          <div className="eyebrow gold">Worked example</div>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 10, lineHeight: 1.75 }}>
            A Legendary captain forward scores a goal (<b className="volt">+{SCORING.goalFwd}</b>) and plays 90 min (
            <b className="volt">+{SCORING.appearance}</b>
            <b className="volt">+{SCORING.minutes60}</b>). Raw ={" "}
            <b className="chalk" style={{ color: "var(--chalk)" }}>
              {exampleRaw}
            </b>
            . Legendary <b className="gold">+{RARITY_BONUS_PCT.Legendary}%</b> then captain{" "}
            <b className="gold">{CAPTAIN_MULTIPLIER}×</b>:
          </p>
          <div className="row" style={{ gap: 14, marginTop: 16, alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="num muted" style={{ fontSize: 30 }}>
              {exampleRaw}
            </span>
            <span className="mono faint">→</span>
            <span className="num" style={{ fontSize: 54, color: "var(--gold)" }}>
              {exampleFinal}
            </span>
            <span className="eyebrow gold">points settled</span>
          </div>
        </div>
      </Section>

      {/* ================= 5 · DATA SOURCES ================= */}
      <Section
        n={5}
        eyebrow="Provenance"
        title="Where the data comes from"
        accent="volt"
        sub="No made-up numbers. Every point traces back to a real event, and the totals live on-chain."
      >
        <div className="stack" style={{ gap: 12 }}>
          <SourceItem tag="TxLINE" accent="var(--live)" label="Live feed">
            The core live feed: which matches are on, kickoff times, and real-time goal/card events during play.
          </SourceItem>
          <SourceItem tag="ESPN" accent="var(--volt)" label="Box score">
            The scoring truth: appearances, minutes, goals, assists, cards, clean sheets, matched by athlete id.
          </SourceItem>
          <SourceItem tag="SOLANA" accent="var(--gold)" label="Devnet">
            Each player's match points are written with <code className="mono gold">commit_score</code>; your squad is
            settled with <code className="mono gold">settle_squad_matchday</code>, where rarity and captain multipliers apply.
          </SourceItem>
        </div>
      </Section>

      {/* ================= 6 · FAIR PLAY ================= */}
      <Section n={6} eyebrow="The model" title="Fair play and the model" sub="A prize game, not a betting game.">
        <div
          className="panel-notch"
          style={{
            padding: "24px 26px",
            background: "linear-gradient(140deg, rgba(31,157,99,0.12), rgba(232,189,84,0.06))",
            border: "1px solid var(--line-2)",
          }}
        >
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <span className="pill pill-volt">No gambling</span>
            <span className="pill pill-volt">No entry fees</span>
            <span className="pill pill-volt">No pooled prizes</span>
            <span className="pill pill-gold">100% sponsor-funded</span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--chalk-2)" }}>
            No gambling, no entry fees, no pooled prizes. Prize leagues are{" "}
            <b className="gold" style={{ fontWeight: 800 }}>100% sponsor-funded</b>, so players never risk money. Living
            player cards gain value from real on-chain performance history, and the revenue model is built on card
            royalties, cosmetic mints, and sponsor partnerships — <b className="volt">never pay-to-win</b>.
          </p>
        </div>
      </Section>
    </div>
  );
}

function Fact({ k, v, suffix, accent }: { k: string; v: string; suffix?: string; accent: "gold" | "volt" }) {
  const color = accent === "volt" ? "var(--volt)" : "var(--gold)";
  return (
    <div
      className="panel hover-lift"
      style={{ padding: "16px 18px", background: "var(--surface-2)" }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span className="num" style={{ fontSize: 34, color }}>
          {v}
        </span>
        {suffix && (
          <span className="mono muted" style={{ fontSize: 12 }}>
            {suffix.trim()}
          </span>
        )}
      </div>
      <div className="mono muted" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 8 }}>
        {k}
      </div>
    </div>
  );
}

function SourceItem({
  tag,
  accent,
  label,
  children,
}: {
  tag: string;
  accent: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="panel"
      style={{ padding: "16px 18px", display: "flex", gap: 16, alignItems: "flex-start", background: "var(--surface-2)" }}
    >
      <div style={{ flexShrink: 0, width: 92 }}>
        <div className="num" style={{ fontSize: 18, color: accent, letterSpacing: "0.04em" }}>
          {tag}
        </div>
        <div className="mono faint" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>
          {label}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
        {children}
      </p>
    </div>
  );
}
