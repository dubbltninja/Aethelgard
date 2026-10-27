// The enemy card (DESIGN §16.5 top row, §4.2, §4.10): the sigil, name, level and Elite/Boss tag (one button that makes it
// the target — click, tap, or ← / →), the HP bar (segmented at a boss's phase thresholds), the phase it is in, its status
// chips, its resistances once known, the intent chip and, when foreseen, the dimmed next-next chip. A hit floats its
// number for 600 ms (DESIGN §17.7) unless motion is reduced. Pure.
import type { ReactNode } from 'react';
import { CreatureSigil } from '../../art/CreatureSigil';
import { Icon, damageIcon } from '../../art/Icon';
import type { EnemyCardModel } from '../../screens/combatModel';
import { IntentChip } from './IntentChip';
import { StatusChips } from './StatusChips';

export interface HitFlash {
  amount: number;
  crit: boolean;
  /** Changes with every hit, so the number floats again. */
  nonce: number;
}

export interface SegmentedBarProps {
  label: string;
  value: number;
  max: number;
  /** Fractions of max where a boss's later phases begin (tick marks). */
  segments?: readonly number[];
  kind?: 'hp' | 'companion';
}

/** An HP bar as a `role="meter"` with its numbers and, for a boss, its phase thresholds (DESIGN §4.10). */
export function SegmentedBar({ label, value, max, segments = [], kind = 'hp' }: SegmentedBarProps): ReactNode {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`hp-bar hp-bar--${kind}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value} of ${max}`}>
      <span className="hp-bar__track" aria-hidden="true">
        <span className="hp-bar__fill" style={{ width: `${pct}%` }} />
        {segments.map((f) => (
          <span key={f} className="hp-bar__tick" style={{ left: `${Math.round(f * 1000) / 10}%` }} />
        ))}
      </span>
      <span className="hp-bar__value" aria-hidden="true">
        {value} / {max}
      </span>
    </div>
  );
}

export interface EnemyCardProps {
  enemy: EnemyCardModel;
  reducedMotion: boolean;
  /** The last hit it took this step, if any. */
  hit?: HitFlash | null;
  onSelect: (uid: string) => void;
}

export function enemySelectName(enemy: EnemyCardModel): string {
  const rank = enemy.rank === null ? '' : `, ${enemy.rank.toLowerCase()}`;
  return enemy.alive ? `Target ${enemy.name}, level ${enemy.level}${rank}` : `${enemy.name}, down`;
}

export function EnemyCard({ enemy, reducedMotion, hit = null, onSelect }: EnemyCardProps): ReactNode {
  const state = !enemy.alive ? 'ko' : hit !== null ? 'hit' : enemy.intent?.windUpThen != null ? 'telegraph' : 'idle';
  return (
    <li
      className="enemy-card"
      data-enemy={enemy.uid}
      data-selected={enemy.selected ? 'true' : undefined}
      data-alive={enemy.alive ? 'true' : 'false'}
      data-rank={enemy.rank ?? undefined}
    >
      <button
        type="button"
        className="enemy-card__select"
        aria-pressed={enemy.alive ? enemy.selected : undefined}
        aria-disabled={enemy.alive ? undefined : 'true'}
        aria-label={enemySelectName(enemy)}
        onClick={() => {
          if (enemy.alive) onSelect(enemy.uid);
        }}
      >
        <CreatureSigil creatureId={enemy.creatureId} sigil={enemy.sigil} family={enemy.family} size="md" state={state} reducedMotion={reducedMotion} />
        <span className="enemy-card__who">
          <span className="enemy-card__name">{enemy.name}</span>
          <span className="enemy-card__meta">
            Lv {enemy.level}
            {enemy.rank === null ? null : <span className={`enemy-card__rank enemy-card__rank--${enemy.rank.toLowerCase()}`}> · {enemy.rank}</span>}
          </span>
        </span>
        {enemy.selected && enemy.alive ? (
          <span className="enemy-card__target">
            <Icon kind="status_mark" size={16} />
            Target
          </span>
        ) : null}
      </button>
      <SegmentedBar label={`${enemy.name} HP`} value={enemy.hp} max={enemy.hpMax} segments={enemy.segments} />
      {enemy.phase === null ? null : (
        <p className="enemy-card__phase">
          Phase {enemy.phase.index + 1} of {enemy.phase.count}
          {enemy.phase.name === '' ? '' : `: ${enemy.phase.name}`}
        </p>
      )}
      <StatusChips statuses={enemy.statuses} label={`${enemy.name}: statuses`} />
      {enemy.resistances === null || enemy.resistances.length === 0 ? null : (
        <ul className="enemy-card__resists" aria-label={`${enemy.name}: resistances`}>
          {enemy.resistances.map((r) => (
            <li key={r.type} className={`resist resist--${r.level}`}>
              <Icon kind={damageIcon(r.type)} size={14} />
              {r.text}
            </li>
          ))}
        </ul>
      )}
      {enemy.alive ? null : <p className="enemy-card__down">Down</p>}
      {enemy.intent === null ? null : <IntentChip intent={enemy.intent} />}
      {enemy.next === null ? null : <IntentChip intent={enemy.next} withLine={false} />}
      {hit === null || reducedMotion ? null : (
        <span key={hit.nonce} className={`float-number${hit.crit ? ' float-number--crit' : ''}`} aria-hidden="true">
          −{hit.amount}
        </span>
      )}
    </li>
  );
}
