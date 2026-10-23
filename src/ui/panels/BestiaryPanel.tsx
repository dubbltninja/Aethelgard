// The Bestiary (PLAN §6.3 `BestiaryPanel`, DESIGN §16.3 `screen_bestiary`, §4.2; hotkey B, Shift+B in a fight): creatures by
// family on the left, the chosen creature's card on the right (a phone shows the list, then the card with a Back button).
// The card keeps to what is known: its sigil, name, level and voiced summary once met; resistances after the first kill of
// its family; tactics, then every move with its stats and drops as kills add up — and a question mark, in words, for what
// is not known yet, with the number of kills that would reveal the next part. Opened in a fight it lists the creatures on
// screen first. Read-only.
//
// Pattern (D-104): `BestiaryPanel` holds the selection; `BestiaryView` takes props only.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { CreatureSigil } from '../art/CreatureSigil';
import { Icon } from '../art/Icon';
import { cx } from '../components/Button';
import { MasterDetail, type LoreView } from '../components/lore/MasterDetail';
import { NARROW_QUERY, useLoreFocus } from '../components/lore/useLoreFocus';
import { useListNav } from '../hooks/useListNav';
import { useMediaQuery, useReducedMotion } from '../hooks/useMediaQuery';
import { useShell } from '../shellContext';
import { requestCodexEntry } from '../store/codexRead';
import { useContent, useGame, useProfile } from '../store/useGame';
import { bestiaryModel, type BestiaryModel, type CreatureCard, type MoveRow } from './bestiaryModel';

export interface BestiaryViewProps {
  model: BestiaryModel;
  selectedId: string | null;
  view: LoreView;
  reducedMotion?: boolean;
  /** The Codex can be opened from here (not in a fight). */
  canOpenCodex: boolean;
  onSelect: (id: string) => void;
  onBack: () => void;
  onOpenCodex: (entryId: string) => void;
}

function Unknown({ what }: { what: string }): ReactNode {
  return (
    <span className="unknown">
      <span aria-hidden="true">?</span>
      <span className="sr-only">Not yet known</span>
      <span className="unknown__what"> {what}</span>
    </span>
  );
}

function MoveItem({ move }: { move: MoveRow }): ReactNode {
  if (!move.known) {
    return (
      <li className="move move--unknown">
        <Unknown what="A move not yet seen." />
      </li>
    );
  }
  return (
    <li className="move">
      <span className="move__name">{move.name}</span>
      {move.type === null ? null : <span className="move__type">{move.type}</span>}
      {move.line === null ? null : <span className="move__line">{move.line}</span>}
    </li>
  );
}

