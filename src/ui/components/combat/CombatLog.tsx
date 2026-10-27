// The combat log (DESIGN §16.5 centre; D-107): the fight's last 8 lines (more when expanded; Space toggles), each hit
// this session saw expandable into DESIGN §4.3's steps in plain words. It is the record, `role="log"` with
// `aria-live="off"`: the Shell's live region speaks one sentence per step. On phones it collapses to the last line. Pure.
import type { ReactNode, RefObject } from 'react';
import type { CombatLogLine } from '../../screens/combatModel';

export interface CombatLogProps {
  lines: readonly CombatLogLine[];
  expanded: boolean;
  onToggle: () => void;
  listRef?: RefObject<HTMLOListElement | null>;
}

export function CombatLog({ lines, expanded, onToggle, listRef }: CombatLogProps): ReactNode {
  return (
    <section className="combat-log" aria-labelledby="combat-log-heading" data-expanded={expanded ? 'true' : 'false'}>
      <div className="combat-log__head">
        <h2 id="combat-log-heading" className="section-heading">
          Combat log
        </h2>
        <button type="button" className="btn btn--quiet" aria-expanded={expanded} aria-controls="combat-log-list" aria-keyshortcuts="Space" onClick={onToggle}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      </div>
      <ol id="combat-log-list" className="combat-log__list" role="log" aria-live="off" aria-labelledby="combat-log-heading" tabIndex={0} ref={listRef}>
        {lines.map((line) => (
          <li key={line.key} className={`combat-log__line combat-log__line--${line.kind}`}>
            {line.explain === null ? (
              line.text
            ) : (
              <details className="combat-log__explain">
                <summary>{line.text}</summary>
                <ol className="combat-log__steps" aria-label="How the hit was worked out">
                  {line.explain.map((step, i) => (
                    <li key={`${i}:${step}`}>{step}</li>
                  ))}
                </ol>
              </details>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
