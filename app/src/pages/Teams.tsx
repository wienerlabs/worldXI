import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import type { Country } from "../lib/types";

export function Teams() {
  const { countries, playersByCountry, loading } = useData();

  const sorted = useMemo(
    () => [...countries].sort((a, b) => a.countryNameEn.localeCompare(b.countryNameEn)),
    [countries]
  );

  const totalPlayers = useMemo(
    () => countries.reduce((sum, c) => sum + (playersByCountry.get(c.isoCode)?.length ?? 0), 0),
    [countries, playersByCountry]
  );

  return (
    <div style={{ paddingTop: 34 }}>
      {/* ================= HEADER ================= */}
      <header
        className="between rise"
        style={{ animationDelay: "0.05s", alignItems: "flex-end" }}
      >
        <div>
          <div className="eyebrow gold">The nations · 2026 World Cup</div>
          <h1
            className="display"
            style={{ fontSize: "clamp(40px, 6.5vw, 92px)", marginTop: 16, letterSpacing: "-0.01em" }}
          >
            National <span className="gold">Teams</span>
          </h1>
          <p className="muted" style={{ maxWidth: 540, marginTop: 16, fontSize: 16, lineHeight: 1.6 }}>
            Every crest at the tournament. Tap a nation to open its full roster and draft from
            its <b className="volt" style={{ fontWeight: 800 }}>on-chain player cards</b>.
          </p>
        </div>

        <div className="row" style={{ gap: 28, flexShrink: 0 }}>
          <div className="stat" style={{ textAlign: "left" }}>
            <div className="num" style={{ fontSize: "clamp(30px,4vw,46px)", color: "var(--gold)" }}>
              {countries.length}
            </div>
            <div className="stat-label" style={{ textAlign: "left" }}>Nations</div>
          </div>
          <span style={{ width: 1, height: 46, background: "var(--line-2)" }} />
          <div className="stat" style={{ textAlign: "left" }}>
            <div className="num" style={{ fontSize: "clamp(30px,4vw,46px)", color: "var(--volt)" }}>
              {totalPlayers.toLocaleString()}
            </div>
            <div className="stat-label" style={{ textAlign: "left" }}>Players</div>
          </div>
        </div>
      </header>

      <hr className="divider" style={{ marginTop: 32 }} />

      {/* ================= GRID ================= */}
      {loading && countries.length === 0 ? (
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fill,minmax(168px,1fr))", marginTop: 28 }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="panel"
              style={{ height: 178, opacity: 0.5, display: "grid", placeItems: "center" }}
            >
              <span className="mono faint" style={{ fontSize: 12 }}>LOADING…</span>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 28 }}>
          <div className="num" style={{ fontSize: 48, color: "var(--faint)" }}>0</div>
          <div style={{ marginTop: 12, fontWeight: 800, fontSize: 18, color: "var(--chalk)" }}>
            No nations available
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
            The team registry is offline. Check back once the oracle reconnects.
          </p>
        </div>
      ) : (
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fill,minmax(168px,1fr))", marginTop: 28 }}
        >
          {sorted.map((c, i) => (
            <CrestCard
              key={c.isoCode}
              country={c}
              count={playersByCountry.get(c.isoCode)?.length ?? 0}
              delay={Math.min(i * 0.03, 0.6)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CrestCard({ country: c, count, delay }: { country: Country; count: number; delay: number }) {
  const accent = c.primaryColor || "var(--line-2)";
  const tint = c.primaryColor || "var(--volt)";

  return (
    <Link
      to={`/team/${c.isoCode}`}
      className="panel hover-lift rise"
      style={{
        animationDelay: `${delay}s`,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        borderTop: `3px solid ${accent}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Subtle national-color glow bleeding up from the crest */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "80%",
          height: 70,
          background: `radial-gradient(60% 100% at 50% 0%, ${tint}, transparent 70%)`,
          opacity: 0.16,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", fontSize: 52, lineHeight: 1, marginTop: 4 }}>
        {c.flagEmoji}
      </div>

      <div
        style={{
          position: "relative",
          fontWeight: 800,
          marginTop: 14,
          fontSize: 15,
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
        }}
      >
        {c.countryNameEn}
      </div>

      <div
        className="row"
        style={{ position: "relative", justifyContent: "center", gap: 8, marginTop: 10 }}
      >
        <span
          className="mono"
          style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--faint)" }}
        >
          {c.isoCode}
        </span>
        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--faint)" }} />
        <span className="mono" style={{ fontSize: 11, letterSpacing: "0.04em", color: "var(--muted)" }}>
          <b style={{ color: "var(--volt)", fontWeight: 700 }}>{count}</b> players
        </span>
      </div>
    </Link>
  );
}
