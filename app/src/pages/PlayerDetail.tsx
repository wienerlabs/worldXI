import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPlayerDetail, type PlayerDetail as Detail } from "../lib/api";
import { useData } from "../lib/data";
import { Jersey } from "../components/Jersey";

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

  if (!player) return <div className="card" style={{ marginTop: 24 }}>Player not found.</div>;
  const country = countryByIso.get(player.nationalTeam);
  const totalGoals = detail?.history.reduce((n, h) => n + (h.stat.goals as number), 0) ?? 0;
  const totalAssists = detail?.history.reduce((n, h) => n + (h.stat.assists as number), 0) ?? 0;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
        <Jersey name={player.name} photo={player.photo} country={country} size={110} />
        <div>
          <h1 className="section-title" style={{ fontSize: 28 }}>{player.name}</h1>
          <div className="muted">
            {country?.flagEmoji} {country?.countryNameEn} · <span className="pill">{player.position}</span> · {player.priceTier} · {player.priceSol} SOL
          </div>
          {detail && (
            <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
              <Stat label="Points" value={detail.totalPoints} />
              <Stat label="Rank" value={detail.rank ? `#${detail.rank}` : "-"} />
              <Stat label="Goals" value={totalGoals} />
              <Stat label="Assists" value={totalAssists} />
              <Stat label="Matches" value={detail.matchesPlayed} />
              <Stat label="MVP" value={detail.mvpCount} />
              <Stat label="Avg" value={detail.average.toFixed(1)} />
            </div>
          )}
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 30, fontSize: 20 }}>Match-by-match statistics</h2>
      <p className="section-sub">Every appearance with a full breakdown, and the tournament totals at the bottom.</p>
      {noApi && <div className="card" style={{ marginTop: 10 }}>Start the oracle API to load live match breakdowns.</div>}
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
          <div className="card" style={{ padding: 0, marginTop: 12, overflowX: "auto" }}>
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
                    <td className="muted">{h.matchday}</td>
                    <td>{g(h.stat, "minutesPlayed")}'</td>
                    <td style={{ fontWeight: g(h.stat, "goals") > 0 ? 800 : 400, color: g(h.stat, "goals") > 0 ? "var(--gold)" : undefined }}>{g(h.stat, "goals") || "-"}</td>
                    <td>{g(h.stat, "assists") || "-"}</td>
                    <td>{g(h.breakdown, "cleanSheet") > 0 ? "Yes" : "-"}</td>
                    <td>{g(h.stat, "yellowCards") ? "Y" : "-"}</td>
                    <td>{g(h.stat, "redCards") ? "R" : "-"}</td>
                    <td>{g(h.stat, "ownGoals") || "-"}</td>
                    <td>{h.wasMvp ? "MVP" : "-"}</td>
                    <td style={{ fontWeight: 800, textAlign: "right" }}>{h.rawPoints}</td>
                  </tr>
                ))}
                {detail.history.length === 0 && <tr><td colSpan={10} className="muted">No match data yet.</td></tr>}
              </tbody>
              {detail.history.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border-strong)", fontWeight: 800 }}>
                    <td className="gold">TOTAL</td>
                    <td>{totMin}'</td>
                    <td className="gold">{totGoals}</td>
                    <td>{totAssists}</td>
                    <td>{totCs}</td>
                    <td>{totYc}</td>
                    <td>{totRc}</td>
                    <td>{totOg}</td>
                    <td>{totMvp}</td>
                    <td className="gold" style={{ textAlign: "right" }}>{totPts}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        );
      })()}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="gold" style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}
