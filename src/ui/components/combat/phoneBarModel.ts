// The phone action bar's model (U73 part B, D-130; DESIGN §16.5 mobile): under 760 px the turn's controls pin to the bottom
// of the viewport — Attack, Guard, Item, Flee (when it is a choice) and an Abilities button that opens the rest as a sheet.
// The model only splits the ability tiles: the basic attack is a bar button, every other tile lives in the sheet (so no
// control appears twice and every name and key stays unique). Pure.
import type { AbilityTileModel } from '../../screens/combatModel';

export interface PhoneBarModel {
  /** The basic attack (key 1); null only for a pack without one. */
  attack: AbilityTileModel | null;
  /** Every other tile, in displayed order: the sheet's content. */
  abilities: readonly AbilityTileModel[];
  /** How many of them can be used right now. */
  ready: number;
}

export function phoneBarModel(tiles: readonly AbilityTileModel[]): PhoneBarModel {
  const abilities = tiles.filter((t) => t.kind !== 'attack');
  return { attack: tiles.find((t) => t.kind === 'attack') ?? null, abilities, ready: abilities.filter((t) => t.enabled).length };
}

/** The Abilities button's accessible name: how many you can use now. */
export function abilitiesName(model: PhoneBarModel): string {
  if (model.ready === 0) return 'Abilities, none ready';
  return `Abilities, ${model.ready} ready`;
}

/** The post-Guard numbers as one line for the player panel (the Guard button is small on a phone). */
export function guardNote(previews: readonly string[]): string | null {
  return previews.length === 0 ? null : `If you Guard: ${previews.join('; ')}`;
}
