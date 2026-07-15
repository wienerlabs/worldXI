/**
 * Country helpers. Flag emoji and country names are derived programmatically from
 * the real ISO 3166 standard (the i18n-iso-countries package) - nothing hardcoded.
 * Kit colors are left null until fed from a real source.
 */
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json" with { type: "json" };
import trLocale from "i18n-iso-countries/langs/tr.json" with { type: "json" };
import type { Country } from "../domain.js";
import { logger } from "../logger.js";

countries.registerLocale(enLocale as never);
countries.registerLocale(trLocale as never);

/**
 * National team kit colors (ISO/FIFA alpha-3 -> [primary, secondary]). These are
 * real national team kit colors - used for player cards and jersey visuals.
 */
const TEAM_COLORS: Record<string, [string, string]> = {
  ARG: ["#6CACE4", "#0F3B82"], AUS: ["#FFCD00", "#00843D"], AUT: ["#ED2939", "#ffffff"],
  BEL: ["#E30613", "#111111"], BRA: ["#FEDF00", "#009739"], CAN: ["#D80621", "#ffffff"],
  CHE: ["#D52B1E", "#ffffff"], CIV: ["#FF8200", "#009543"], COL: ["#FCD116", "#00338D"],
  CZE: ["#D7141A", "#11457E"], DEU: ["#111111", "#D8B65C"], DZA: ["#006233", "#ffffff"],
  ECU: ["#FFD700", "#0A3D91"], EGY: ["#CE1126", "#111111"], ESP: ["#C60B1E", "#FFC400"],
  FRA: ["#0B2265", "#E30613"], GHA: ["#111111", "#FCD116"], HRV: ["#E32219", "#0F3B82"],
  HTI: ["#00209F", "#D21034"], IRN: ["#ffffff", "#239F40"], IRQ: ["#007A3D", "#ffffff"],
  JOR: ["#CE1126", "#111111"], JPN: ["#0B1F66", "#ffffff"], KOR: ["#C7132E", "#0A2B5E"],
  MAR: ["#C1272D", "#006233"], MEX: ["#006847", "#CE1126"], NOR: ["#BA0C2F", "#00205B"],
  NZL: ["#111111", "#ffffff"], PAN: ["#DA121A", "#072357"], PRT: ["#C8102E", "#046A38"],
  PRY: ["#D52B1E", "#0038A8"], QAT: ["#8A1538", "#ffffff"], SAU: ["#006C35", "#ffffff"],
  SEN: ["#00853F", "#FDEF42"], SWE: ["#FECC02", "#006AA7"], TUN: ["#E70013", "#ffffff"],
  TUR: ["#E30A17", "#ffffff"], URY: ["#4C9DD1", "#111111"], USA: ["#0A3161", "#B31942"],
  UZB: ["#0099B5", "#ffffff"], ZAF: ["#007A4D", "#FFB612"], BIH: ["#002F6C", "#FFCE00"],
  NLD: ["#F36C21", "#111111"], CPV: ["#003893", "#CF2027"], SCO: ["#005EB8", "#ffffff"],
  ENG: ["#ffffff", "#CE1124"], WAL: ["#C8102E", "#00843D"], NIR: ["#00843D", "#ffffff"],
  GER: ["#111111", "#D8B65C"], POR: ["#C8102E", "#046A38"], NED: ["#F36C21", "#111111"],
  COD: ["#007FFF", "#F7D618"], CUW: ["#002B7F", "#F9E814"], PAR: ["#D52B1E", "#0038A8"],
};

/** ISO alpha-2 -> flag emoji (regional indicator symbols). */
function alpha2ToFlagEmoji(alpha2: string): string {
  const base = 0x1f1e6;
  const upper = alpha2.toUpperCase();
  if (upper.length !== 2) return "";
  const first = base + (upper.charCodeAt(0) - 65);
  const second = base + (upper.charCodeAt(1) - 65);
  return String.fromCodePoint(first, second);
}

/**
 * Manual mapping for football national team names. Covers cases that
 * i18n-iso-countries cannot resolve because of naming-format differences, or that
 * are not separate countries in ISO 3166 (but are separate teams in FIFA). All are
 * real ISO/FIFA 3-letter codes.
 */
const TEAM_NAME_OVERRIDES: Record<string, string> = {
  "bosnia & herzegovina": "BIH",
  "bosnia and herzegovina": "BIH",
  "bosnia-herzegovina": "BIH", // ESPN spelling
  scotland: "SCO", // FIFA
  england: "ENG", // FIFA
  wales: "WAL", // FIFA
  "northern ireland": "NIR", // FIFA
  curacao: "CUW",
  "curaçao": "CUW", // ESPN spelling (accented)
  "congo dr": "COD",
  "dr congo": "COD",
  "ivory coast": "CIV",
  "south korea": "KOR",
  "korea republic": "KOR",
  "cape verde": "CPV",
  "united states": "USA",
  usa: "USA",
  "türkiye": "TUR", // ESPN spelling (accented)
  turkey: "TUR",
  czechia: "CZE",
  "czech republic": "CZE",
};

/** Normalizes a country string coming from TxLINE to ISO/FIFA alpha-3. */
export function toIsoAlpha3(raw: string): string | null {
  const trimmed = raw.trim();
  const override = TEAM_NAME_OVERRIDES[trimmed.toLowerCase()];
  if (override) return override;
  if (trimmed.length === 3 && countries.isValid(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }
  // If a country name was given, convert it to ISO (tries EN, then TR)
  const a2 = countries.getAlpha2Code(trimmed, "en") ?? countries.getAlpha2Code(trimmed, "tr");
  if (a2) return countries.alpha2ToAlpha3(a2) ?? null;
  return null;
}

/** Name + flag emoji for FIFA teams that are not separate countries in ISO 3166. */
const FIFA_COUNTRIES: Record<string, { nameEn: string; nameTr: string; emoji: string }> = {
  SCO: { nameEn: "Scotland", nameTr: "İskoçya", emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  ENG: { nameEn: "England", nameTr: "İngiltere", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  WAL: { nameEn: "Wales", nameTr: "Galler", emoji: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  NIR: { nameEn: "Northern Ireland", nameTr: "Kuzey İrlanda", emoji: "🇬🇧" },
};

export function buildCountry(iso3: string): Country {
  const [primary, secondary] = TEAM_COLORS[iso3] ?? [null, null];
  const fifa = FIFA_COUNTRIES[iso3];
  if (fifa) {
    return {
      countryNameTr: fifa.nameTr,
      countryNameEn: fifa.nameEn,
      isoCode: iso3,
      primaryColor: primary,
      secondaryColor: secondary,
      flagEmoji: fifa.emoji,
    };
  }
  const alpha2 = countries.alpha3ToAlpha2(iso3);
  const nameEn = countries.getName(iso3, "en") ?? iso3;
  const nameTr = countries.getName(iso3, "tr") ?? nameEn;
  const flag = alpha2 ? alpha2ToFlagEmoji(alpha2) : "";
  if (!alpha2) {
    logger.warn("ISO alpha-2 not found, flag empty", { iso3 });
  }
  return {
    countryNameTr: nameTr,
    countryNameEn: nameEn,
    isoCode: iso3,
    primaryColor: primary,
    secondaryColor: secondary,
    flagEmoji: flag,
  };
}
