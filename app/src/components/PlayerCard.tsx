import type { Country, Player } from "../lib/types";
import { usePlayerImage } from "../lib/photo";

const POS_FULL: Record<string, string> = { GK: "GK", DEF: "DEF", MID: "MID", FWD: "FWD" };

/** FIFA-style shield silhouette. */
const SHIELD = "polygon(0 0, 100% 0, 100% 60%, 88% 76%, 50% 100%, 12% 76%, 0 60%)";

function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#12140f" : "#ffffff";
}

function lastName(name: string): string {
  return name.includes(",") ? name.split(",")[0].trim() : name.split(" ").slice(-1)[0];
}

function initials(name: string): string {
  const clean = name.includes(",") ? name.split(",").reverse().join(" ") : name;
  const parts = clean.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PlayerCardProps {
  player: Player;
  country?: Country;
  width?: number;
}

/**
 * FIFA Ultimate Team style player card (1.jpeg format). Shield silhouette; the photo
 * covers most of the top of the card (or a large monogram); position + flag overlay
 * at the top left; name + country band at the bottom. National team colors.
 */
export function PlayerCard({ player, country, width = 200 }: PlayerCardProps) {
  const primary = country?.primaryColor ?? "#15503c";
  const secondary = country?.secondaryColor ?? "#c9a24b";
  const ink = readableOn(primary);
  const photo = usePlayerImage(player.name, player.photo);
  const glow = player.rarity === "Legendary" ? "glow-legendary" : player.rarity === "Rare" ? "glow-rare" : "";
  const surname = lastName(player.name);
  const nameFont = surname.length > 11 ? width * 0.095 : surname.length > 8 ? width * 0.115 : width * 0.135;

  return (
    <div className={`hover-lift ${glow}`} style={{ width, aspectRatio: "0.72", position: "relative", fontFamily: "inherit" }}>
      {/* Shield: outer edge (secondary) + inner background (primary) */}
      <div style={{ position: "absolute", inset: 0, background: secondary, clipPath: SHIELD }} />
      <div style={{ position: "absolute", inset: 3, clipPath: SHIELD, background: primary, overflow: "hidden" }}>
        {/* Photo: covers the top ~66% of the card (or a large monogram) */}
        {photo ? (
          <img
            src={photo}
            alt={player.name}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "66%", objectFit: "cover", objectPosition: "top center" }}
          />
        ) : (
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "66%", display: "grid", placeItems: "center", color: secondary, fontWeight: 900, fontSize: width * 0.34, opacity: 0.9 }}>
            {initials(player.name)}
          </div>
        )}
      </div>

      {/* Content overlay (inside the shield) */}
      <div style={{ position: "absolute", inset: 3, clipPath: SHIELD, display: "flex", flexDirection: "column", color: ink }}>
        {/* Top left: position + flag + country code */}
        <div style={{ position: "absolute", top: width * 0.05, left: width * 0.06, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textShadow: "0 1px 3px rgba(0,0,0,0.55)" }}>
          <div style={{ fontSize: width * 0.14, fontWeight: 900, lineHeight: 0.9, color: "#fff" }}>{POS_FULL[player.position]}</div>
          <div style={{ width: width * 0.13, height: 2, background: secondary, margin: "2px 0" }} />
          <div style={{ fontSize: width * 0.14, lineHeight: 1 }}>{country?.flagEmoji}</div>
          <div style={{ fontSize: width * 0.055, fontWeight: 800, color: "#fff", letterSpacing: 0.5 }}>{player.nationalTeam}</div>
        </div>

        {/* Bottom: name + divider + country (primary background, below the photo) */}
        <div style={{ marginTop: "auto", height: "34%", background: primary, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", paddingBottom: width * 0.1 }}>
          <div style={{ fontSize: nameFont, fontWeight: 900, textTransform: "uppercase", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "92%", letterSpacing: 0.5 }}>
            {surname}
          </div>
          <div style={{ width: "50%", height: 1.5, background: secondary, margin: "5px 0", opacity: 0.75 }} />
          <div style={{ fontSize: width * 0.06, fontWeight: 700, opacity: 0.9, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "90%" }}>
            {country?.countryNameEn ?? player.nationalTeam}
          </div>
        </div>
      </div>
    </div>
  );
}
