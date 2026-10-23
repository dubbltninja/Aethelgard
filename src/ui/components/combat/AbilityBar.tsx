// The ability bar (DESIGN §16.5 bottom centre, §4.1; PLAN §6.6): the basic attack (key 1) and the known abilities (2–9 in
// displayed order), grouped by class branch (colour and a heading: colour is never alone), each tile with its tier
// dots (●●○○○), its cost (red when it is paid in blood), a cooldown badge and its number. A tile that cannot be used now
// stays focusable (`aria-disabled`) and says why in text, not on hover: "Needs 12 Focus", "Cooldown 2", "Not enough
// blood". The number leads the accessible name ("2: Rend, at Corrupted Shade, 6 Focus"). Pure.
import type { ReactNode } from 'react';
import { Icon, damageIcon, type IconKind } from '../../art/Icon';
import { tileName, type AbilityTileModel } from '../../screens/combatModel';

export interface AbilityBarProps {
  tiles: readonly AbilityTileModel[];
  /** The enemy the tiles act on (for the names). */
  targetName: string | null;
  onUse: (tile: AbilityTileModel) => void;
  /** More controls at the end of the bar (the Commune toggle). */
  extra?: ReactNode;
}

interface Group {
  name: string;
  index: number;
  tiles: AbilityTileModel[];
}

/** Tiles grouped by branch, in the order they come (the model sorts them). */
export function tileGroups(tiles: readonly AbilityTileModel[]): Group[] {
  const groups: Group[] = [];
  for (const tile of tiles) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.name === tile.branchName) last.tiles.push(tile);
    else groups.push({ name: tile.branchName, index: tile.branchIndex, tiles: [tile] });
  }
  return groups;
}

export const tierDots = (tier: number | null): string => (tier === null ? '' : `${'●'.repeat(tier)}${'○'.repeat(Math.max(0, 5 - tier))}`);

function tileIcon(tile: AbilityTileModel): IconKind {
  if (tile.kind === 'attack') return 'attack';
  if (tile.damageType !== null) return damageIcon(tile.damageType);
  return tile.target === 'ally' ? 'heal' : 'ability';
}

export function AbilityBar({ tiles, targetName, onUse, extra }: AbilityBarProps): ReactNode {
  return (
    <section className="ability-bar" aria-labelledby="abilities-heading">
      <h2 id="abilities-heading" className="section-heading">
        Attack and abilities
      </h2>
      <div className="ability-bar__groups">
        {tileGroups(tiles).map((group) => (
          <div key={group.name} className="ability-bar__group" role="group" aria-label={group.name} data-branch-index={group.index}>
            <p className="ability-bar__branch" aria-hidden="true">
              {group.name}
            </p>
            <ul className="ability-bar__tiles">
              {group.tiles.map((tile, i) => (
                <li key={tile.id}>
                  <button
                    type="button"
                    className="tile"
                    data-tile={tile.id}
                    data-branch-index={tile.branchIndex}
                    aria-disabled={tile.enabled ? undefined : 'true'}
                    aria-label={tileName(tile, targetName)}
                    aria-keyshortcuts={tile.key ?? undefined}
                    title={tile.description === '' ? undefined : tile.description}
                    data-autofocus={tile.kind === 'attack' && i === 0 ? '' : undefined}
                    onClick={() => {
                      if (tile.enabled) onUse(tile);
                    }}
                  >
                    {tile.key === null ? null : <kbd className="tile__key">{tile.key}</kbd>}
                    <Icon kind={tileIcon(tile)} size={20} className="tile__icon" />
                    <span className="tile__name">{tile.name}</span>
                    {tile.tier === null ? null : (
                      <span className="tile__tier" aria-hidden="true">
                        {tierDots(tile.tier)}
                      </span>
                    )}
                    {tile.cost === null ? null : <span className={tile.blood ? 'tile__cost tile__cost--blood' : 'tile__cost'}>{tile.cost}</span>}
                    {tile.cooldown > 0 ? (
                      <span className="tile__cooldown" aria-hidden="true">
                        {tile.cooldown}
                      </span>
                    ) : null}
                    {tile.reason === null ? null : <span className="tile__reason">{tile.reason}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {extra === undefined || extra === null ? null : <div className="ability-bar__extra">{extra}</div>}
      </div>
    </section>
  );
}
