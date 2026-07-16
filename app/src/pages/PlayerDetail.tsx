import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPlayerDetail, type PlayerDetail as Detail } from "../lib/api";
import { useData } from "../lib/data";
import { PlayerCard } from "../components/PlayerCard";

export function PlayerDetail() {
  const { id } = useParams();
  const pid = Number(id);
  const { playerById, countryByIso } = useData();
  const player = playerById.get(pid);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [noApi, setNoApi] = useState(false);

  useEffect(() => {
    fetchPlayerDetail(pid).then(setDetail).catch(() => setNoApi(true));
  }, [pid]);

  if (!player)
    return (
      <div style={{ marginTop: 64 }}>
        <div className="empty-state" style={{ maxWidth: 520, margin: "0 auto" }}>
          <div className="num" style={{ fontSize: 64, color: "var(--line-2)", lineHeight: 0.9 }}>404</div>
          <div className="eyebrow" style={{ justifyContent: "center", marginTop: 18 }}>Card vault</div>
          <h2 className="section-title" style={{ fontSize: 24, marginTop: 10 }}>Player not found</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            No collectible matches this ID. It may have been retired from the set.
          </p>
        </div>
      </div>
    );

  const country = countryByIso.get(player.nationalTeam);
  const primary = country?.primaryColor ?? "var(--gold)";
  const totalGoals = detail?.history.reduce((n, h) => n + (h.stat.goals as number), 0) ?? 0;
  const totalAssists = detail?.history.reduce((n, h) => n + (h.stat.assists as number), 0) ?? 0;

  const stats: Array<{ label: string; value: string | number; accent?: string }> = detail
    ? [
        { label: "Points", value: detail.totalPoints, accent: "var(--volt)" },
        { label: "Rank", value: detail.rank ? `#${detail.rank}` : "—", accent: "var(--gold)" },
        { label: "Goals", value: totalGoals, accent: "var(--gold)" },
        { label: "Assists", value: totalAssists },
        { label: "Matches", value: detail.matchesPlayed },
        { label: "MVP", value: detail.mvpCount, accent: "var(--gold)" },
        { label: "Avg", value: detail.average.toFixed(1) },
      ]
    : [];

  return (
    <div style={{ marginTop: 26 }}>
      {/* ================= HERO / DOSSIER ================= */}
      <section
        className="panel panel-notch sweep rise"
        style={{
          padding: "clamp(22px, 3vw, 34px)",
          display: "grid",
          gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)",
          gap: "clamp(22px, 3vw, 40px)",
          alignItems: "center",
          borderTop: `2px solid ${primary}`,
        }}
      >
        {/* Backdrop shirt-number */}
        <div
          aria-hidden
          className="num"
          style={{
            position: "absolute",
            top: -14,
            right: 8,
            fontSize: "clamp(120px, 18vw, 240px)",
            color: "rgba(243,241,231,0.035)",
            lineHeight: 0.8,
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 0,
          }}
        >
          {player.jerseyNumber}
        </div>

        <div style={{ position: "relative", zIndex: 1, justifySelf: "center" }}>
          <PlayerCard player={player} country={country} width={230} />
        </div>

        <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ color: primary }}>Card dossier · #{player.playerId}</div>
          <h1
            style={{
              fontWeight: 900,
              fontSize: "clamp(34px, 5.4vw, 62px)",
              letterSpacing: "-0.03em",
              lineHeight: 0.98,
              marginTop: 14,
            }}
          >
            {player.name}
          </h1>

          <div className="row" style={{ marginTop: 16, flexWrap: "wrap", gap: 10 }}>
            <span className="chip" style={{ gap: 8 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{country?.flagEmoji}</span>
              <span>{country?.countryNameEn ?? player.nationalTeam}</span>
            </span>
            <span className="pill pill-volt">{player.position}</span>
            <span className="pill">#{player.jerseyNumber}</span>
            {player.rarity === "Legendary" ? (
              <span className="pill pill-gold">{player.rarity}</span>
            ) : (
              <span className="pill">{player.rarity}</span>
            )}
          </div>

          <div className="row" style={{ marginTop: 18, gap: 22, flexWrap: "wrap" }}>
            <div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Tier</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginTop: 3 }}>{player.priceTier}</div>
            </div>
            <span style={{ width: 1, alignSelf: "stretch", background: "var(--line-2)" }} />
            <div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Price</div>
              <div className="num gold" style={{ fontSize: 26, marginTop: 3 }}>
                {player.priceSol}<span className="mono" style={{ fontSize: 13, marginLeft: 4 }}>SOL</span>
              </div>
            </div>
          </div>

          {/* Stat HUD */}
          {detail ? (
            <div
              style={{
                marginTop: 24,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))",
                gap: 1,
                background: "var(--line)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r)",
                overflow: "hidden",
              }}
            >
              {stats.map((s, i) => (
                <StatBlock key={s.label} label={s.label} value={s.value} accent={s.accent} delay={0.05 * i} />
              ))}
            </div>
          ) : noApi ? (
            <div
              className="mono"
              style={{ marginTop: 24, fontSize: 12.5, color: "var(--faint)", border: "1px dashed var(--line-2)", borderRadius: "var(--r)", padding: "14px 16px" }}
            >
              Season totals unavailable — oracle offline.
            </div>
          ) : (
            <div
              className="mono"
              style={{ marginTop: 24, fontSize: 12.5, color: "var(--muted)", padding: "14px 16px", border: "1px solid var(--line)", borderRadius: "var(--r)", background: "var(--surface-2)" }}
            >
              Loading career totals…
            </div>
          )}
        </div>
      </section>

      {/* ================= MATCH-BY-MATCH ================= */}
      <section className="section">
        <div className="section-head">
          <div className="eyebrow gold">Broadcast log</div>
          <h2 className="section-title" style={{ marginTop: 12, fontSize: "clamp(22px, 2.8vw, 32px)" }}>Match-by-match</h2>
          <p className="section-sub">Every appearance with a full breakdown, and the tournament totals at the bottom.</p>
        </div>

        {noApi && (
          <div className="empty-state">
            <div className="live" style={{ justifyContent: "center", color: "var(--muted)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--faint)" }} />
              Feed offline
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginTop: 14 }}>No live breakdowns yet</h3>
            <p className="muted" style={{ marginTop: 6 }}>Start the oracle API to load this player's live match log.</p>
          </div>
        )}

        {!detail && !noApi && (
          <div className="panel" style={{ padding: "40px 24px", textAlign: "center" }}>
            <span className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>Loading match breakdowns…</span>
          </div>
        )}

        {detail && (() => {
          const g = (o: Record<string, unknown>, k: string) => (o[k] as number) ?? 0;
          const sum = (k: string, from: "stat" | "breakdown") =>
            detail.history.reduce((n, h) => n + g(from === "stat" ? h.stat : h.breakdown, k), 0);
          const totMin = sum("minutesPlayed", "stat");
          const totGoals = sum("goals", "stat");
          const totAssists = sum("assists", "stat");
          const totYc = sum("yellowCards", "stat");
          const totRc = sum("redCards", "stat");
          const totOg = sum("ownGoals", "stat");
          const totCs = detail.history.filter((h) => g(h.breakdown, "cleanSheet") > 0).length;
          const totMvp = detail.history.filter((h) => h.wasMvp).length;
          const totPts = detail.history.reduce((n, h) => n + h.rawPoints, 0);
          return (
            <div className="panel panel-flush rise">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>MD</th><th title="Minutes">Min</th><th title="Goals">G</th><th title="Assists">A</th>
                      <th title="Clean sheet">CS</th><th title="Yellow cards">YC</th><th title="Red cards">RC</th>
                      <th title="Own goals">OG</th><th title="Man of the match">MVP</th><th style={{ textAlign: "right" }}>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.history.map((h) => (
                      <tr key={h.matchday}>
                        <td className="mono muted">MD{h.matchday}</td>
                        <td className="mono">{g(h.stat, "minutesPlayed")}'</td>
                        <td className="num" style={{ fontSize: 17, color: g(h.stat, "goals") > 0 ? "var(--gold)" : "var(--faint)" }}>{g(h.stat, "goals") || "–"}</td>
                        <td className="num" style={{ fontSize: 17, color: g(h.stat, "assists") > 0 ? "var(--chalk)" : "var(--faint)" }}>{g(h.stat, "assists") || "–"}</td>
                        <td>{g(h.breakdown, "cleanSheet") > 0 ? <span className="pill pill-volt">CS</span> : <span className="faint">–</span>}</td>
                        <td>{g(h.stat, "yellowCards") ? <span style={{ display: "inline-block", width: 12, height: 16, borderRadius: 2, background: "var(--gold)" }} title="Yellow" /> : <span className="faint">–</span>}</td>
                        <td>{g(h.stat, "redCards") ? <span style={{ display: "inline-block", width: 12, height: 16, borderRadius: 2, background: "var(--live)" }} title="Red" /> : <span className="faint">–</span>}</td>
                        <td className="mono">{g(h.stat, "ownGoals") || <span className="faint">–</span>}</td>
                        <td>{h.wasMvp ? <span className="pill pill-gold">MVP</span> : <span className="faint">–</span>}</td>
                        <td className="num" style={{ fontSize: 19, textAlign: "right", color: h.rawPoints > 0 ? "var(--volt)" : h.rawPoints < 0 ? "var(--danger)" : "var(--muted)" }}>{h.rawPoints}</td>
                      </tr>
                    ))}
                    {detail.history.length === 0 && (
                      <tr><td colSpan={10} className="muted" style={{ textAlign: "center", padding: "34px 16px" }}>No match data yet.</td></tr>
                    )}
                  </tbody>
                  {detail.history.length > 0 && (
                    <tfoot>
                      <tr style={{ borderTop: "2px solid var(--line-2)", background: "rgba(198,242,78,0.04)" }}>
                        <td className="mono gold" style={{ fontWeight: 800, letterSpacing: "0.08em" }}>TOTAL</td>
                        <td className="mono">{totMin}'</td>
                        <td className="num gold" style={{ fontSize: 18 }}>{totGoals}</td>
                        <td className="num" style={{ fontSize: 18 }}>{totAssists}</td>
                        <td className="num" style={{ fontSize: 18 }}>{totCs}</td>
                        <td className="num" style={{ fontSize: 18 }}>{totYc}</td>
                        <td className="num" style={{ fontSize: 18 }}>{totRc}</td>
                        <td className="num" style={{ fontSize: 18 }}>{totOg}</td>
                        <td className="num" style={{ fontSize: 18 }}>{totMvp}</td>
                        <td className="num volt" style={{ fontSize: 22, textAlign: "right" }}>{totPts}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          );
        })()}
      </section>
    </div>
  );
}

function StatBlock({ label, value, accent, delay }: { label: string; value: string | number; accent?: string; delay: number }) {
  return (
    <div
      className="rise"
      style={{ background: "var(--surface)", padding: "14px 10px", textAlign: "center", animationDelay: `${delay}s` }}
    >
      <div className="num" style={{ fontSize: 30, color: accent ?? "var(--chalk)", lineHeight: 0.9 }}>{value}</div>
      <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginTop: 7 }}>{label}</div>
    </div>
  );
}
