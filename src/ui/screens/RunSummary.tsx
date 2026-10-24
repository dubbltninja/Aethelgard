// The Run Summary (DESIGN §15.3, §16.3 `screen_run_summary`; U68): what the loop that just ended came to — outcome, days, level,
// kills, quests, the Echoes it gave and the Resonance it earned. It shows at every loop's end, as the last step of the ending
// screens, and again from the Still Shore's "Run summary" button as a dialog. The view takes a model only; the model is
// `runSummaryModel`. Headings are real headings, every figure sits in a definition list beside its label, nothing here moves.
import type { ReactNode } from 'react';
import { Modal } from '../components/Modal';
import { useContent, useGame, useProfile } from '../store/useGame';
import { runSummaryModel, summarySource, type RunSummaryModel, type SummaryLine } from './runSummaryModel';

function Facts({ lines, label }: { lines: readonly SummaryLine[]; label: string }): ReactNode {
  if (lines.length === 0) return null;
  return (
    <dl className="summary__facts" aria-label={label}>
      {lines.map((l) => (
        <div key={l.key} className="summary__fact">
          <dt>{l.label}</dt>
          <dd>{l.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface RunSummaryViewProps {
  model: RunSummaryModel;
  /** Ids the section headings hang their names on (two summaries never share a page, but keep them apart anyway). */
  headingId?: string;
}

export function RunSummaryView({ model, headingId = 'summary-heading' }: RunSummaryViewProps): ReactNode {
  return (
    <article className="summary" aria-labelledby={headingId} data-outcome={model.outcome.kind}>
      <header className="summary__head">
        <p className="summary__eyebrow">Run summary</p>
        <h2 id={headingId} className="summary__title" tabIndex={-1} data-autofocus="">
          {model.heading}
        </h2>
        <p className="summary__outcome">
          <span className="summary__outcome-label">{model.outcome.label}</span>
          {model.outcome.tagline === null ? null : <span className="summary__tagline"> — {model.outcome.tagline}</span>}
        </p>
      </header>
      <div className="summary__cols">
        <section aria-labelledby={`${headingId}-facts`} className="summary__block">
          <h3 id={`${headingId}-facts`} className="summary__h">
            The loop
          </h3>
          <Facts lines={model.facts} label="The loop" />
          <Facts lines={model.choices} label="Key choices" />
        </section>
        {model.combat.length === 0 ? null : (
          <section aria-labelledby={`${headingId}-fights`} className="summary__block">
            <h3 id={`${headingId}-fights`} className="summary__h">
              Fights and coin
            </h3>
            <Facts lines={model.combat} label="Fights and coin" />
            {model.damageTop.length === 0 ? null : (
              <>
                <h4 className="summary__sub">Where the damage came from</h4>
                <ol className="summary__damage" aria-label="Damage by source">
                  {model.damageTop.map((d) => (
                    <li key={d.source}>
                      <span>{d.source}</span>
                      <span className="summary__damage-n">
                        {d.amount} ({d.share}%)
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
        )}
      </div>
      <section aria-labelledby={`${headingId}-echoes`} className="summary__block">
        <h3 id={`${headingId}-echoes`} className="summary__h">
          Echoes gained
          <span className="summary__count"> · {model.echoes.length}</span>
        </h3>
        {model.echoes.length === 0 ? (
          <p className="summary__none">No Echo came back with you.</p>
        ) : (
          <ul className="summary__echoes">
            {model.echoes.map((e) => (
              <li key={e.id} className="summary__echo">
                <span className="summary__echo-name">{e.name}</span>
                {e.codexLine === '' ? null : <span className="summary__echo-line">{e.codexLine}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {model.resonance === null ? null : (
        <section aria-labelledby={`${headingId}-resonance`} className="summary__block">
          <h3 id={`${headingId}-resonance`} className="summary__h">
            Resonance earned
          </h3>
          <p className="summary__resonance" data-testid="summary-resonance">
            <strong>{model.resonance.total}</strong>
            {model.resonance.bonus > 0 ? (
              <span>
                {' '}
                ({model.resonance.base} × {model.resonance.multiplier} for your challenge modifiers)
              </span>
            ) : null}
          </p>
        </section>
      )}
      {model.company.length === 0 && model.standings.length === 0 ? null : (
        <div className="summary__cols">
          {model.company.length === 0 ? null : (
            <section aria-labelledby={`${headingId}-company`} className="summary__block">
              <h3 id={`${headingId}-company`} className="summary__h">
                Companions
              </h3>
              <Facts lines={model.company} label="Companions" />
            </section>
          )}
          <section aria-labelledby={`${headingId}-standing`} className="summary__block">
            <h3 id={`${headingId}-standing`} className="summary__h">
              Standing
            </h3>
            <Facts lines={model.standings} label="Faction standing" />
          </section>
        </div>
      )}
      <footer className="summary__foot">
        {model.legacy === null ? null : <p>Legacy score: {model.legacy}</p>}
        <p className="summary__seed">Seed {model.seed}</p>
        <p className="summary__credit">{model.credit}</p>
      </footer>
    </article>
  );
}

/** The Still Shore's "Run summary": the profile's last record, in a dialog. */
export function RunSummaryDialog({ onClose }: { onClose: () => void }): ReactNode {
  const content = useContent();
  const profile = useProfile((p) => p);
  const state = useGame((s) => s);
  const source = summarySource(state, profile);
  return (
    <Modal title="Run summary" onClose={onClose} className="panel panel--summary" level="dialog">
      {source === null ? <p className="lore__empty">No loop has ended yet.</p> : <RunSummaryView model={runSummaryModel(source, content)} headingId="summary-dialog-heading" />}
    </Modal>
  );
}
