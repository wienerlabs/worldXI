import type { Country } from "../lib/types";
import { PlayerAvatar } from "./PlayerAvatar";

interface JerseyProps {
  name: string;
  photo?: string;
  country?: Country;
  captain?: boolean;
  size?: number;
}

/**
 * Compact player display for the pitch/list: real photo (or a monogram in the
 * national team color when missing) + short name + country. No jersey silhouette is used.
 */
export function Jersey({ name, photo, country, captain, size = 96 }: JerseyProps) {
  const primary = country?.primaryColor ?? "#15503c";
  const secondary = country?.secondaryColor ?? "#bc9747";
  const short = name.includes(",") ? name.split(",")[0].trim() : name.split(" ").slice(-1)[0];

  return (
    <div style={{ position: "relative", width: size, textAlign: "center" }}>
      <div style={{ position: "relative", width: size, height: size, display: "grid", placeItems: "center" }}>
        <PlayerAvatar name={name} photo={photo} primary={primary} secondary={secondary} size={size * 0.86} shape="circle" />
        {captain && (
          <span className="badge-c" style={{ position: "absolute", top: 0, right: size * 0.06 }} title="Captain">C</span>
        )}
      </div>
      <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600 }}>{short}</div>
      <div className="muted" style={{ fontSize: 10 }}>
        {country?.flagEmoji} {country?.isoCode}
      </div>
    </div>
  );
}
