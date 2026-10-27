// The Abilities panel (PLAN §6.3 `AbilityTreePanel`, DESIGN §5.1, §6.3, §16.1 "Pack"; opened from the Explore menu or K): one tab
// per branch of the class — five tiers as a ladder, each with its level, what it costs in ability points, what it does and,
// when it is shut, why — and a Character tab: unspent stat points (with what each would change), the derived numbers, and the
// camp-fire respec behind its question. Nothing is spent without a press; a shut button says why in words.
//
// Pattern (D-104): `AbilitiesPanel` holds the tab; `AbilitiesView` takes props only.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, cx } from '../components/Button';
import { Tabs, tabId, tabPanelId } from '../components/lore/Tabs';
import { ActionButtons } from '../components/items/ItemCard';
import { useContent, useGame, useLegal, useProfile, useStore } from '../store/useGame';
import {
  CHARACTER_TAB,
  abilitiesModel,
  abilityLabel,
  type AbilitiesModel,
  type AbilitiesTab,
  type AbilityRowModel,
  type BranchModel,
  type CharacterModel,
} from './abilitiesModel';
import { useRunAction, type PanelAction } from './panelAction';

const ID = 'abilities';

export interface AbilitiesViewProps {
  model: AbilitiesModel;
  tab: AbilitiesTab;
  onTab: (tab: AbilitiesTab) => void;
  onRun: (action: PanelAction) => void;
}

const STATE_TEXT = { unlocked: 'Unlocked', ready: 'Ready to unlock', locked: 'Locked' } as const;

