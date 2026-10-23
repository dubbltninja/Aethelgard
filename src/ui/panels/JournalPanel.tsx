// The Quest journal (PLAN §6.3 `QuestJournalPanel`, DESIGN §16.3 `screen_quest_log`; hotkey Q): tabs for the quests under
// way, the finished ones and the failed ones, each a list on the left and the chosen quest on the right (on a phone the
// list, then the quest with a Back button) — its blurb, the current stage's journal text, its objectives (done or still
// to do, with the place a hint names), the stages already passed, and what it pays; and a People tab with where the
// Wayfinder stands with each faction (tier, its line, the way to the next tier) and each companion (loyalty and what the
// next milestone brings). Read-only: it never dispatches. D-107's quest rings on the map read the same objectives.
//
// Pattern (D-104): `JournalPanel` holds the tab and the selection; `JournalView` takes props only.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../art/Icon';
import { cx } from '../components/Button';
import { MasterDetail, type LoreView } from '../components/lore/MasterDetail';
import { Tabs, tabId, tabPanelId } from '../components/lore/Tabs';
import { useListNav } from '../hooks/useListNav';
import { useContent, useGame } from '../store/useGame';
import {
  EMPTY_TEXT,
  firstTab,
  journalModel,
  questLine,
  rowsOf,
  type CompanionStanding,
  type FactionStanding,
  type JournalModel,
  type JournalTab,
  type ObjectiveRow,
  type QuestRowModel,
} from './journalModel';

export interface JournalViewProps {
  model: JournalModel;
  tab: JournalTab;
  selectedId: string | null;
  view: LoreView;
  onTab: (tab: JournalTab) => void;
  onSelect: (id: string) => void;
  onBack: () => void;
}

const ID = 'journal';

function Objective({ o }: { o: ObjectiveRow }): ReactNode {
  return (
    <li className={cx('objective', o.done && 'objective--done')} data-done={o.done ? 'true' : 'false'}>
      <Icon kind={o.done ? 'check' : 'unknown'} size={16} />
      <span className="objective__text">
        <span className="sr-only">{o.done ? 'Done: ' : 'To do: '}</span>
        {o.text}
        {o.optional ? <span className="objective__note"> (optional)</span> : null}
        {o.where === null ? null : <span className="objective__where"> — near {o.where}</span>}
      </span>
    </li>
  );
}

