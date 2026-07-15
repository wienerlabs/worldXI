/**
 * cNFT metadata generation (for oracle API /nft/:playerId). The jersey image is a
 * dynamic SVG (data URI) from national team colors; if no color, the theme (green/gold).
 * Returns JSON compliant with the Metaplex NFT metadata standard.
 */
import type { Country, PlayerUniverseEntry } from "../domain.js";

const THEME = { primary: "#15503C", secondary: "#BC9747", ink: "#12100A", text: "#FFFFFF" };

function displayName(name: string): string {
  const parts = name.split(",").map((s) => s.trim());
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : name;
}

function jerseySvg(primary: string | null, secondary: string | null, jersey: number, name: string): string {
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

/** cNFT metadata JSON for a player. `totalPoints` is the on-chain player total. */
export function playerNftMetadata(
  player: PlayerUniverseEntry,
  country: Country | undefined,
  totalPoints: number
): Record<string, unknown> {
  const image = jerseySvg(country?.primaryColor ?? null, country?.secondaryColor ?? null, player.jerseyNumber, player.name);
  return {
    name: `${displayName(player.name)} - ${player.nationalTeam} #${player.jerseyNumber}`,
    symbol: "WXI",
    description:
      "WorldXI living card - 2026 World Cup onchain fantasy. Performance history accumulates on chain.",
    image,
    external_url: "https://worldxi.app",
    attributes: [
      { trait_type: "player_id", value: player.playerId },
      { trait_type: "national_team", value: player.nationalTeam },
      { trait_type: "jersey_number", value: player.jerseyNumber },
      { trait_type: "position", value: player.position },
      { trait_type: "rarity", value: player.rarity },
      { trait_type: "tier", value: player.priceTier },
      { trait_type: "tournament_points", value: totalPoints },
    ],
    properties: { category: "image", files: [{ uri: image, type: "image/svg+xml" }] },
  };
}
