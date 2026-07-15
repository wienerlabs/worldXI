import { usePlayerImage } from "../lib/photo";

/** Builds initials (monogram) from a name: "Kylian Mbappé" -> "KM". */
function initials(name: string): string {
  const clean = name.includes(",") ? name.split(",").reverse().join(" ") : name;
  const parts = clean.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PlayerAvatarProps {
  name: string;
  photo?: string;
  primary: string;
  secondary: string;
  size: number;
  /** Round (list/pitch) or squared (card). */
  shape?: "circle" | "rounded";
}

/**
 * Player image: the real photo when available, otherwise a monogram (initials)
 * in the national team color. No jersey silhouette is used - always photo or monogram.
 */
export function PlayerAvatar({ name, photo, primary, secondary, size, shape = "circle" }: PlayerAvatarProps) {
  const img = usePlayerImage(name, photo);
  const radius = shape === "circle" ? "50%" : `${Math.round(size * 0.08)}px`;
  if (img) {
    return (
      <img
        src={img}
        alt={name}
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          objectPosition: "top center",
          borderRadius: radius,
          border: `2px solid ${secondary}`,
          background: primary,
        }}
      />
    );
  }
  return (
    <div
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        border: `2px solid ${secondary}`,
        background: primary,
        color: secondary,
        display: "grid",
        placeItems: "center",
        fontWeight: 900,
        fontSize: size * 0.38,
        letterSpacing: "0.02em",
      }}
    >
      {initials(name)}
    </div>
  );
}
