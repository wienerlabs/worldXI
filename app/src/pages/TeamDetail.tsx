import { Link, useParams } from "react-router-dom";
import { useData } from "../lib/data";
import { usePlayerImage } from "../lib/photo";
import type { Player, Position } from "../lib/types";

const POS_ORDER: Position[] = ["GK", "DEF", "MID", "FWD"];
const POS_LABEL: Record<Position, string> = { GK: "Goalkeepers", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };

export function TeamDetail() {
  const { iso } = useParams();
  const { countries, playersByCountry } = useData();
  const country = countries.find((c) => c.isoCode === iso);
  const squad = (iso ? playersByCountry.get(iso) : undefined) ?? [];
  const avgPrice = squad.length ? squad.reduce((s, p) => s + p.priceSol, 0) / squad.length : 0;
  const top = squad.slice().sort((a, b) => b.priceSol - a.priceSol)[0];

  if (!country) return <div className="card" style={{ marginTop: 24 }}>Team not found. <Link className="gold" to="/teams">Back to teams</Link></div>;

  return (
    <div style={{ marginTop: 20 }}>
      <Link className="muted" to="/teams" style={{ fontSize: 13 }}>Back to teams</Link>

      {/* Header */}
      <div className="card" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", borderColor: country.primaryColor ?? undefined }}>
        <div style={{ fontSize: 64, lineHeight: 1 }}>{country.flagEmoji}</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <h1 style={{ fontSize: 30 }}>{country.countryNameEn}</h1>
          <div className="muted">{country.isoCode} · World Cup 2026 squad</div>
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <Stat label="Players" value={squad.length.toString()} />
          <Stat label="Avg price" value={`${avgPrice.toFixed(2)} SOL`} />
          {top && <Stat label="Top player" value={top.name.split(",")[0]} />}
        </div>
      </div>

      {/* Squad */}
      {squad.length === 0 ? (
        <div className="card" style={{ marginTop: 18 }}>
          Squad data not available for this team yet (no lineup published on the feed).
        </div>
      ) : (
        <div style={{ marginTop: 18 }}>
          {POS_ORDER.map((pos) => {
            const list = squad.filter((p) => p.position === pos).sort((a, b) => a.jerseyNumber - b.jerseyNumber);
            if (list.length === 0) return null;
            return (
              <div key={pos} style={{ marginBottom: 18 }}>
                <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  {POS_LABEL[pos]} ({list.length})
                </div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
                  {list.map((p) => <Row key={p.playerId} p={p} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div className="gold" style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
      <div className="muted" style={{ fontSize: 11 }}>{label}</div>
    </div>
  );
}

function Row({ p }: { p: Player }) {
  const photo = usePlayerImage(p.name, p.photo);
  return (
    <Link to={`/player/${p.playerId}`} className="card hover-lift" style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
      {photo
        ? <img className="avatar" src={photo} alt="" style={{ width: 38, height: 38 }} />
        : <span className="pill pill-gold" style={{ minWidth: 30, textAlign: "center" }}>{p.jerseyNumber}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
        <div className="muted" style={{ fontSize: 11 }}>#{p.jerseyNumber} · {p.priceTier} · {p.priceSol} SOL</div>
      </div>
    </Link>
  );
}
