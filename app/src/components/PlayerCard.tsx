import type { Country, Player } from "../lib/types";
import { UltimateCard } from "./UltimateCard";
import { tierFor, flagUrl, lastName } from "../lib/cardData";
import { useData } from "../lib/data";

interface PlayerCardProps {
  player: Player;
  country?: Country;
  width?: number;
  /** Hide the tournament points row (e.g. selection pools where score is noise). */
  hidePoints?: boolean;
  /** Exact points to show instead of the live context stats (e.g. a goal's snapshot value). */
  pointsOverride?: number;
}

/**
 * Adapter that renders the FUT-style {@link UltimateCard} from a Player + its Country.
 * Kept under the name `PlayerCard` with the same props so every existing call site
 * (pitch, gallery, player detail, home) upgrades to the new card with no changes.
 * The real tournament points come from the shared data context (oracle stats).
 */
export function PlayerCard({ player, country, width = 200, hidePoints, pointsOverride }: PlayerCardProps) {
  const { statsById } = useData();
  const points = hidePoints ? undefined : pointsOverride ?? statsById.get(player.playerId)?.totalPoints;
  return (
    <UltimateCard
      name={lastName(player.name)}
      tier={tierFor(player)}
      position={player.position}
      photo={player.photo}
      flagUrl={flagUrl(player.nationalTeam)}
      flagEmoji={country?.flagEmoji}
      points={points}
      width={width}
    />
  );
}
