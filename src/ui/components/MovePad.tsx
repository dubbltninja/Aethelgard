// The movement pad (U84a, D-147; replaces U64's ExitBar row): an arrow-key style pad whose every direction has a fixed slot,
// so North is always top-centre, West left, East right and South bottom-centre, whatever the place's exits are. The four
// corners hold the rest: Up and Down share the top-left, In and Out the top-right, Path is bottom-left and Portal
// bottom-right. A direction with no way on is an empty slot (hidden from screen readers, no tab stop), so nothing reflows
// when the exits change. The centre marks where you stand.
//
// Each button keeps U64's contract: its accessible name is the full sentence ("North: Crumbling Archway, 1 watch, arrive
// Day"), the visible text is the direction, the watch cost and the destination truncated to the fixed button size (the
// full name on hover, `title`). A locked exit stays focusable, carries its reason as the button's description, and asks
// the engine to `examine` it; an infected destination is hatched and named with the Horde's warning. Arrow keys and WASD
// focus the slot in their direction (`data-exit-dir`); Enter then travels. Pure.
import type { ReactNode } from 'react';
import { Icon, dirIcon } from '../art/Icon';
import type { ExitRow } from '../screens/exploreModel';
import type { Dir } from '@schema/location';
import { cx } from './Button';

export interface MovePadProps {
  exits: readonly ExitRow[];
  onTravel: (to: string) => void;
  /** A locked exit was chosen: show its reason. */
  onInspect: (to: string) => void;
}

/** The pad's cells in reading order; a corner cell may hold two half slots. */
export const PAD_CELLS: readonly (readonly Dir[] | 'here')[] = [
  ['up', 'down'],
  ['north'],
  ['in', 'out'],
  ['west'],
  'here',
  ['east'],
  ['path'],
  ['south'],
  ['portal'],
];

/** Every slot the pad draws, always (layout.spec measures each). */
export const PAD_SLOTS: readonly Dir[] = PAD_CELLS.flatMap((cell) => (cell === 'here' ? [] : cell));

const LABELS: Readonly<Record<Dir, string>> = {
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
  up: 'Up',
  down: 'Down',
  in: 'In',
  out: 'Out',
  portal: 'Portal',
  path: 'Path',
};

export function exitName(row: ExitRow): string {
  const head = `${row.dirLabel}: ${row.name}${row.threat == null ? '' : `, ${row.threat}`}`;
  if (row.state === 'locked') return `${head}, locked`;
  return `${head}, ${row.cost}${row.arrive === null ? '' : `, arrive ${row.arrive}`}${row.danger === null ? '' : `. ${row.danger}`}`;
}

/** The hover text: the name plus the reason or the exit's own words. */
function hoverText(row: ExitRow): string {
  const bits = [exitName(row)];
  if (row.reason !== null) bits.push(row.reason);
  else if (row.label !== null) bits.push(row.label);
  return bits.join(' — ');
}

function PadButton({ row, half, onTravel, onInspect }: { row: ExitRow; half: boolean; onTravel: (to: string) => void; onInspect: (to: string) => void }): ReactNode {
  const locked = row.state === 'locked';
  const reasonId = `exit-reason-${row.to}`;
  return (
    <button
      type="button"
      className={cx('pad__btn', half && 'pad__btn--half', locked && 'pad__btn--locked', row.danger !== null && 'pad__btn--danger', row.threat != null && 'pad__btn--threat', row.road && 'pad__btn--road')}
      data-threat={row.threat ?? undefined}
      data-exit-dir={row.dir}
      data-exit-to={row.to}
      aria-label={exitName(row)}
      aria-describedby={locked ? reasonId : undefined}
      aria-disabled={locked || !row.canGo ? 'true' : undefined}
      title={hoverText(row)}
      onClick={() => (locked ? onInspect(row.to) : row.canGo ? onTravel(row.to) : undefined)}
    >
      <span className="pad__head">
        <Icon kind={locked ? 'lock' : dirIcon(row.dir)} size={16} />
        <span className="pad__dir">{row.dirLabel}</span>
        {half ? null : (
          <span className="pad__cost">
            {row.danger === null ? null : <Icon kind="danger" size={14} className="pad__danger" />}
            {locked ? (
              'Locked'
            ) : (
              <>
                <Icon kind="hourglass" size={12} />
                {row.watches}
              </>
            )}
          </span>
        )}
      </span>
      {/* U84: the danger cue takes the name's line (the button never grows; the full name is in the title and the label) */}
      <span className="pad__name">{row.threat == null ? row.name : <strong className="pad__threat">{row.threat}</strong>}</span>
      {locked ? (
        <span className="sr-only" id={reasonId}>
          {row.reason}
        </span>
      ) : null}
    </button>
  );
}

export function MovePad({ exits, onTravel, onInspect }: MovePadProps): ReactNode {
  const byDir = new Map<Dir, ExitRow>();
  for (const row of exits) if (!byDir.has(row.dir)) byDir.set(row.dir, row);
  return (
    <nav className="pad" aria-labelledby="exits-heading" data-exits={exits.length}>
      <h2 id="exits-heading" className="sr-only">
        Ways on
      </h2>
      {exits.length === 0 ? <p className="sr-only">There is no way on from here.</p> : null}
      <div className="pad__grid">
        {PAD_CELLS.map((cell) =>
          cell === 'here' ? (
            <div key="here" className="pad__here" aria-hidden="true">
              <Icon kind="center" size={20} />
              <span>Here</span>
            </div>
          ) : (
            <div key={cell.join('-')} className={cx('pad__cell', cell.length > 1 && 'pad__cell--pair')} data-pad-cell={cell.join('-')}>
              {cell.map((dir) => {
                const row = byDir.get(dir);
                return (
                  <div key={dir} className="pad__slot" data-pad-slot={dir} data-open={row === undefined ? undefined : 'true'}>
                    {row === undefined ? (
                      <span className="pad__empty" aria-hidden="true" title={`No way ${dir === 'in' || dir === 'out' ? dir : `${LABELS[dir].toLowerCase()}`}`}>
                        <Icon kind={dirIcon(dir)} size={14} />
                      </span>
                    ) : (
                      <PadButton row={row} half={cell.length > 1} onTravel={onTravel} onInspect={onInspect} />
                    )}
                  </div>
                );
              })}
            </div>
          ),
        )}
      </div>
    </nav>
  );
}
