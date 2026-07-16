import { Link, useParams } from "react-router-dom";
import { useData } from "../lib/data";
import { usePlayerImage } from "../lib/photo";
import type { Player, Position } from "../lib/types";

const POS_ORDER: Position[] = ["GK", "DEF", "MID", "FWD"];
const POS_LABEL: Record<Position, string> = {
  GK: "Goalkeepers",
  DEF: "Defenders",
  MID: "Midfielders",
  FWD: "Forwards",
};
const POS_ACCENT: Record<Position, string> = {
  GK: "var(--gold)",
  DEF: "var(--pitch)",
  MID: "var(--volt)",
  FWD: "var(--gold-2)",
};

export function TeamDetail() {
  const { iso } = useParams();
  const { countries, playersByCountry } = useData();
  const country = countries.find((c) => c.isoCode === iso);
  const squad = (iso ? playersByCountry.get(iso) : undefined) ?? [];
  const avgPrice = squad.length ? squad.reduce((s, p) => s + p.priceSol, 0) / squad.length : 0;
  const top = squad.slice().sort((a, b) => b.priceSol - a.priceSol)[0];

  if (!country) {
    return (
      <div style={{ marginTop: 40 }}>
        <Link className="mono muted" to="/teams" style={{ fontSize: 12, letterSpacing: "0.08em" }}>
          ← Back to teams
        </Link>
        <div className="empty-state rise" style={{ marginTop: 18 }}>
          <div className="num" style={{ fontSize: 56, color: "var(--faint)" }}>404</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--chalk)", marginTop: 10 }}>
            Team not found
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
            No nation matches this code on the tournament feed.
          </p>
          <Link to="/teams" className="btn btn-ghost btn-sm" style={{ marginTop: 20 }}>
            Browse all teams →
          </Link>
        </div>
      </div>
    );
  }

  const primary = country.primaryColor ?? "#12463a";
  const secondary = country.secondaryColor ?? "#e8bd54";

  return (
    <div style={{ marginTop: 22 }}>
      <Link className="mono muted" to="/teams" style={{ fontSize: 12, letterSpacing: "0.08em" }}>
        ← Back to teams
      </Link>

      {/* ===================== NATION BANNER ===================== */}
      <section
        className="panel panel-notch sweep rise"
        style={{
          marginTop: 14,
          padding: "clamp(22px, 4vw, 40px)",
          overflow: "hidden",
          borderColor: "var(--line-2)",
          background: `
            radial-gradient(720px 420px at 8% -30%, ${primary}55, transparent 62%),
            radial-gradient(560px 360px at 96% 130%, ${secondary}22, transparent 60%),
            linear-gradient(160deg, rgba(255,255,255,0.02), rgba(255,255,255,0))
          `,
        }}
      >
        {/* team-color stripe rail */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 6,
            background: `linear-gradient(180deg, ${primary}, ${secondary})`,
          }}
        />
        {/* oversized ghost ISO wordmark */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: -6,
            bottom: -34,
            fontFamily: "var(--font-display)",
            fontSize: "clamp(120px, 20vw, 240px)",
            lineHeight: 0.8,
            color: "transparent",
            WebkitTextStroke: "1px rgba(243,241,231,0.05)",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 0,
          }}
        >
          {country.isoCode}
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            gap: "clamp(16px, 3vw, 34px)",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: "clamp(70px, 12vw, 112px)",
              lineHeight: 1,
              filter: "drop-shadow(0 10px 26px rgba(0,0,0,0.55))",
            }}
          >
            {country.flagEmoji}
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="eyebrow" style={{ color: secondary }}>
              <span style={{ background: secondary }} />
              {country.isoCode} · World Cup 2026 Squad
            </div>
            <h1
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 900,
                fontSize: "clamp(34px, 6vw, 68px)",
                letterSpacing: "-0.03em",
                lineHeight: 0.98,
                marginTop: 12,
              }}
            >
              {country.countryNameEn}
            </h1>
            <div className="mono muted" style={{ fontSize: 12.5, marginTop: 10, letterSpacing: "0.06em" }}>
              {country.countryNameTr}
            </div>
          </div>

          {/* Stat rail */}
          <div
            style={{
              display: "flex",
              gap: "clamp(20px, 3vw, 40px)",
              flexWrap: "wrap",
              paddingLeft: "clamp(0px, 2vw, 20px)",
            }}
          >
            <Stat label="Players" value={squad.length.toString()} accent={secondary} />
            <Divider />
            <Stat label="Avg Price" value={avgPrice.toFixed(2)} unit="SOL" mono accent="var(--gold)" />
            {top && (
              <>
                <Divider />
                <Stat label="Marquee" value={top.name.split(",")[0]} small accent="var(--volt)" />
              </>
            )}
          </div>
        </div>
      </section>

      {/* ===================== SQUAD ===================== */}
      {squad.length === 0 ? (
        <div className="empty-state rise" style={{ marginTop: 22, animationDelay: "0.08s" }}>
          <div className="num" style={{ fontSize: 44, color: "var(--faint)" }}>—</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--chalk)", marginTop: 10 }}>
            Squad not published yet
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 14, maxWidth: "44ch", marginInline: "auto" }}>
            No lineup for {country.countryNameEn} has landed on the tournament feed. Check back once
            the manager names their World Cup 2026 roster.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 30 }}>
          {POS_ORDER.map((pos, pi) => {
            const list = squad
              .filter((p) => p.position === pos)
              .sort((a, b) => a.jerseyNumber - b.jerseyNumber);
            if (list.length === 0) return null;
            const accent = POS_ACCENT[pos];
            return (
              <section
                key={pos}
                className="rise"
                style={{ marginBottom: 30, animationDelay: `${0.06 + pi * 0.06}s` }}
              >
                <div className="between" style={{ marginBottom: 14 }}>
                  <div className="row" style={{ gap: 12 }}>
                    <span
                      style={{
                        width: 4,
                        height: 22,
                        borderRadius: 2,
                        background: accent,
                        boxShadow: `0 0 12px ${accent}`,
                      }}
                    />
                    <h2
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontWeight: 900,
                        fontSize: "clamp(19px, 2.4vw, 26px)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {POS_LABEL[pos]}
                    </h2>
                  </div>
                  <span className="pill" style={{ color: accent, borderColor: accent }}>
                    {pos} · {list.length}
                  </span>
                </div>
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}
                >
                  {list.map((p) => (
                    <Row key={p.playerId} p={p} accent={accent} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <span style={{ width: 1, alignSelf: "stretch", background: "var(--line-2)" }} />;
}

function Stat({
  label,
  value,
  unit,
  accent,
  mono,
  small,
}: {
  label: string;
  value: string;
  unit?: string;
  accent: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <div
        className={mono ? "mono" : "num"}
        style={{
          color: accent,
          fontSize: small ? 20 : mono ? 26 : 40,
          fontWeight: mono || small ? 700 : 400,
          lineHeight: small ? 1.1 : 0.9,
          fontVariantNumeric: "tabular-nums",
          maxWidth: small ? 160 : undefined,
          whiteSpace: small ? "nowrap" : undefined,
          overflow: small ? "hidden" : undefined,
          textOverflow: small ? "ellipsis" : undefined,
        }}
      >
        {value}
        {unit && (
          <span className="mono" style={{ fontSize: 12, color: "var(--muted)", marginLeft: 5 }}>
            {unit}
          </span>
        )}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Row({ p, accent }: { p: Player; accent: string }) {
  const photo = usePlayerImage(p.name, p.photo);
  const isLegendary = p.rarity === "Legendary";
  return (
    <Link
      to={`/player/${p.playerId}`}
      className="panel hover-lift sweep"
      style={{
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderRadius: "var(--r)",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        {photo ? (
          <img
            className="avatar"
            src={photo}
            alt=""
            style={{ width: 42, height: 42, borderColor: isLegendary ? "var(--gold)" : "var(--line-2)" }}
          />
        ) : (
          <span
            className="num"
            style={{
              display: "grid",
              placeItems: "center",
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "var(--surface-2)",
              border: "1.5px solid var(--line-2)",
              color: accent,
              fontSize: 18,
            }}
          >
            {p.jerseyNumber}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {p.name}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            color: "var(--muted)",
            marginTop: 3,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          #{p.jerseyNumber} · {p.priceTier}
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>
          {p.priceSol}
          <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 2 }}>◎</span>
        </div>
        {isLegendary && (
          <div className="mono gold" style={{ fontSize: 8.5, letterSpacing: "0.14em", marginTop: 3 }}>
            LEGENDARY
          </div>
        )}
      </div>
    </Link>
  );
}
