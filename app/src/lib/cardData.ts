/**
 * Helpers that map REAL WorldXI player data (players.json from the ESPN + TxLINE
 * pipeline) onto the UltimateCard visual slots. No fabricated attributes: the card's
 * "rating" and stat slots are filled from real fantasy performance (or price when a
 * player has no scored data yet).
 */
import type { Player, Tier } from "./types";

export type CardTier = "bronze" | "silver" | "gold" | "special";

/** ISO 3166-1 alpha-3 (our data) -> alpha-2 (flagcdn), incl. UK home nations. */
export const ISO3_TO_ISO2: Record<string, string> = {
  ARG: "ar", AUS: "au", AUT: "at", BEL: "be", BIH: "ba", BRA: "br", CAN: "ca",
  CHE: "ch", CIV: "ci", COD: "cd", COL: "co", CPV: "cv", CUW: "cw", CZE: "cz",
  DEU: "de", DZA: "dz", ECU: "ec", EGY: "eg", ENG: "gb-eng", ESP: "es", FRA: "fr",
  GHA: "gh", HRV: "hr", HTI: "ht", IRN: "ir", IRQ: "iq", JOR: "jo", JPN: "jp",
  KOR: "kr", MAR: "ma", MEX: "mx", NLD: "nl", NOR: "no", NZL: "nz", PAN: "pa",
  PRT: "pt", PRY: "py", QAT: "qa", SAU: "sa", SCO: "gb-sct", SEN: "sn", SWE: "se",
  TUN: "tn", TUR: "tr", URY: "uy", USA: "us", UZB: "uz", ZAF: "za",
};

/** flagcdn SVG for a national-team ISO3 code, or null if unmapped. */
export function flagUrl(iso3: string): string | null {
  const two = ISO3_TO_ISO2[iso3];
  return two ? `https://flagcdn.com/${two}.svg` : null;
}

/** Short surname for the card, e.g. "Lionel Messi" -> "Messi" (shown uppercase by the card CSS). */
export function lastName(name: string): string {
  return name.includes(",") ? name.split(",")[0].trim() : name.split(" ").slice(-1)[0];
}

/**
 * Card tier from the player's real price tier (5 levels) collapsed onto the card's
 * 4 tiers. The top tier (Legendary) becomes the holographic "special" card.
 */
export function tierFor(player: Player): CardTier {
  const t: Tier = player.priceTier;
  if (t === "Legendary") return "special";
  if (t === "Star") return "gold";
  if (t === "Solid") return "silver";
  return "bronze"; // Rotation, Budget
}
