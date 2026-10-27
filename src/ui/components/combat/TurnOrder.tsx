// The turn order strip (PLAN §6.3 `TurnOrderStrip`, DESIGN §4.1): this round's living combatants in initiative order,
// the one acting marked (`aria-current`), those who have acted dimmed; the round number beside it. Pure.
import type { ReactNode } from 'react';
import type { TurnEntry } from '../../screens/combatModel';

export interface TurnOrderProps {
  entries: readonly TurnEntry[];
  round: number;
}

export function TurnOrder({ entries, round }: TurnOrderProps): ReactNode {
  return (
    <div className="turn-order">
      <p className="turn-order__round">Round {round}</p>
      <ol className="turn-order__list" aria-label={`Turn order, round ${round}`}>
        {entries.map((e) => (
          <li key={e.uid} className={`turn turn--${e.kind}${e.done ? ' turn--done' : ''}`} aria-current={e.current ? 'step' : undefined}>
            {e.name}
            {e.current ? <span className="sr-only"> (acting now)</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
