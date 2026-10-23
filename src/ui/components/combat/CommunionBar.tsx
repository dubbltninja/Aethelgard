// The communion bar (DESIGN §4.11, §16.5; D-081): against the Unveiled Tyrant from Loop 2. Before it opens: Commune (a
// free toggle, once its Echo is held) and Listen (which opens it and costs the turn), or why neither is possible now.
// While it runs it takes the ability bar's place — Speak (each answer of the current question; the ones you cannot give
// greyed with what they need), Listen, Offer, Resist, numbered 1–9 — under the Resolve meter (eight pips, 0–8) and the
// Movement's question count; "Show abilities" swaps the bar back (striking forfeits the question). In the Resolution only
// the outcomes remain. Pure.
import type { ReactNode } from 'react';
import { Icon, type IconKind } from '../../art/Icon';
import type { Action } from '@engine/index';
import type { CommunionButton, CommunionModel } from '../../screens/combatModel';

export interface CommunionBarProps {
  model: CommunionModel;
  buttons: readonly CommunionButton[];
  /** The bar shows the abilities instead (only while communing). */
  showingAbilities: boolean;
  onAct: (action: Action) => void;
  onToggleView: () => void;
}

const GROUP_ICONS: Readonly<Record<CommunionButton['group'], IconKind>> = {
  open: 'commune',
  speak: 'commune',
  listen: 'listen',
  offer: 'offer',
  resist: 'resist',
  resolution: 'commune',
};

export function communionButtonName(b: CommunionButton): string {
  return `${b.key === null ? '' : `${b.key}: `}${b.label}${b.reason === null ? '' : `, ${b.reason}`}`;
}

/** The eight Resolve pips as one meter (DESIGN §16.5). */
export function ResolveMeter({ value, max }: { value: number; max: number }): ReactNode {
  return (
    <div className="resolve" role="meter" aria-label="Resolve" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value} of ${max}`}>
      <span className="resolve__label" aria-hidden="true">
        Resolve
      </span>
      <span className="resolve__pips" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < value ? 'resolve__pip resolve__pip--on' : 'resolve__pip'} />
        ))}
      </span>
      <span className="resolve__value" aria-hidden="true">
        {value} / {max}
      </span>
    </div>
  );
}

export function CommunionBar({ model, buttons, showingAbilities, onAct, onToggleView }: CommunionBarProps): ReactNode {
  return (
    <section className="communion" aria-labelledby="communion-heading" data-active={model.active ? 'true' : 'false'}>
      <h2 id="communion-heading" className="section-heading">
        Communion with {model.bossName}
      </h2>
      {model.active ? (
        <>
          <ResolveMeter value={model.resolve} max={model.resolveMax} />
          <p className="communion__progress">
            {model.resolution === null
              ? `Movement ${model.movement} · question ${model.questionIndex} of ${model.questionCount}${model.lies > 0 ? ` · ${model.lies} lie${model.lies === 1 ? '' : 's'} told` : ''}`
              : 'It is spared. It waits for your answer.'}
          </p>
          {model.question === null || model.resolution !== null ? null : <blockquote className="communion__question">{model.question}</blockquote>}
        </>
      ) : model.openReason === null ? null : (
        <p className="communion__closed">{model.openReason}</p>
      )}
      {model.active && showingAbilities ? null : buttons.length === 0 ? null : (
        <ul className="communion__acts">
          {buttons.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className={`tile tile--commune tile--${b.group}`}
                data-commune={b.id}
                aria-disabled={b.enabled ? undefined : 'true'}
                aria-label={communionButtonName(b)}
                aria-keyshortcuts={b.key ?? undefined}
                data-autofocus={model.active && b === buttons.find((x) => x.enabled) ? '' : undefined}
                onClick={() => {
                  if (b.enabled) onAct(b.action);
                }}
              >
                {b.key === null ? null : <kbd className="tile__key">{b.key}</kbd>}
                <Icon kind={GROUP_ICONS[b.group]} size={20} className="tile__icon" />
                <span className="tile__name">{b.label}</span>
                {b.reason === null ? null : <span className="tile__reason">{b.reason}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {model.active && model.resolution === null ? (
        <button type="button" className="btn btn--quiet communion__view" aria-pressed={showingAbilities} onClick={onToggleView}>
          {showingAbilities ? 'Show the communion' : 'Show abilities (striking forfeits the question)'}
        </button>
      ) : null}
    </section>
  );
}