export function AbilityNode({ row, onRun }: { row: AbilityRowModel; onRun: (a: PanelAction) => void }): ReactNode {
  return (
    <li className={cx('tree-node', `tree-node--${row.state}`)} data-state={row.state} data-ability-id={row.id}>
      <div className="tree-node__tier" aria-hidden="true">
        <span className="tree-node__dot" />
        <span className="tree-node__tiername">Tier {row.tier}</span>
        <span className="tree-node__level">Level {row.levelReq}</span>
      </div>
      <div className="tree-node__body">
        <h4 className="tree-node__name" aria-label={abilityLabel(row)}>
          {row.name}
          <span className="tree-node__state" data-state={row.state}>
            {STATE_TEXT[row.state]}
          </span>
          {row.starting ? <span className="tree-node__state">Known from the start</span> : null}
        </h4>
        <p className="tree-node__description">{row.description}</p>
        {row.flavor === null ? null : <p className="tree-node__flavor">{row.flavor}</p>}
        <ul className="fact-chips" aria-label="Details">
          {row.facts.map((f) => (
            <li key={f} className="fact-chip">
              {f}
            </li>
          ))}
        </ul>
        {row.state === 'unlocked' ? null : (
          <div className="tree-node__buy">
            <Button
              variant={row.state === 'ready' ? 'primary' : 'secondary'}
              disabled={row.unlock === null || !row.unlock.enabled}
              data-action-id={`unlock-${row.id}`}
              aria-label={`Unlock ${row.name} for ${row.costText}`}
              aria-describedby={row.lockedReason === null ? undefined : `why-${row.id}`}
              onClick={() => (row.unlock === null ? undefined : onRun(row.unlock))}
            >
              Unlock · {row.costText}
            </Button>
            {row.lockedReason === null ? null : (
              <span className="tree-node__why" id={`why-${row.id}`}>
                {row.lockedReason}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function BranchView({ branch, onRun }: { branch: BranchModel; onRun: (a: PanelAction) => void }): ReactNode {
  return (
    <div className="branch">
      <h3 className="branch__name" tabIndex={-1}>
        {branch.name}{' '}
        <span className="branch__count">
          {branch.unlocked} of {branch.total} known
        </span>
      </h3>
      <p className="branch__description">{branch.description}</p>
      <ol className="tree" aria-label={`${branch.name} abilities, by tier`}>
        {branch.rows.map((row) => (
          <AbilityNode key={row.id} row={row} onRun={onRun} />
        ))}
      </ol>
    </div>
  );
}

export function CharacterView({ character, statPoints, onRun }: { character: CharacterModel; statPoints: number; onRun: (a: PanelAction) => void }): ReactNode {
  return (
    <div className="character">
      <section aria-labelledby="char-stats">
        <h3 id="char-stats" className="branch__name" tabIndex={-1}>
          Stat points <span className="branch__count">{statPoints} to spend</span>
        </h3>
        <p className="panel-intro">One point a level. They cannot be taken back inside a loop, so choose with the numbers beside each.</p>
        <ul className="stat-rows">
          {character.stats.map((row) => (
            <li key={row.stat} className="stat-row" data-stat={row.stat}>
              <div className="stat-row__text">
                <span className="stat-row__name">{row.label}</span>
                <span className="stat-row__value">{row.value}</span>
                <span className="stat-row__effect">One more: {row.effect}</span>
              </div>
              <Button
                variant="primary"
                disabled={!row.allocate.enabled}
                data-action-id={row.allocate.id}
                aria-label={row.allocate.label}
                aria-describedby={row.allocate.enabled ? undefined : `${row.allocate.id}-why`}
                onClick={() => onRun(row.allocate)}
              >
                +1
              </Button>
              {row.allocate.enabled || row.allocate.reason === null ? null : (
                <span className="stat-row__why" id={`${row.allocate.id}-why`}>
                  {row.allocate.reason}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="char-numbers">
        <h3 id="char-numbers" className="item-card__heading">
          Your numbers
        </h3>
        <dl className="derived">
          {character.derived.map((d) => (
            <div key={d.label} className="derived__row">
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="char-respec">
        <h3 id="char-respec" className="item-card__heading">
          Rethink your path
        </h3>
        <p className="panel-intro">At a camp fire, once a day, for {character.respec.cost} gold: every ability bought this loop comes back as points.</p>
        <p className="panel-note" data-testid="respec-summary">
          {character.respec.summary}
        </p>
        <ActionButtons actions={[character.respec.action]} onRun={onRun} label="Respec" />
      </section>
    </div>
  );
}

export function AbilitiesView({ model, tab, onTab, onRun }: AbilitiesViewProps): ReactNode {
  const branch = model.branches.find((b) => b.id === tab);
  return (
    <div className="lore-panel abilities">
      <div className="panel-bar">
        <span className="panel-bar__chip">
          {model.className} · Level {model.level}
        </span>
        <span className="panel-bar__chip" aria-label={`Ability points to spend: ${model.apLabel}`}>
          {model.apLabel} to spend
        </span>
        <span className="panel-bar__chip" aria-label={`Stat points to spend: ${model.statPoints}`}>
          {model.statPoints} stat point{model.statPoints === 1 ? '' : 's'}
        </span>
      </div>
      {model.readOnly === null ? null : (
        <p className="panel-note" role="status">
          {model.readOnly}
        </p>
      )}
      <Tabs tabs={model.tabs} active={tab} label="Branches" idPrefix={ID} onSelect={onTab} />
      <div className="lore lore--single" role="tabpanel" id={tabPanelId(ID)} aria-labelledby={tabId(ID, tab)}>
        {branch !== undefined ? <BranchView branch={branch} onRun={onRun} /> : <CharacterView character={model.character} statPoints={model.statPoints} onRun={onRun} />}
      </div>
    </div>
  );
}

export function AbilitiesPanel(): ReactNode {
  const store = useStore();
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  useLegal();
  const run = useRunAction();
  const model = useMemo(() => abilitiesModel(state, content, profile, (a) => store.isLegal(a)), [state, content, profile, store]);
  const [tab, setTab] = useState<AbilitiesTab>(() => model.tabs[0]?.id ?? CHARACTER_TAB);
  const rootRef = useRef<HTMLDivElement>(null);
  const shown = model.tabs.some((t) => t.id === tab) ? tab : (model.tabs[0]?.id ?? CHARACTER_TAB);
  // A spent point can remove the button that spent it: keep focus inside the panel (the heading of what is showing).
  const spent = `${state.player.apHalf}|${state.player.statPoints}|${state.player.abilitiesUnlocked.length}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const root = rootRef.current;
    const active = document.activeElement;
    if (root !== null && (active === null || active === document.body || !root.contains(active) || (active as HTMLButtonElement).disabled === true)) {
      root.querySelector<HTMLElement>('.lore [tabindex="-1"]')?.focus();
    }
  }, [spent]);
  return (
    <div ref={rootRef}>
      <AbilitiesView model={model} tab={shown} onTab={setTab} onRun={run} />
    </div>
  );
}
