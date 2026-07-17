import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchMatchDetail, type MatchDetailData, type MatchEvent, type MatchPlayerRating } from "../lib/api";

/** Tek mac detayi: skor basligi + canli olay akisi + dizilis. Veri TxLINE canli
 *  feed'inden (oracle /match/:id). Canli maclarda 6sn'de yenilenir. */
export function MatchDetail() {
  const { fixtureId } = useParams();
  const id = Number(fixtureId);
  const [m, setM] = useState<MatchDetailData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    // A non-numeric route param would request /match/NaN; short-circuit to the
    // empty/not-found state instead.
    if (!Number.isFinite(id)) { setErr(true); return; }
    let alive = true;
    const load = () =>
      fetchMatchDetail(id)
        .then((d) => { if (alive) { setM(d); setErr(false); } })
        .catch(() => { if (alive) setErr(true); });
    load();
    const t = setInterval(load, 6000);
    return () => { alive = false; clearInterval(t); };
  }, [id]);

  // playerId (TxLINE normativeId) -> isim: dizilisten kur (olaylarda isim gostermek icin).
  const nameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const lu of m?.lineups ?? []) for (const p of lu.players) map.set(p.playerId, p.name);
    return map;
  }, [m]);

  const backLink = (
    <Link className="mono" to="/matches" style={{ fontSize: 12, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
      ← Back to matches
    </Link>
  );

  if (err) {
    return (
      <div style={{ marginTop: 20 }}>
        {backLink}
        <div className="empty-state rise" style={{ marginTop: 16 }}>
          <div className="live" style={{ justifyContent: "center", color: "var(--danger)", marginBottom: 10 }}>
            <span className="live-dot" style={{ background: "var(--danger)" }} /> Feed offline
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--chalk)", textTransform: "uppercase", letterSpacing: "0.01em" }}>
            Match feed unreachable
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>The live oracle isn't answering right now. Try again in a moment.</p>
          <Link className="btn btn-ghost btn-sm" to="/matches" style={{ marginTop: 18 }}>Back to matches</Link>
        </div>
      </div>
    );
  }

  if (!m) {
    return (
      <div style={{ marginTop: 20 }}>
        {backLink}
        <div className="panel rise" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span className="live-dot" style={{ background: "var(--muted)" }} />
          <span className="mono muted" style={{ fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading match…</span>
        </div>
      </div>
    );
  }

  const isLiveish = m.status === "live" || m.status === "halftime";
  const isLive = m.status === "live";
  const statusText =
    m.status === "live" ? (m.minute !== null ? `${m.minute}'` : "LIVE")
    : m.status === "halftime" ? "Half time"
    : m.status === "finished" ? "Full time"
    : "Not started";
  const kickoff = new Date(m.startTime).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ marginTop: 20 }}>
      {backLink}

      {/* ===================== BROADCAST SCOREBOARD ===================== */}
      <section
        className="panel panel-notch sweep rise"
        style={{
          marginTop: 12,
          padding: "clamp(22px, 4vw, 40px) clamp(18px, 4vw, 44px)",
          background: "linear-gradient(160deg, rgba(31,157,99,0.10), rgba(232,189,84,0.05) 60%, transparent)",
          borderColor: "var(--line-2)",
        }}
      >
        <div className="between" style={{ marginBottom: 18 }}>
          <div className="eyebrow">{m.competition}</div>
          {isLive ? (
            <span className="live"><span className="live-dot" /> Live</span>
          ) : (
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)" }}>
              {m.status === "finished" ? "Full time" : "Kickoff"}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "clamp(10px, 3vw, 30px)" }}>
          {/* Home */}
          <TeamBlock flag={m.home.flag} name={m.home.name} align="right" />

          {/* Scoreline */}
          <div style={{ textAlign: "center", minWidth: "clamp(120px, 26vw, 210px)" }}>
            <div
              className="num"
              style={{
                fontSize: "clamp(52px, 12vw, 104px)",
                color: isLiveish ? "var(--chalk)" : "var(--gold)",
                textShadow: isLiveish ? "0 0 40px rgba(198,242,78,0.14)" : "0 0 40px rgba(232,189,84,0.18)",
                letterSpacing: "0.02em",
                lineHeight: 0.86,
              }}
            >
              {m.score ? `${m.score.home}–${m.score.away}` : "VS"}
            </div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
              {isLive ? (
                <span className="pill pill-live" style={{ fontSize: 12, padding: "5px 12px" }}>
                  <span className="live-dot" style={{ width: 6, height: 6, background: "#fff" }} /> {statusText}
                </span>
              ) : m.status === "halftime" ? (
                <span className="pill pill-live" style={{ fontSize: 12, padding: "5px 12px", background: "var(--gold-deep)", color: "var(--chalk)" }}>{statusText}</span>
              ) : (
                <span className="pill" style={{ fontSize: 12, padding: "5px 12px" }}>{statusText}</span>
              )}
            </div>
          </div>

          {/* Away */}
          <TeamBlock flag={m.away.flag} name={m.away.name} align="left" />
        </div>

        <div className="divider" style={{ margin: "22px 0 0" }} />
        <div className="mono" style={{ textAlign: "center", fontSize: 11.5, marginTop: 14, color: "var(--muted)", letterSpacing: "0.08em" }}>
          {m.competition} · {kickoff}
        </div>
      </section>

      {/* ===================== EVENT FEED ===================== */}
      <section className="section" style={{ marginTop: 44 }}>
        <div className="section-head">
          <div className="eyebrow">Live feed</div>
          <h2 className="section-title" style={{ marginTop: 10, fontSize: "clamp(22px, 3vw, 32px)" }}>Match events</h2>
        </div>
        {m.events.length === 0 ? (
          <div className="empty-state">
            <div className="mono" style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)" }}>Awaiting first whistle</div>
            <div style={{ marginTop: 8, fontSize: 15 }}>No key events yet.</div>
          </div>
        ) : (
          <div className="panel panel-flush" style={{ padding: "6px 0" }}>
            {m.events.map((e, i) => (
              <EventRow key={i} e={e} nameById={nameById} homeName={m.home.name} awayName={m.away.name} last={i === m.events.length - 1} />
            ))}
          </div>
        )}
      </section>

      {/* ===================== PLAYER RATINGS ===================== */}
      {m.playerRatings.length > 0 && (
        <section className="section" style={{ marginTop: 44 }}>
          <div className="section-head">
            <div className="eyebrow gold">Fantasy points</div>
            <h2 className="section-title" style={{ marginTop: 10, fontSize: "clamp(22px, 3vw, 32px)" }}>Player ratings</h2>
            <p className="section-sub">WorldXI fantasy points from this match (ESPN + TxLINE). The top performer is the MVP.</p>
          </div>
          <div className="panel panel-flush">
            {m.playerRatings.map((r) => (
              <RatingRow key={r.playerId} r={r} teamName={r.team === "home" ? m.home.name : r.team === "away" ? m.away.name : ""} />
            ))}
          </div>
        </section>
      )}

      {/* ===================== LINE-UPS ===================== */}
      <section className="section" style={{ marginTop: 44, marginBottom: 20 }}>
        <div className="section-head">
          <div className="eyebrow">On the teamsheet</div>
          <h2 className="section-title" style={{ marginTop: 10, fontSize: "clamp(22px, 3vw, 32px)" }}>Line-ups</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          {m.lineups.map((lu) => (
            <div key={lu.team} className="panel panel-flush hover-lift">
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,0.015)" }}>
                <span style={{ fontSize: 22 }}>{(lu.team === "home" ? m.home.flag : m.away.flag) ?? ""}</span>
                <span className="gold" style={{ fontWeight: 900, fontSize: 15, letterSpacing: "-0.01em" }}>
                  {lu.team === "home" ? m.home.name : m.away.name}
                </span>
              </div>
              <LineupList players={lu.players} />
            </div>
          ))}
          {m.lineups.length === 0 && (
            <div className="empty-state">
              <div className="mono" style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)" }}>Teamsheet pending</div>
              <div style={{ marginTop: 8, fontSize: 15 }}>Line-ups not published yet.</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TeamBlock({ flag, name, align }: { flag: string | null; name: string; align: "left" | "right" }) {
  return (
    <div style={{ textAlign: align, display: "flex", flexDirection: "column", alignItems: align === "right" ? "flex-end" : "flex-start", gap: 8 }}>
      <div style={{ fontSize: "clamp(38px, 8vw, 56px)", lineHeight: 1, filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.4))" }}>{flag ?? ""}</div>
      <div style={{ fontWeight: 900, fontSize: "clamp(15px, 2.4vw, 22px)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{name}</div>
    </div>
  );
}

/** Restyled broadcast HUD markers — theme tokens only.
 *  goal = pitch/volt, own_goal = danger, yellow/red cards, sub = muted, pen = gold, halftime = divider. */
const EVENT_META: Record<MatchEvent["type"], { label: string; bg: string; fg: string }> = {
  goal: { label: "GOAL", bg: "var(--volt)", fg: "var(--on-volt)" },
  own_goal: { label: "OG", bg: "var(--danger)", fg: "#fff" },
  yellow_card: { label: "YC", bg: "#e7c000", fg: "#1a1500" },
  red_card: { label: "RC", bg: "var(--live)", fg: "#fff" },
  substitution: { label: "SUB", bg: "var(--surface-3)", fg: "var(--muted)" },
  penalty: { label: "PEN", bg: "var(--gold)", fg: "var(--on-gold)" },
  halftime: { label: "HT", bg: "var(--surface-3)", fg: "var(--muted)" },
};

function EventRow({ e, nameById, homeName, awayName, last }: {
  e: MatchEvent; nameById: Map<number, string>; homeName: string; awayName: string; last?: boolean;
}) {
  // Devre arasi: tam genislik ortali ayrac (oyuncu yok).
  if (e.type === "halftime") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "12px 16px", margin: "4px 0" }}>
        <span style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
        <span className="mono" style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--gold)" }}>Half time</span>
        <span style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
      </div>
    );
  }
  const meta = EVENT_META[e.type];
  const byId = (id: number | null): string | null => (id ? nameById.get(id) ?? null : null);
  // Isim oncelik: ESPN primary/secondary (dogrudan isim) > TxLINE id->dizilis ismi.
  let who = "";
  let detail = "";
  if (e.type === "substitution") {
    const inN = e.primary ?? byId(e.playerInId) ?? "?";
    const outN = e.secondary ?? byId(e.playerOutId) ?? "?";
    who = inN;
    detail = `out: ${outN}`;
  } else {
    who = e.primary ?? byId(e.playerId) ?? "";
    if ((e.type === "goal" || e.type === "penalty") && e.secondary) detail = `assist: ${e.secondary}`;
  }
  const teamName = e.team === "home" ? homeName : e.team === "away" ? awayName : "";
  const isGoal = e.type === "goal" || e.type === "penalty";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 16px", position: "relative" }}>
      {/* minute + timeline spine */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, alignSelf: "stretch" }}>
        <span className="num" style={{ fontSize: 17, color: "var(--chalk-2)", minWidth: 32, textAlign: "center" }}>
          {e.minute !== null ? e.minute : "–"}
        </span>
        {!last && <span style={{ flex: 1, width: 2, background: "var(--line)", marginTop: 6, borderRadius: 2 }} />}
      </div>
      {/* marker */}
      <span
        style={{
          background: meta.bg, color: meta.fg, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 10.5,
          letterSpacing: "0.04em", padding: "4px 8px", borderRadius: 6, minWidth: 42, textAlign: "center", flexShrink: 0,
          boxShadow: isGoal ? "0 4px 14px -4px rgba(198,242,78,0.45)" : undefined, marginTop: 1,
        }}
      >
        {meta.label}
      </span>
      {/* text */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        {who && <span style={{ fontWeight: 800, fontSize: 14.5 }}>{who}</span>}
        {teamName && <span className="mono muted" style={{ fontSize: 11, marginLeft: who ? 9 : 0, letterSpacing: "0.04em" }}>{teamName}</span>}
        {detail && <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{detail}</div>}
      </div>
    </div>
  );
}

