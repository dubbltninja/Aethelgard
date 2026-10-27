// Status chips (DESIGN §4.5 "Cue", §16.5, §17.5): one chip per status — its glyph, its name, stacks and turns left — so
// colour is never the only signal (D-035). Buffs and debuffs differ by border style as well as colour. Pure.
import type { ReactNode } from 'react';
import { Icon } from '../../art/Icon';
import type { StatusChipModel } from '../../screens/combatModel';

export interface StatusChipsProps {
  statuses: readonly StatusChipModel[];
  /** Names the list ("Corrupted Shade's statuses"). */
  label: string;
}

export function StatusChips({ statuses, label }: StatusChipsProps): ReactNode {
  if (statuses.length === 0) return null;
  return (
    <ul className="status-chips" aria-label={label}>
      {statuses.map((st) => (
        <li key={st.id} className={`status-chip status-chip--${st.kind}`} data-status={st.id}>
          <Icon kind={st.icon} size={16} />
          <span aria-hidden="true">{st.text}</span>
          <span className="sr-only">{st.label}</span>
        </li>
      ))}
    </ul>
  );
}
