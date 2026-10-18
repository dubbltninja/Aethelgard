// The ActionBar (PLAN §6.3, §6.6): every location-level explore action that is legal now — Look around, Take
// everything, Gather, Short/Full rest (with the clock preview "until Day 8 · Dawn"), Wait, Go back, interactables,
// field abilities, the merchant and forge panels (once they exist), the portal, and the camp's loop-enders. Buttons are
// numbered in displayed order and `1`–`9` press them (the number leads the accessible name: "1: Look around, …").
// Actions that end the loop confirm first (the container asks). Pure.
import type { ReactNode } from 'react';
import { Icon } from '../art/Icon';
import type { ActionRow } from '../screens/exploreModel';
import { cx } from './Button';

export interface ActionBarProps {
  actions: readonly ActionRow[];
  onRun: (row: ActionRow) => void;
}

/** The number key of the `index`-th button (1–9), or null past the ninth. */
export const actionKey = (index: number): string | null => (index < 9 ? String(index + 1) : null);

/** "1: Short rest, 1 watch → Day" — the number first, as PLAN §6.6 has screen readers announce it. */
export function actionName(row: ActionRow, key: string | null): string {
  return `${key === null ? '' : `${key}: `}${row.label}${row.detail === null ? '' : `, ${row.detail}`}`;
}

export function ActionBar({ actions, onRun }: ActionBarProps): ReactNode {
  return (
    <section className="action-bar" aria-labelledby="actions-heading">
      <h2 id="actions-heading" className="section-heading">
        What you can do
      </h2>
      <ul className="action-bar__list">
        {actions.map((row, i) => {
          const key = actionKey(i);
          return (
            <li key={row.id}>
              <button
                type="button"
                className={cx('action', row.danger === true && 'action--danger')}
                data-action-id={row.id}
                aria-label={actionName(row, key)}
                aria-keyshortcuts={key ?? undefined}
                onClick={() => onRun(row)}
              >
                {key === null ? null : <kbd className="action__key">{key}</kbd>}
                <Icon kind={row.icon} size={20} />
                <span className="action__text">
                  <span className="action__label">{row.label}</span>
                  {row.detail === null ? null : <span className="action__detail">{row.detail}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
