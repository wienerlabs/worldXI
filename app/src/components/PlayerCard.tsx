import type { Country, Player } from "../lib/types";
import { UltimateCard } from "./UltimateCard";
import { tierFor, flagUrl, lastName } from "../lib/cardData";

interface PlayerCardProps {
  player: Player;
  country?: Country;
  width?: number;
}

/**
 * Adapter that renders the FUT-style {@link UltimateCard} from a Player + its Country.
 * Kept under the name `PlayerCard` with the same props so every existing call site
 * (pitch, gallery, player detail, home) upgrades to the new card with no changes.
 * Shows photo · name · position · flag · tier only.
 */
export function PlayerCard({ player, country, width = 200 }: PlayerCardProps) {
  return (
    <UltimateCard
      name={lastName(player.name)}
      tier={tierFor(player)}
      position={player.position}
      photo={player.photo}
      flagUrl={flagUrl(player.nationalTeam)}
      flagEmoji={country?.flagEmoji}
      width={width}
    />
  );
}
