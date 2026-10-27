// The Loop Timeline (PLAN §6.3, DESIGN §10.3, §16.3 `screen_loop_timeline`; opened with L; U68): every loop the profile has lived as a
// row — which class, how it ended, how many of its days it used, the level it reached, what was learned (the Echoes it gave,
// each tagged with its group) and the choices it made — with the loop under way as the last row; below, what the profile has
// still to do for the endings it has not met. Wide: a row is a line with a day axis; narrow: each loop is a card. The
// day axis is a meter (a number in words as well as a bar), and the outcome is always written out.
//
// Pattern (D-104): `TimelinePanel` holds the hooks; `TimelineView` takes a model only.
import type { ReactNode } from 'react';
import { useContent, useGame, useProfile } from '../store/useGame';
import { timelineModel, type TimelineModel, type TimelineRow } from './timelineModel';

function Row({ row }: { row: TimelineRow }): ReactNode {
  const outcome = row.outcome === null ? 'In progress' : row.outcome.label;
  const used = Math.min(row.days, row.axisMax);
  return (
    <li className="timeline__row" data-loop={row.loop} data-outcome={row.outcome?.kind ?? 'live'} data-live={row.inProgress ? 'true' : 'false'}>
      <div className="timeline__who">
        <h3 className="timeline__loop">Loop {row.loop}</h3>
        <p className="timeline__class">
          {row.className} · level {row.level}
        </p>
      </div>
      <div className="timeline__axis">
        <p className="timeline__outcome">{outcome}</p>
        <div
          className="timeline__bar"
          role="meter"
          aria-label={`Loop ${row.loop} days`}
          aria-valuemin={0}
          aria-valuemax={row.axisMax}
          aria-valuenow={used}
          aria-valuetext={`Day ${row.days} of ${row.axisMax}`}
        >
          <span className="timeline__fill" style={{ width: `${Math.round((used / row.axisMax) * 100)}%` }} />
          <span className="timeline__marker" aria-hidden="true">
            {row.outcome === null ? '…' : row.outcome.kind === 'ending' ? '★' : row.outcome.kind === 'escape' ? '→' : '↓'}
          </span>
        </div>
        <p className="timeline__days">
          Day {row.days} of {row.axisMax}
        </p>
      </div>
      <div className="timeline__learned">
        {row.learned.length === 0 ? (
          <p className="timeline__none">Nothing learned yet.</p>
        ) : (
          <ul className="timeline__pins" aria-label={`Learned in loop ${row.loop}`}>
            {row.learned.map((e) => (
              <li key={e.id} className="timeline__pin">
                <span className="timeline__pin-name">{e.name}</span>
                {e.group === null ? null : <span className="timeline__pin-group">{e.group}</span>}
              </li>
            ))}
          </ul>
        )}
        {row.glyphs.length === 0 ? null : (
          <ul className="timeline__glyphs" aria-label={`Choices in loop ${row.loop}`}>
            {row.glyphs.map((g) => (
              <li key={g.id}>
                <span aria-hidden="true">{g.mark}</span> {g.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function TimelineView({ model }: { model: TimelineModel }): ReactNode {
  return (
    <div className="lore-panel timeline">
      <div className="panel-bar">
        <span className="panel-bar__chip">{model.endings}</span>
      </div>
      {model.empty !== null ? (
        <p className="lore__empty" data-autofocus="" tabIndex={-1}>
          {model.empty}
        </p>
      ) : (
        <ol className="timeline__rows" aria-label="Loops, oldest first">
          {model.rows.map((r) => (
            <Row key={r.key} row={r} />
          ))}
        </ol>
      )}
      {model.hints.length === 0 ? null : (
        <section aria-labelledby="timeline-hints" className="timeline__hints">
          <h3 id="timeline-hints" className="item-card__heading">
            Endings not yet met
          </h3>
          <p className="panel-intro">What this profile still lacks for them, as far as it can tell.</p>
          <ul className="threshold__hints">
            {model.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function TimelinePanel(): ReactNode {
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  return <TimelineView model={timelineModel(state, content, profile)} />;
}
