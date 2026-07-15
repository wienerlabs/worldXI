/**
 * Manual star list (for the hybrid tier). Because the game is played forward-looking,
 * price should reflect the expectation of "what a player will do next" - relying solely
 * on past fantasy points would cheapen a world star who got injured and played little
 * (exploitable). This list gives known world/top-tier players a points boost to pull them
 * into a guaranteed top tier; the rest of the ranking is based on retroactive performance.
 *
 * Names are normalize-matched against players.json (ESPN fullName); an unmatched name
 * (not in the squad / misspelled) is harmless - it gets no boost and is logged.
 * Only affects EXISTING players; no made-up players are added.
 */

/** Mega stars -> guaranteed Legendary (high boost). */
const MANUAL_LEGENDARY = [
  "Kylian Mbappé", "Lionel Messi", "Erling Haaland", "Jude Bellingham", "Harry Kane",
  "Kevin De Bruyne", "Vinícius Júnior", "Rodri", "Antoine Griezmann", "Jamal Musiala",
  "Son Heung-Min", "Virgil van Dijk", "Thibaut Courtois", "Phil Foden", "Bukayo Saka",
  "Federico Valverde", "Lautaro Martínez", "Pedri", "Bruno Fernandes", "Rafael Leão",
  "Achraf Hakimi", "Luka Modrić", "Julián Álvarez", "Florian Wirtz", "Joshua Kimmich",
  "Ousmane Dembélé", "Lamine Yamal", "Nico Williams", "Declan Rice", "Alexis Mac Allister",
];

/** Top-tier starting XI players -> guaranteed at least Star (medium boost). */
const MANUAL_STAR = [
  "Gavi", "Bernardo Silva", "João Cancelo", "Rúben Dias", "Theo Hernández",
  "Aurélien Tchouaméni", "Jules Koundé", "William Saliba", "Marcus Thuram", "Enzo Fernández",
  "Cristian Romero", "Rodrigo De Paul", "Casemiro", "Marquinhos", "Éder Militão",
  "Bruno Guimarães", "Raphinha", "Rodrygo", "Kai Havertz", "İlkay Gündoğan",
  "Antonio Rüdiger", "Leroy Sané", "Denzel Dumfries", "Frenkie de Jong", "Cody Gakpo",
  "Memphis Depay", "Romelu Lukaku", "Jérémy Doku", "Dušan Vlahović", "Andrej Kramarić",
  "Joško Gvardiol", "Mateo Kovačić", "Darwin Núñez", "Ronald Araújo", "Christian Pulisic",
  "Weston McKennie", "Takefusa Kubo", "Kaoru Mitoma", "Sofyan Amrabat", "Youssef En-Nesyri",
  "Nicolò Barella", "Federico Chiesa", "Granit Xhaka", "Manuel Akanji", "Dayot Upamecano",
  "Ibrahima Konaté", "Randal Kolo Muani", "Jonathan David", "Alphonso Davies", "Hakim Ziyech",
];

export const LEGENDARY_BOOST = 1000;
export const STAR_BOOST = 500;

/** Name normalization: simplifies accents/case/whitespace (matching across feeds). */
function norm(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const legendarySet = new Set(MANUAL_LEGENDARY.map(norm));
const starSet = new Set(MANUAL_STAR.map(norm));

/** Returns the manual star boost for a player name (0 = not manual). */
export function starBoost(name: string): number {
  const n = norm(name);
  if (legendarySet.has(n)) return LEGENDARY_BOOST;
  if (starSet.has(n)) return STAR_BOOST;
  return 0;
}

/** All names in the manual list (for match reporting). */
export const MANUAL_STAR_NAMES: readonly string[] = [...MANUAL_LEGENDARY, ...MANUAL_STAR];