function RatingRow({ r, teamName }: { r: MatchPlayerRating; teamName: string }) {
  const positive = r.rawPoints >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 16px", borderTop: "1px solid var(--line)" }}>
      {r.photo
        ? <img className="avatar" src={r.photo} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        : <span className="avatar" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{r.position}</span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 14.5, fontWeight: 800 }}>{r.name}</b>
        <span className="mono muted" style={{ fontSize: 11, marginLeft: 9, letterSpacing: "0.03em" }}>{teamName} · {r.position}</span>
      </span>
      {r.wasMvp && <span className="pill pill-gold" style={{ fontWeight: 700 }}>MVP</span>}
      <span
        className="num"
        style={{ fontSize: 24, minWidth: 40, textAlign: "right", color: positive ? "var(--gold)" : "var(--danger)" }}
      >
        {r.rawPoints}
      </span>
    </div>
  );
}

function LineupList({ players }: { players: Array<{ playerId: number; name: string; number: string; starter: boolean }> }) {
  const starters = players.filter((p) => p.starter);
  const bench = players.filter((p) => !p.starter);
  const Row = ({ p }: { p: { name: string; number: string } }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 16px", fontSize: 13.5 }}>
      <span className="mono" style={{ width: 26, textAlign: "right", color: "var(--faint)", fontSize: 12, flexShrink: 0 }}>{p.number}</span>
      <span style={{ fontWeight: 600 }}>{p.name}</span>
    </div>
  );
  return (
    <div style={{ padding: "8px 0 12px" }}>
      {starters.map((p) => <Row key={p.playerId} p={p} />)}
      {bench.length > 0 && (
        <>
          <div className="eyebrow" style={{ padding: "12px 16px 6px", fontSize: 10 }}>Substitutes</div>
          {bench.map((p) => <Row key={p.playerId} p={p} />)}
        </>
      )}
    </div>
  );
}
