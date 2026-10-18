// The ExitBar (PLAN §6.3, DESIGN §16.3): one button per visible exit — direction, destination, watch cost and where the
// clock lands — so a traveller always knows what a step costs. An open exit travels (`move`, only when legal); a
// locked one stays focusable and says why ("I should talk to Brak before going this way."), and choosing it asks
// the engine to `examine` it, which logs the full reason with what is still missing. An infected destination carries
// the Horde's warning. Arrow keys focus the exit in their direction (`data-exit-dir`); Enter then travels. Pure.
import type { ReactNode } from 'react';
import { Icon, dirIcon } from '../art/Icon';
import type { ExitRow } from '../screens/exploreModel';
import { cx } from './Button';

export interface ExitBarProps {
  exits: readonly ExitRow[];
  onTravel: (to: string) => void;
  /** A locked exit was chosen: show its reason. */
  onInspect: (to: string) => void;
}

const ARROWS: Readonly<Record<string, string>> = { north: '↑', south: '↓', east: '→', west: '←' };

export function exitName(row: ExitRow): string {
  const head = `${row.dirLabel}: ${row.name}`;
  if (row.state === 'locked') return `${head}, locked`;
  return `${head}, ${row.cost}${row.arrive === null ? '' : `, arrive ${row.arrive}`}${row.danger === null ? '' : `. ${row.danger}`}`;
}

export function ExitBar({ exits, onTravel, onInspect }: ExitBarProps): ReactNode {
  return (
    <nav className="exit-bar" aria-labelledby="exits-heading">
      <h2 id="exits-heading" className="section-heading">
        Ways on
      </h2>
      {exits.length === 0 ? (
        <p className="exit-bar__none">There is no way on from here.</p>
      ) : (
        <ul className="exit-bar__list">
          {exits.map((row) => {
            const locked = row.state === 'locked';
            const reasonId = `exit-reason-${row.to}`;
            return (
              <li key={row.to}>
                <button
                  type="button"
                  className={cx('exit', locked && 'exit--locked', row.danger !== null && 'exit--danger', row.road && 'exit--road')}
                  data-exit-dir={row.dir}
                  data-exit-to={row.to}
                  aria-label={exitName(row)}
                  aria-describedby={locked ? reasonId : undefined}
                  aria-disabled={locked || !row.canGo ? 'true' : undefined}
                  onClick={() => (locked ? onInspect(row.to) : row.canGo ? onTravel(row.to) : undefined)}
                >
                  <span className="exit__dir">
                    <Icon kind={locked ? 'lock' : dirIcon(row.dir)} size={18} />
                    <span>{row.dirLabel}</span>
                    {ARROWS[row.dir] === undefined ? null : (
                      <kbd className="exit__key" aria-hidden="true">
                        {ARROWS[row.dir]}
                      </kbd>
                    )}
                  </span>
                  <span className="exit__name">{row.name}</span>
                  {row.label === null ? null : <span className="exit__label">{row.label}</span>}
                  {locked ? (
                    <span className="exit__reason" id={reasonId}>
                      {row.reason}
                    </span>
                  ) : (
                    <span className="exit__meta">
                      {row.cost}
                      {row.arrive === null ? '' : ` → ${row.arrive}`}
                    </span>
                  )}
                  {row.danger === null ? null : (
                    <span className="exit__danger">
                      <Icon kind="danger" size={16} />
                      {row.danger}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
