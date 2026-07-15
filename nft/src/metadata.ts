/**
 * Player card NFT metadata and dynamic jersey image (SVG).
 * Jersey colors come from the national team palette; otherwise the theme (gold/green) is used.
 * The image is embedded as a data URI (no external hosting required).
 */

export type Position = "GK" | "DEF" | "MID" | "FWD";
export type Rarity = "Common" | "Rare" | "Legendary";

export interface CardPlayer {
  playerId: number;
  name: string;
  nationalTeam: string;
  jerseyNumber: number;
  position: Position;
  rarity: Rarity;
}

export interface CardPerformance {
  matchesPlayed: number;
  totalPoints: number;
  mvpCount: number;
  bestSingleScore: number;
}

const THEME = { primary: "#15503C", secondary: "#BC9747", ink: "#12100A", text: "#FFFFFF" };

/** Reformats a name from "Soyad, Ad" -> "Ad Soyad" (TxLINE format). */
export function displayName(name: string): string {
  const parts = name.split(",").map((s) => s.trim());
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : name;
}

/** Dynamic jersey SVG (data URI). */
export function jerseySvg(
  primary: string | null,
  secondary: string | null,
  jersey: number,
  name: string
): string {
  const p = primary ?? THEME.primary;
  const s = secondary ?? THEME.secondary;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<rect width="400" height="400" fill="${THEME.ink}"/>
<path d="M140 90 L110 120 L130 160 L150 145 L150 320 L250 320 L250 145 L270 160 L290 120 L260 90 L230 90 Q200 115 170 90 Z" fill="${p}" stroke="${s}" stroke-width="4"/>
<text x="200" y="240" font-family="Arial Black, sans-serif" font-size="90" fill="${s}" text-anchor="middle" font-weight="900">${jersey}</text>
<text x="200" y="370" font-family="Arial, sans-serif" font-size="22" fill="${THEME.text}" text-anchor="middle">${displayName(name)}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** Card NFT metadata JSON (Metaplex standard). */
export function buildCardMetadata(
  player: CardPlayer,
  perf: CardPerformance,
  colors: { primary: string | null; secondary: string | null } = { primary: null, secondary: null }
): Record<string, unknown> {
  const image = jerseySvg(colors.primary, colors.secondary, player.jerseyNumber, player.name);
  return {
    name: `${displayName(player.name)} - ${player.nationalTeam} #${player.jerseyNumber}`,
    symbol: "WXI",
    description:
      "WorldXI living card - 2026 World Cup onchain fantasy. Performance history accumulates on chain.",
    image,
    attributes: [
      { trait_type: "player_id", value: player.playerId },
      { trait_type: "national_team", value: player.nationalTeam },
      { trait_type: "jersey_number", value: player.jerseyNumber },
      { trait_type: "position", value: player.position },
      { trait_type: "rarity", value: player.rarity },
      { trait_type: "matches_played", value: perf.matchesPlayed },
      { trait_type: "total_points", value: perf.totalPoints },
      { trait_type: "mvp_count", value: perf.mvpCount },
      { trait_type: "best_single_score", value: perf.bestSingleScore },
    ],
    properties: { category: "image", files: [{ uri: image, type: "image/svg+xml" }] },
  };
}

/** Metadata URI for minting: a URL if NFT_METADATA_BASE is set, otherwise a data URI (JSON). */
export function metadataUri(
  player: CardPlayer,
  perf: CardPerformance,
  base?: string
): string {
  if (base && base.length > 0) return `${base.replace(/\/$/, "")}/nft/${player.playerId}`;
  const json = JSON.stringify(buildCardMetadata(player, perf));
  return `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
}