export function QuestDetail({ row }: { row: QuestRowModel }): ReactNode {
  return (
    <div className="quest" data-status={row.status}>
      <h3 className="quest__name" id={`quest-${row.id}`} tabIndex={-1}>
        {row.name}
      </h3>
      <p className="quest__meta">
        {[row.category, row.giver === null ? null : `from ${row.giver}`, row.days === '' ? null : row.days].filter((x) => x !== null && x !== '').join(' · ')}
      </p>
      <p className="quest__blurb">{row.description}</p>
      {row.status === 'active' ? (
        <section className="quest__now" aria-labelledby={`now-${row.id}`}>
          <h4 id={`now-${row.id}`} className="quest__heading">
            Where it stands
          </h4>
          <p>{row.journal}</p>
        </section>
      ) : (
        <section className="quest__now" aria-labelledby={`now-${row.id}`}>
          <h4 id={`now-${row.id}`} className="quest__heading">
            {row.status === 'completed' ? 'How it ended' : 'How it failed'}
          </h4>
          <p>{row.journal}</p>
        </section>
      )}
      {row.objectives.length === 0 ? null : (
        <section aria-labelledby={`obj-${row.id}`}>
          <h4 id={`obj-${row.id}`} className="quest__heading">
            Objectives{row.progress === null ? '' : ` · ${row.progress}`}
          </h4>
          <ul className="objectives">
            {row.objectives.map((o) => (
              <Objective key={o.id} o={o} />
            ))}
          </ul>
        </section>
      )}
      {row.rewardsLabel === null || row.rewards.length === 0 ? null : (
        <section aria-labelledby={`reward-${row.id}`}>
          <h4 id={`reward-${row.id}`} className="quest__heading">
            {row.rewardsLabel}
          </h4>
          <ul className="quest__rewards">
            {row.rewards.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}
      {row.history.length === 0 ? null : (
        <details className="quest__history">
          <summary>Earlier in this quest ({row.history.length})</summary>
          <ol>
            {row.history.map((h) => (
              <li key={h.stage}>{h.journal}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function StandingMeter({ label, value, min, max, text, percent }: { label: string; value: number; min: number; max: number; text: string; percent: number }): ReactNode {
  return (
    <div className="standing-meter" role="meter" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text}>
      <span className="meter__track" aria-hidden="true">
        <span className="meter__fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="standing-meter__value" aria-hidden="true">
        {text}
      </span>
    </div>
  );
}

function FactionRow({ f }: { f: FactionStanding }): ReactNode {
  return (
    <li className="standing" data-tier={f.tier}>
      <h4 className="standing__name">{f.name}</h4>
      <StandingMeter label={`${f.name} standing`} value={f.value} min={-100} max={100} text={`${f.tierLabel} · ${f.value}`} percent={f.percent} />
      <p className="standing__line">{f.line}</p>
      {f.next === null ? null : <p className="standing__next">Next: {f.next}</p>}
    </li>
  );
}

function CompanionRow({ c }: { c: CompanionStanding }): ReactNode {
  return (
    <li className="standing" data-state={c.state}>
      <h4 className="standing__name">
        {c.name} <span className="standing__state">{c.state}</span>
      </h4>
      <StandingMeter label={`${c.name} loyalty`} value={c.loyalty} min={0} max={100} text={`Loyalty ${c.loyalty}`} percent={c.loyalty} />
      {c.next === null ? <p className="standing__next">A full bond.</p> : <p className="standing__next">{c.next}</p>}
    </li>
  );
}

export function StandingView({ model }: { model: JournalModel }): ReactNode {
  return (
    <div className="standings">
      <section aria-labelledby="standing-factions">
        <h3 id="standing-factions" className="section-heading">
          Factions
        </h3>
        <ul className="standing-list">
          {model.factions.map((f) => (
            <FactionRow key={f.id} f={f} />
          ))}
        </ul>
      </section>
      <section aria-labelledby="standing-companions">
        <h3 id="standing-companions" className="section-heading">
          Companions
        </h3>
        {model.companions.length === 0 ? (
          <p className="lore__empty">No one travels with you yet.</p>
        ) : (
          <ul className="standing-list">
            {model.companions.map((c) => (
              <CompanionRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function JournalView({ model, tab, selectedId, view, onTab, onSelect, onBack }: JournalViewProps): ReactNode {
  const rows = rowsOf(model, tab);
  const chosen = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;
  return (
    <div className="lore-panel">
      <Tabs tabs={model.tabs} active={tab} label="Journal sections" idPrefix={ID} onSelect={onTab} />
      {tab === 'standing' ? (
        <div className="lore lore--single" role="tabpanel" id={tabPanelId(ID)} aria-labelledby={tabId(ID, tab)}>
          <StandingView model={model} />
        </div>
      ) : rows.length === 0 ? (
        <div className="lore lore--single" role="tabpanel" id={tabPanelId(ID)} aria-labelledby={tabId(ID, tab)}>
          <p className="lore__empty">{EMPTY_TEXT[tab]}</p>
        </div>
      ) : (
        <MasterDetail
          view={view}
          listLabel="Quests"
          backLabel="Back to quests"
          onBack={onBack}
          panel={{ id: tabPanelId(ID), labelledBy: tabId(ID, tab) }}
          list={
            <ul className="lore-list">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={cx('lore-item', chosen?.id === row.id && 'lore-item--chosen')}
                    data-list-item=""
                    data-quest-id={row.id}
                    aria-current={chosen?.id === row.id ? 'true' : undefined}
                    aria-label={questLine(row)}
                    onClick={() => onSelect(row.id)}
                  >
                    <span className="lore-item__name">{row.name}</span>
                    <span className="lore-item__meta">{row.progress ?? row.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          }
          detail={chosen === null ? null : <QuestDetail row={chosen} />}
        />
      )}
    </div>
  );
}

export function JournalPanel(): ReactNode {
  const content = useContent();
  const state = useGame((s) => s);
  const model = useMemo(() => journalModel(state, content), [state, content]);
  const [tab, setTab] = useState<JournalTab>(() => firstTab(model));
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<LoreView>('list');
  const rootRef = useRef<HTMLDivElement>(null);
  useListNav(rootRef, '[data-list-item]', 'Quest journal');
  return (
    <div ref={rootRef}>
      <JournalView
        model={model}
        tab={tab}
        selectedId={selected}
        view={view}
        onTab={(next) => {
          setTab(next);
          setSelected(null);
          setView('list');
        }}
        onSelect={(id) => {
          setSelected(id);
          setView('detail');
        }}
        onBack={() => setView('list')}
      />
    </div>
  );
}
