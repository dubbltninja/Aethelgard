// The intent chip (DESIGN §4.2 Display, §16.5): the damage-type glyph (or an effect glyph), the move's name, its effect
// tags, the projected range ("—" for a non-damaging move) and the target ("→ you", "ALL"); a hidden intent is a "?" chip
// with the type glyph only; the dimmed second chip is the move after it (Foresight, Hunter's Eye). The telegraph line
// reads under it. One sentence names it for screen readers ("Intent: Maul, physical, 14 to 17 damage, targeting you").
import type { ReactNode } from 'react';
import { Icon } from '../../art/Icon';
import type { IntentChipModel } from '../../screens/combatModel';

export interface IntentChipProps {
  intent: IntentChipModel;
  /** Show the telegraph line under the chip (the enemy card does; the Guard preview does not). */
  withLine?: boolean;
}

export function IntentChip({ intent, withLine = true }: IntentChipProps): ReactNode {
  const cls = ['intent', intent.hidden ? 'intent--hidden' : '', intent.next ? 'intent--next' : '', intent.question ? 'intent--question' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} data-intent={intent.moveId} data-damage-type={intent.damageType ?? undefined}>
      <p className="intent__chip" role="img" aria-label={intent.label}>
        {intent.next ? (
          <span className="intent__then" aria-hidden="true">
            Then
          </span>
        ) : null}
        <Icon kind={intent.glyph} size={18} className="intent__glyph" />
        <span className="intent__name" aria-hidden="true">
          {intent.name}
        </span>
        {intent.hidden || intent.next ? null : (
          <>
            {intent.range === '' ? null : (
              <span className="intent__range" aria-hidden="true">
                {intent.range}
              </span>
            )}
            <span className="intent__target" aria-hidden="true">
              {intent.targetKind === 'all' ? 'ALL' : `→ ${intent.target}`}
            </span>
          </>
        )}
      </p>
      {intent.hidden || intent.next || intent.tags.length === 0 ? null : (
        <p className="intent__tags" aria-hidden="true">
          {intent.tags.join(' · ')}
          {intent.windUpThen === null ? '' : ` → ${intent.windUpThen}`}
        </p>
      )}
      {withLine && !intent.hidden && intent.line !== '' ? <p className="intent__line">{intent.line}</p> : null}
    </div>
  );
}
