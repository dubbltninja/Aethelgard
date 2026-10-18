// Class Select (PLAN §6.3, DESIGN §16.3 `screen_class_select`): the Title's sub-view before the first `newGame`.
// Five class cards as a native radio group (arrow keys and taps select; a horizontal swipe row under 760 px), the
// selected class's detail (fantasy, stats, resource, kit, the three branches), the name, an optional seed, Begin.
//
// Pattern for later screens: a container (hooks, store, keys) renders a pure view (props only, no hooks), so tests
// render the view and call its handlers without a DOM.
import { useMemo, useReducer, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { useHotkeys } from '../hooks/useHotkeys';
import { useContent, useProfile, useStore } from '../store/useGame';
import { ClassSigil } from './ClassSigil';
import {
  NAME_MAX,
  beginArgs,
  classOptions,
  classSelectReducer,
  initialClassSelect,
  type ClassOption,
  type ClassSelectState,
} from './classOptions';

export interface ClassSelectViewProps {
  options: readonly ClassOption[];
  state: ClassSelectState;
  onSelect: (classId: string) => void;
  onName: (value: string) => void;
  onSeed: (value: string) => void;
  onBegin: () => void;
  onBack: () => void;
}

export function ClassSelectView({ options, state, onSelect, onName, onSeed, onBegin, onBack }: ClassSelectViewProps): ReactNode {
  const selected = options.find((o) => o.id === state.selected) ?? options[0];
  return (
    <section className="screen screen--class" data-screen="class-select" aria-labelledby="class-heading">
      <header className="class-select__header">
        <Button variant="quiet" className="back-button" onClick={onBack}>
          Back to title
        </Button>
        <h1 id="class-heading" className="class-select__heading">
          Choose who walks into the Breach
        </h1>
        <p className="class-select__lede">Your class sets your body, the resource you fight with and the three branches you grow along.</p>
      </header>
      <form
        className="class-select"
        aria-label="New game"
        onSubmit={(event) => {
          event.preventDefault();
          onBegin();
        }}
      >
        <fieldset className="class-cards">
          <legend className="sr-only">Class</legend>
          <div className="class-cards__track">
            {options.map((option) => (
              <ClassCard key={option.id} option={option} selected={option.id === selected?.id} onSelect={onSelect} />
            ))}
          </div>
        </fieldset>
        {selected === undefined ? null : <ClassDetail option={selected} />}
        <div className="class-select__start">
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="field__input"
              type="text"
              name="name"
              autoComplete="off"
              spellCheck="false"
              maxLength={NAME_MAX}
              placeholder="Wayfinder"
              value={state.name}
              onChange={(event) => onName(event.target.value)}
            />
          </label>
          <details className="advanced">
            <summary>Seed (optional)</summary>
            <label className="field">
              <span className="field__label">Seed</span>
              <input
                className="field__input"
                type="text"
                name="seed"
                autoComplete="off"
                spellCheck="false"
                value={state.seed}
                onChange={(event) => onSeed(event.target.value)}
                aria-describedby="seed-hint"
              />
            </label>
            <p id="seed-hint" className="field__hint">
              The same seed and class give the same world and the same rolls. Leave it empty for a new one.
            </p>
          </details>
          <Button type="submit" variant="primary" className="begin-button">
            {selected === undefined ? 'Begin' : `Begin as ${selected.name}`}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ClassCard({ option, selected, onSelect }: { option: ClassOption; selected: boolean; onSelect: (id: string) => void }): ReactNode {
  return (
    <label className="class-card" data-selected={selected ? 'true' : 'false'} data-class={option.id}>
      <input
        className="class-card__radio"
        type="radio"
        name="class"
        value={option.id}
        checked={selected}
        onChange={() => onSelect(option.id)}
        aria-label={option.name}
        aria-describedby={`class-${option.id}-title`}
        data-autofocus={selected ? '' : undefined}
      />
      <span className="class-card__sigil">
        <ClassSigil classId={option.id} />
      </span>
      <span className="class-card__name">{option.name}</span>
      <span className="class-card__title" id={`class-${option.id}-title`}>
        {option.title}
      </span>
      <span className="class-card__vitals">
        <span className="vital vital--hp">{option.hp} HP</span>
        <span className="vital vital--mp">
          {option.mp} {option.resourceName}
        </span>
      </span>
      {option.mastery === null ? null : (
        <span className="class-card__mastery">
          Played {option.mastery.loopsPlayed} {option.mastery.loopsPlayed === 1 ? 'loop' : 'loops'}, best level {option.mastery.bestLevel}
        </span>
      )}
    </label>
  );
}

function kitText(line: ClassOption['kit'][number]): string {
  if (line.equipped) return `${line.name} (equipped)`;
  return line.count > 1 ? `${line.name} ×${line.count}` : line.name;
}

export function ClassDetail({ option }: { option: ClassOption }): ReactNode {
  return (
    <section className="class-detail" aria-labelledby="class-detail-heading" data-class={option.id}>
      <div className="class-detail__lead">
        <h2 id="class-detail-heading" className="class-detail__name">
          {option.name}
        </h2>
        <p className="class-detail__title">{option.title}</p>
        <p className="class-detail__fantasy">{option.description}</p>
        <p className="class-detail__intro">{option.intro}</p>
      </div>
      <div className="class-detail__facts">
        <section aria-labelledby="class-stats-heading">
          <h3 id="class-stats-heading">At level {option.level}</h3>
          <dl className="stat-grid">
            <div>
              <dt>HP</dt>
              <dd>{option.hp}</dd>
            </div>
            <div>
              <dt>{option.resourceName}</dt>
              <dd>{option.mp}</dd>
            </div>
            <div>
              <dt>Strength</dt>
              <dd>{option.stats.strength}</dd>
            </div>
            <div>
              <dt>Magic</dt>
              <dd>{option.stats.magic}</dd>
            </div>
            <div>
              <dt>Agility</dt>
              <dd>{option.stats.agility}</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="class-resource-heading">
          <h3 id="class-resource-heading">{option.resourceName}</h3>
          <ul className="plain-list">
            {option.resourceRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="class-kit-heading">
          <h3 id="class-kit-heading">Starting kit</h3>
          <ul className="plain-list">
            {option.kit.map((line) => (
              <li key={line.itemId}>{kitText(line)}</li>
            ))}
            <li>{option.gold} gold</li>
          </ul>
        </section>
      </div>
      <section className="class-tree" aria-labelledby="class-tree-heading">
        <h3 id="class-tree-heading">Branches</h3>
        <div className="class-tree__branches">
          {option.branches.map((branch) => (
            <section key={branch.id} className="branch" aria-labelledby={`branch-${branch.id}`}>
              <h4 id={`branch-${branch.id}`} className="branch__name">
                {branch.name}
              </h4>
              <p className="branch__text">{branch.description}</p>
              {branch.abilities.length === 0 ? null : (
                <ol className="branch__abilities">
                  {branch.abilities.map((ability) => (
                    <li key={ability.id} className="branch__ability">
                      <span className="tier" aria-label={`Tier ${ability.tier}:`}>
                        {ability.tier}
                      </span>{' '}
                      {ability.name}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      </section>
    </section>
  );
}

export function ClassSelectScreen({ onBack }: { onBack: () => void }): ReactNode {
  const store = useStore();
  const content = useContent();
  const profile = useProfile((p) => p);
  const options = useMemo(() => classOptions(content, profile), [content, profile]);
  const [state, act] = useReducer(classSelectReducer, options, (o: ClassOption[]) => initialClassSelect(o, profile.lastClassId));
  const order = options.map((o) => o.id);
  const begin = (): void => {
    const args = beginArgs(state);
    const result = store.shell.newGame(args.name, args.classId, args.seed);
    if (!result.ok) store.notify(`The run could not start: ${result.error}.`, 'error');
  };
  useHotkeys(
    {
      arrowleft: { run: () => act({ type: 'step', by: -1, order }), label: 'Previous class', group: 'list' },
      arrowright: { run: () => act({ type: 'step', by: 1, order }), label: 'Next class', group: 'list' },
      enter: { run: begin, label: 'Begin', group: 'action' },
      escape: { run: onBack, label: 'Back to title', group: 'system' },
    },
    { scope: 'Class select' },
  );
  return (
    <ClassSelectView
      options={options}
      state={state}
      onSelect={(classId) => act({ type: 'select', classId })}
      onName={(value) => act({ type: 'name', value })}
      onSeed={(value) => act({ type: 'seed', value })}
      onBegin={begin}
      onBack={onBack}
    />
  );
}
