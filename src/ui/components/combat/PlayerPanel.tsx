// The player panel (DESIGN §16.5 bottom left, §4.7): HP and the class resource as meters, status chips, and the three
// turn actions that are not abilities — Guard (G) with the post-Guard numbers of every hit coming at you ("Maul 14–17 →
// 7–9", shown, not hidden behind a hover), Flee (F) with its odds (or "Leave" after the Tyrant's rejection), and Item (I),
// which opens the consumables sheet. Pure.
import type { ReactNode } from 'react';
import { Icon } from '../../art/Icon';
import type { FleeModel, GuardModel, PlayerPanelModel } from '../../screens/combatModel';
import { Meter } from '../StatusBar';
import { StatusChips } from './StatusChips';
import { guardNote } from './phoneBarModel';

export interface PlayerPanelProps {
  player: PlayerPanelModel;
  guard: GuardModel;
  flee: FleeModel;
  /** Consumables usable now (the Item button opens the sheet when there are any). */
  itemCount: number;
  canItem: boolean;
  onGuard: () => void;
  onFlee: () => void;
  onItems: () => void;
  /** Phones (U73): the three actions live in the pinned bar; the panel keeps a one-line note of the Guard numbers. */
  barActions?: boolean;
}

export function guardName(guard: GuardModel): string {
  const bits = ['G: Guard, halves the next hits'];
  if (guard.previews.length > 0) bits.push(guard.previews.join('; '));
  if (guard.reason !== null) bits.push(guard.reason);
  return bits.join(', ');
}

export function fleeName(flee: FleeModel): string {
  if (flee.leave) return 'F: Leave. The loop ends.';
  return `F: Flee, ${flee.chance}% chance${flee.reason === null ? '' : `, ${flee.reason}`}`;
}

export function PlayerPanel({ player, guard, flee, itemCount, canItem, onGuard, onFlee, onItems, barActions = false }: PlayerPanelProps): ReactNode {
  return (
    <section className="player-panel" aria-labelledby="player-heading">
      <h2 id="player-heading" className="section-heading">
        {player.name}
        {player.guarding ? <span className="player-panel__guarding"> · Guarding</span> : null}
      </h2>
      <div className="player-panel__vitals">
        <Meter kind="hp" label="HP" value={player.hp} max={player.hpMax} />
        <Meter kind="mp" label={player.resourceName} value={player.mp} max={player.mpMax} />
      </div>
      <StatusChips statuses={player.statuses} label="Your statuses" />
      {barActions ? (
        guardNote(guard.previews) === null ? null : <p className="player-panel__guard-note">{guardNote(guard.previews)}</p>
      ) : (
        <div className="player-panel__actions">
          <button type="button" className="combat-action" data-action="guard" aria-disabled={guard.enabled ? undefined : 'true'} aria-label={guardName(guard)} aria-keyshortcuts="G" onClick={() => guard.enabled && onGuard()}>
            <kbd className="tile__key">G</kbd>
            <Icon kind="guard" size={20} />
            <span className="combat-action__text">
              <span className="combat-action__label">Guard</span>
              {guard.previews.length === 0 ? (
                <span className="combat-action__detail">Halves the next hits</span>
              ) : (
                guard.previews.map((p) => (
                  <span key={p} className="combat-action__detail">
                    {p}
                  </span>
                ))
              )}
            </span>
          </button>
          {flee.shown ? (
            <button type="button" className={flee.leave ? 'combat-action combat-action--danger' : 'combat-action'} data-action="flee" aria-disabled={flee.enabled ? undefined : 'true'} aria-label={fleeName(flee)} aria-keyshortcuts="F" onClick={() => flee.enabled && onFlee()}>
              <kbd className="tile__key">F</kbd>
              <Icon kind="flee" size={20} />
              <span className="combat-action__text">
                <span className="combat-action__label">{flee.leave ? 'Leave' : 'Flee'}</span>
                <span className="combat-action__detail">{flee.leave ? 'The loop ends' : flee.reason ?? `${flee.chance}% chance`}</span>
              </span>
            </button>
          ) : null}
          <button type="button" className="combat-action" data-action="items" aria-disabled={canItem ? undefined : 'true'} aria-label={`I: Item, ${itemCount === 0 ? 'nothing you can use' : `${itemCount} you can use`}`} aria-keyshortcuts="I" onClick={() => canItem && onItems()}>
            <kbd className="tile__key">I</kbd>
            <Icon kind="item" size={20} />
            <span className="combat-action__text">
              <span className="combat-action__label">Item</span>
              <span className="combat-action__detail">{itemCount === 0 ? 'Nothing to use' : `${itemCount} to use`}</span>
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
