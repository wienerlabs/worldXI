import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";

export function Teams() {
  const { countries, playersByCountry } = useData();
  const sorted = useMemo(
    () => [...countries].sort((a, b) => a.countryNameEn.localeCompare(b.countryNameEn)),
    [countries]
  );

  return (
    <div style={{ marginTop: 20 }}>
      <h1 className="section-title">National Teams</h1>
      <p className="section-sub">{countries.length} teams at the 2026 World Cup. Tap a team to open its page.</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))" }}>
        {sorted.map((c) => (
          <Link key={c.isoCode} to={`/team/${c.isoCode}`} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 42, lineHeight: 1 }}>{c.flagEmoji}</div>
            <div style={{ fontWeight: 700, marginTop: 8, fontSize: 14 }}>{c.countryNameEn}</div>
            <div className="muted" style={{ fontSize: 12 }}>{c.isoCode} · {(playersByCountry.get(c.isoCode) ?? []).length} players</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