export function CreatureDetail({ card, reducedMotion = true, canOpenCodex, onOpenCodex }: { card: CreatureCard; reducedMotion?: boolean; canOpenCodex: boolean; onOpenCodex: (id: string) => void }): ReactNode {
  return (
    <div className="creature-card" data-family={card.family} data-knowledge={card.knowledge}>
      <header className="creature-card__head">
        <CreatureSigil creatureId={card.id} sigil={card.sigil} family={card.family} size="lg" reducedMotion={reducedMotion} />
        <div className="creature-card__id">
          <h3 className="creature-card__name" tabIndex={-1}>
            {card.name}
          </h3>
          <p className="creature-card__meta">
            {card.familyName} · Level {card.level}
            {card.rank === null ? '' : ` · ${card.rank}`}
          </p>
          <p className="creature-card__knowledge">
            <Icon kind="look" size={16} />
            {card.knowledgeLabel}
            {card.present ? <span className="creature-card__present"> · In this fight</span> : null}
          </p>
        </div>
      </header>
      <dl className="creature-card__counts">
        <div>
          <dt>Met</dt>
          <dd>{card.seen}</dd>
        </div>
        <div>
          <dt>Defeated</dt>
          <dd>{card.killed}</dd>
        </div>
        {card.spared === 0 ? null : (
          <div>
            <dt>Spared</dt>
            <dd>{card.spared}</dd>
          </div>
        )}
      </dl>
      <section className="creature-card__summary" data-voice={card.voiceId} aria-label={`What is written of it, in the voice of the ${card.voice}`}>
        <p className="creature-card__voice">{card.voice}</p>
        <p>{card.summary}</p>
      </section>
      <section aria-labelledby={`res-${card.id}`}>
        <h4 id={`res-${card.id}`} className="quest__heading">
          Resistances
        </h4>
        {card.resistances === null ? (
          <p>
            <Unknown what="Defeat a creature of this family to learn them." />
          </p>
        ) : card.resistances.length === 0 && (card.immunities?.length ?? 0) === 0 ? (
          <p>No strong weakness or resistance.</p>
        ) : (
          <ul className="chip-list">
            {card.resistances.map((r) => (
              <li key={r} className="chip">
                {r}
              </li>
            ))}
            {(card.immunities ?? []).map((s) => (
              <li key={s} className="chip">
                Cannot be {s.toLowerCase()}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby={`tac-${card.id}`}>
        <h4 id={`tac-${card.id}`} className="quest__heading">
          Tactics
        </h4>
        <p>{card.tactics === null ? <Unknown what="Learned with more kills." /> : card.tactics}</p>
      </section>
      <section aria-labelledby={`mov-${card.id}`}>
        <h4 id={`mov-${card.id}`} className="quest__heading">
          Moves · {card.movesSeen} of {card.moves.length} seen
        </h4>
        <ul className="move-list">
          {card.moves.map((m) => (
            <MoveItem key={m.id} move={m} />
          ))}
        </ul>
      </section>
      <section aria-labelledby={`sta-${card.id}`}>
        <h4 id={`sta-${card.id}`} className="quest__heading">
          Stats and drops
        </h4>
        {card.stats === null || card.drops === null ? (
          <p>
            <Unknown what="Known once it is fully studied." />
          </p>
        ) : (
          <>
            <dl className="creature-card__counts">
              {card.stats.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
            <p className="creature-card__drops">{card.drops.length === 0 ? 'It leaves nothing behind.' : `Drops: ${card.drops.join(', ')}.`}</p>
          </>
        )}
      </section>
      {card.nextReveal === null ? null : <p className="creature-card__next">{card.nextReveal}</p>}
      {card.codex === null || !card.codex.unlocked || !canOpenCodex ? null : (
        <button type="button" className="btn btn--secondary" onClick={() => onOpenCodex(card.codex!.id)}>
          Read in the Codex: {card.codex.title}
        </button>
      )}
    </div>
  );
}

export function BestiaryView({ model, selectedId, view, reducedMotion = true, canOpenCodex, onSelect, onBack, onOpenCodex }: BestiaryViewProps): ReactNode {
  if (model.families.length === 0) {
    return (
      <div className="lore-panel">
        <p className="lore__empty">{model.summary} Creatures are recorded when you meet them in a fight.</p>
      </div>
    );
  }
  const chosenId = selectedId !== null && model.cards[selectedId] !== undefined ? selectedId : model.firstId;
  const card = chosenId === null ? null : (model.cards[chosenId] ?? null);
  return (
    <div className="lore-panel">
      <p className="codex-count">{model.summary}.</p>
      <MasterDetail
        view={view}
        listLabel="Creatures"
        backLabel="Back to creatures"
        onBack={onBack}
        list={model.families.map((family) => (
          <section key={family.id} className="lore-group" aria-label={family.name}>
            <h3 className="lore-group__heading">
              {family.name} <span className="lore-group__count">{family.known} of {family.total}</span>
            </h3>
            <ul className="lore-list">
              {family.creatures.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={cx('lore-item', chosenId === c.id && 'lore-item--chosen')}
                    data-list-item=""
                    data-autofocus={chosenId === c.id ? '' : undefined}
                    data-creature-id={c.id}
                    aria-current={chosenId === c.id ? 'true' : undefined}
                    aria-label={`${c.name}, level ${c.level}, defeated ${c.killed}${c.present ? ', in this fight' : ''}`}
                    onClick={() => onSelect(c.id)}
                  >
                    <span className="lore-item__name">{c.name}</span>
                    <span className="lore-item__meta">
                      Lv {c.level} · {c.killed} defeated
                      {c.present ? <span className="new-mark">Here</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        detail={card === null ? null : <CreatureDetail card={card} reducedMotion={reducedMotion} canOpenCodex={canOpenCodex} onOpenCodex={onOpenCodex} />}
      />
    </div>
  );
}

export function BestiaryPanel(): ReactNode {
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  const shell = useShell();
  const reducedMotion = useReducedMotion();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<LoreView>('list');
  const rootRef = useRef<HTMLDivElement>(null);
  const model = useMemo(() => bestiaryModel(state, content, profile), [state, content, profile]);
  useListNav(rootRef, '[data-list-item]', 'Bestiary');
  useLoreFocus(rootRef, view, narrow);
  return (
    <div ref={rootRef}>
      <BestiaryView
        model={model}
        selectedId={selected}
        view={view}
        reducedMotion={reducedMotion}
        canOpenCodex={shell.canOpen('codex')}
        onSelect={(id) => {
          setSelected(id);
          setView('detail');
        }}
        onBack={() => setView('list')}
        onOpenCodex={(entryId) => {
          requestCodexEntry(entryId);
          shell.openPanel('codex');
        }}
      />
    </div>
  );
}
