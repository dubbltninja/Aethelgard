// The companion card (DESIGN §16.5 bottom right, §4.9; D-080): the companion's HP (or "Knocked out"), statuses, the
// stance as a radio group (a free change, once per turn), the signature as a "Command" button (C) that spends your
// action and shows its cooldown, and the two free orders — focus on your target, hold and guard. Pure.
import type { ReactNode } from 'react';
import { Icon } from '../../art/Icon';
import type { CompanionCardModel } from '../../screens/combatModel';
import type { Action, Stance } from '@engine/index';
import { SegmentedBar } from './EnemyCard';
import { StatusChips } from './StatusChips';

export interface CompanionCardProps {
  companion: CompanionCardModel;
  onStance: (stance: Stance) => void;
  onCommand: (action: Action) => void;
}

export function commandName(companion: CompanionCardModel): string {
  const sig = companion.signature;
  if (sig === null) return 'C: Command';
  const bits = [`C: Command ${companion.name}: ${sig.name}`, 'uses your action'];
  if (sig.reason !== null) bits.push(sig.reason);
  return bits.join(', ');
}

export function CompanionCard({ companion, onStance, onCommand }: CompanionCardProps): ReactNode {
  const sig = companion.signature;
  const group = `stance-${companion.uid}`;
  return (
    <section className="companion-card" aria-labelledby="companion-heading" data-ko={companion.ko ? 'true' : undefined}>
      <h2 id="companion-heading" className="section-heading">
        {companion.name}
      </h2>
      {companion.ko ? <p className="companion-card__ko">Knocked out</p> : <SegmentedBar label={`${companion.name} HP`} value={companion.hp} max={companion.hpMax} kind="companion" />}
      <StatusChips statuses={companion.statuses} label={`${companion.name}: statuses`} />
      <fieldset className="companion-card__stances" disabled={companion.ko}>
        <legend>Stance (free, once a turn)</legend>
        <div className="choice-row">
          {companion.stances.map((st) => (
            <label key={st.stance} className="choice">
              <input
                type="radio"
                name={group}
                value={st.stance}
                checked={st.current}
                disabled={!st.enabled && !st.current}
                onChange={() => {
                  if (st.enabled) onStance(st.stance);
                }}
              />
              {st.label}
            </label>
          ))}
        </div>
        {companion.stanceNote === null ? null : <p className="companion-card__note">{companion.stanceNote}</p>}
      </fieldset>
      {sig === null || companion.ko ? null : (
        <button
          type="button"
          className="combat-action"
          data-action="command"
          aria-disabled={sig.enabled ? undefined : 'true'}
          aria-label={commandName(companion)}
          aria-keyshortcuts="C"
          title={sig.description}
          onClick={() => {
            if (sig.enabled && sig.action !== null) onCommand(sig.action);
          }}
        >
          <kbd className="tile__key">C</kbd>
          <Icon kind="command" size={20} />
          <span className="combat-action__text">
            <span className="combat-action__label">Command: {sig.name}</span>
            <span className="combat-action__detail">{sig.description}</span>
            <span className="combat-action__detail">{sig.reason ?? (sig.cooldown > 0 ? `Cooldown ${sig.cooldown}` : 'Uses your action')}</span>
          </span>
        </button>
      )}
      {companion.ko ? null : (
        <div className="companion-card__orders">
          <button
            type="button"
            className="btn btn--secondary"
            aria-disabled={companion.focus.enabled ? undefined : 'true'}
            onClick={() => {
              if (companion.focus.enabled && companion.focus.action !== null) onCommand(companion.focus.action);
            }}
          >
            {companion.focus.label}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            aria-disabled={companion.hold.enabled ? undefined : 'true'}
            onClick={() => {
              if (companion.hold.enabled && companion.hold.action !== null) onCommand(companion.hold.action);
            }}
          >
            Hold and guard
          </button>
        </div>
      )}
    </section>
  );
}
