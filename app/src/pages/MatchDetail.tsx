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

  if (err) return <div className="card" style={{ marginTop: 24 }}>Match feed unreachable. <Link className="gold" to="/matches">Back to matches</Link></div>;
  if (!m) return <div className="card muted" style={{ marginTop: 24 }}>Loading match...</div>;

  const isLiveish = m.status === "live" || m.status === "halftime";
  const statusText =
    m.status === "live" ? (m.minute !== null ? `${m.minute}'` : "LIVE")
    : m.status === "halftime" ? "Half time"
    : m.status === "finished" ? "Full time"
    : "Not started";
  const kickoff = new Date(m.startTime).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ marginTop: 20 }}>
      <Link className="muted" to="/matches" style={{ fontSize: 13 }}>Back to matches</Link>

      {/* Skor basligi */}
      <div className="card" style={{ marginTop: 10, background: "var(--bg-elevated)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>{m.home.flag ?? ""}</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{m.home.name}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, fontWeight: 900 }} className={isLiveish ? "" : "gold"}>
              {m.score ? `${m.score.home} - ${m.score.away}` : "vs"}
            </div>
            <span className={isLiveish ? "" : "muted"} style={{ fontWeight: 700, fontSize: 13, color: isLiveish ? "var(--danger)" : undefined }}>
              {m.status === "live" && <span className="live-dot" style={{ marginRight: 5 }} />}{statusText}
            </span>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>{m.away.flag ?? ""}</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{m.away.name}</div>
          </div>
        </div>
        <div className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 10 }}>{m.competition} · {kickoff}</div>
      </div>

      {/* Olay akisi */}
      <h2 className="section-title" style={{ fontSize: 18, marginTop: 24 }}>Match events</h2>
      {m.events.length === 0 ? (
        <div className="card muted">No key events yet.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {m.events.map((e, i) => <EventRow key={i} e={e} nameById={nameById} homeName={m.home.name} awayName={m.away.name} />)}
        </div>
      )}

      {/* Oyuncu ratingleri (bizim fantasy puani + MVP) */}
      {m.playerRatings.length > 0 && (
        <>
          <h2 className="section-title" style={{ fontSize: 18, marginTop: 24 }}>Player ratings</h2>
          <p className="section-sub">WorldXI fantasy points from this match (ESPN + TxLINE). The top performer is the MVP.</p>
          <div className="card" style={{ padding: 0 }}>
            {m.playerRatings.map((r) => (
              <RatingRow key={r.playerId} r={r} teamName={r.team === "home" ? m.home.name : r.team === "away" ? m.away.name : ""} />
            ))}
          </div>
        </>
      )}

      {/* Dizilis */}
      <h2 className="section-title" style={{ fontSize: 18, marginTop: 24 }}>Line-ups</h2>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {m.lineups.map((lu) => (
          <div key={lu.team} className="card" style={{ padding: 0 }}>
            <div style={{ padding: "8px 12px", fontWeight: 800 }} className="gold">
              {lu.team === "home" ? m.home.name : m.away.name}
            </div>
            <LineupList players={lu.players} />
          </div>
        ))}
        {m.lineups.length === 0 && <div className="card muted">Line-ups not published yet.</div>}
      </div>
    </div>
  );
}

const EVENT_META: Record<MatchEvent["type"], { label: string; bg: string; fg: string }> = {
  goal: { label: "GOAL", bg: "var(--green)", fg: "#04120b" },
  own_goal: { label: "OG", bg: "var(--danger)", fg: "#fff" },
  yellow_card: { label: "YC", bg: "#e7c000", fg: "#1a1500" },
  red_card: { label: "RC", bg: "var(--danger)", fg: "#fff" },
  substitution: { label: "SUB", bg: "var(--bg-elevated)", fg: "var(--text-muted)" },
  penalty: { label: "PEN", bg: "var(--gold)", fg: "#1a1200" },
  halftime: { label: "HT", bg: "var(--bg-elevated)", fg: "var(--text-muted)" },
};

function EventRow({ e, nameById, homeName, awayName }: {
  e: MatchEvent; nameById: Map<number, string>; homeName: string; awayName: string;
}) {
  // Devre arasi: tam genislik ortali ayrac (oyuncu yok).
  if (e.type === "halftime") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "8px 14px", borderTop: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
        <span className="muted" style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>Half time</span>
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
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
      <span className="muted" style={{ width: 40, fontWeight: 700, flexShrink: 0 }}>{e.minute !== null ? `${e.minute}'` : "-"}</span>
      <span style={{ background: meta.bg, color: meta.fg, fontWeight: 800, fontSize: 11, padding: "2px 7px", borderRadius: 4, minWidth: 38, textAlign: "center", flexShrink: 0 }}>
        {meta.label}
      </span>
      <span style={{ flex: 1, fontSize: 14 }}>
        {who && <b>{who}</b>}
        {teamName && <span className="muted" style={{ fontSize: 12, marginLeft: who ? 8 : 0 }}>{teamName}</span>}
        {detail && <div className="muted" style={{ fontSize: 12 }}>{detail}</div>}
      </span>
    </div>
  );
}

function RatingRow({ r, teamName }: { r: MatchPlayerRating; teamName: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderTop: "1px solid var(--border)" }}>
      {r.photo
        ? <img className="avatar" src={r.photo} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        : <span className="avatar" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{r.position}</span>}
      <span style={{ flex: 1, fontSize: 14 }}>
        <b>{r.name}</b>
        <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{teamName} · {r.position}</span>
      </span>
      {r.wasMvp && <span className="pill pill-gold" style={{ fontWeight: 800 }}>MVP</span>}
      <span style={{ fontWeight: 900, minWidth: 34, textAlign: "right", color: r.rawPoints >= 0 ? "var(--gold)" : "var(--danger)" }}>{r.rawPoints}</span>
    </div>
  );
}

function LineupList({ players }: { players: Array<{ playerId: number; name: string; number: string; starter: boolean }> }) {
  const starters = players.filter((p) => p.starter);
  const bench = players.filter((p) => !p.starter);
  const Row = ({ p }: { p: { name: string; number: string } }) => (
    <div style={{ display: "flex", gap: 8, padding: "4px 12px", fontSize: 13 }}>
      <span className="muted" style={{ width: 24, textAlign: "right" }}>{p.number}</span>
      <span>{p.name}</span>
    </div>
  );
  return (
    <div style={{ paddingBottom: 8 }}>
      {starters.map((p) => <Row key={p.playerId} p={p} />)}
      {bench.length > 0 && (
        <>
          <div className="muted" style={{ padding: "8px 12px 2px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Substitutes</div>
          {bench.map((p) => <Row key={p.playerId} p={p} />)}
        </>
      )}
    </div>
  );
}
