// The Codex (PLAN §6.3 `CodexPanel`, DESIGN §16.3 `screen_codex`; hotkey C, and "Lore" on the Title): the entries found so
// far, listed by category with a voice tag and filters for both; unfound ones as silhouettes with a hint that spoils
// nothing; new entries marked until opened. An entry reads in its voice (D-020): the Remnant Archive dated and ruled, the
// Ironclad Telling spoken, the Weaver Fragments broken, the Wayfinder's Notes written out by hand — a typographic treatment
// each (lore.css), with the voice named in words as well. Related entries are buttons. Read-only apart from the read mark.
//
// Pattern (D-104): `CodexPanel` holds the filter, the selection and the read marks; `CodexView` takes props only.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { cx } from '../components/Button';
import { MasterDetail, type LoreView } from '../components/lore/MasterDetail';
import { NARROW_QUERY, useLoreFocus } from '../components/lore/useLoreFocus';
import { useListNav } from '../hooks/useListNav';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { sharedCodexReadStore, takeCodexRequest } from '../store/codexRead';
import { useContent, useProfile } from '../store/useGame';
import { useProse } from '../text/prose';
import { TextLoading } from '../text/TextLoading';
import { CODEX_CHUNK } from '@content/prose';
import { NO_FILTER, codexModel, inlineRuns, rowName, type Category, type CodexFilter, type CodexModel, type CodexRow, type Voice } from './codexModel';

export interface CodexViewProps {
  model: CodexModel;
  filter: CodexFilter;
  selectedId: string | null;
  view: LoreView;
  onFilter: (filter: CodexFilter) => void;
  onSelect: (id: string) => void;
  onBack: () => void;
}

export function VoiceTag({ row }: { row: Pick<CodexRow, 'voice' | 'voiceTag' | 'voiceLabel'> }): ReactNode {
  return (
    <span className="voice-tag" data-voice={row.voice} title={row.voiceLabel} aria-hidden="true">
      {row.voiceTag}
    </span>
  );
}

function Runs({ text }: { text: string }): ReactNode {
  return inlineRuns(text).map((run, i) => (run.em ? <em key={i}>{run.text}</em> : <span key={i}>{run.text}</span>));
}

export function EntryDetail({ row, onSelect }: { row: CodexRow; onSelect: (id: string) => void }): ReactNode {
  if (!row.unlocked) {
    return (
      <div className="codex-entry codex-entry--locked" data-voice={row.voice}>
        <p className="codex-entry__voice">
          <VoiceTag row={row} />
          {row.voiceLabel} · {row.categoryLabel}
        </p>
        <h3 className="codex-entry__title" tabIndex={-1}>
          Locked entry
        </h3>
        <div className="silhouette" aria-hidden="true">
          <span className="silhouette__bar silhouette__bar--long" />
          <span className="silhouette__bar" />
          <span className="silhouette__bar silhouette__bar--long" />
          <span className="silhouette__bar silhouette__bar--short" />
        </div>
        <p className="codex-entry__hint">{row.hint}</p>
      </div>
    );
  }
  return (
    <div className="codex-entry" data-voice={row.voice}>
      <p className="codex-entry__voice">
        <VoiceTag row={row} />
        {row.voiceLabel} · {row.categoryLabel}
      </p>
      {row.date === null ? null : <p className="codex-entry__date">{row.date}</p>}
      <h3 className="codex-entry__title" tabIndex={-1}>
        {row.title}
      </h3>
      <div className="codex-entry__body">
        {row.loading ? (
          <TextLoading />
        ) : (
          row.paragraphs.map((p, i) => (
            <p key={i}>
              <Runs text={p} />
            </p>
          ))
        )}
      </div>
      {row.source === null ? null : <p className="codex-entry__source">{row.source}</p>}
      {row.related.length === 0 ? null : (
        <nav className="codex-entry__related" aria-label="See also">
          <h4 className="codex-entry__see">See also</h4>
          <ul>
            {row.related.map((r) => (
              <li key={r.id}>
                {r.unlocked ? (
                  <button type="button" className="btn btn--quiet" onClick={() => onSelect(r.id)}>
                    {r.title}
                  </button>
                ) : (
                  <span className="codex-entry__locked-link">Locked entry</span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

function CodexItem({ row, chosen, onSelect }: { row: CodexRow; chosen: boolean; onSelect: (id: string) => void }): ReactNode {
  return (
    <li>
      <button
        type="button"
        className={cx('lore-item', 'codex-item', chosen && 'lore-item--chosen', !row.unlocked && 'lore-item--locked')}
        data-list-item=""
        data-autofocus={chosen ? '' : undefined}
        data-codex-id={row.id}
        data-voice={row.voice}
        aria-current={chosen ? 'true' : undefined}
        aria-label={rowName(row)}
        onClick={() => onSelect(row.id)}
      >
        <span className="lore-item__name">{row.unlocked ? row.title : 'Locked entry'}</span>
        <span className="lore-item__meta">
          <VoiceTag row={row} />
          {row.unlocked ? null : <span>{row.categoryLabel}</span>}
          {row.isNew ? <span className="new-mark">New</span> : null}
        </span>
      </button>
    </li>
  );
}

export function CodexView({ model, filter, selectedId, view, onFilter, onSelect, onBack }: CodexViewProps): ReactNode {
  const chosen = model.shown.find((r) => r.id === selectedId) ?? model.shown[0] ?? null;
  const groups: { category: string; rows: CodexRow[] }[] = [];
  for (const row of model.shown) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.category === row.categoryLabel) last.rows.push(row);
    else groups.push({ category: row.categoryLabel, rows: [row] });
  }
  return (
    <div className="lore-panel">
      <p className="codex-count">
        {model.unlocked} of {model.total} entries found{model.unread > 0 ? `, ${model.unread} new` : ''}.
      </p>
      <div className="codex-filters">
        <label className="field">
          <span className="field__label">Category</span>
          <select className="field__input" value={filter.category} onChange={(e) => onFilter({ ...filter, category: e.target.value as Category | 'all' })}>
            {model.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.found}/{c.total})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Voice</span>
          <select className="field__input" value={filter.voice} onChange={(e) => onFilter({ ...filter, voice: e.target.value as Voice | 'all' })}>
            {model.voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} ({v.found}/{v.total})
              </option>
            ))}
          </select>
        </label>
      </div>
      {model.shown.length === 0 ? (
        <p className="lore__empty">No entry matches. Change the category or the voice.</p>
      ) : (
        <MasterDetail
          view={view}
          listLabel="Entries"
          backLabel="Back to entries"
          onBack={onBack}
          list={groups.map((g) => (
            <section key={g.category} className="lore-group" aria-label={g.category}>
              <h3 className="lore-group__heading">{g.category}</h3>
              <ul className="lore-list">
                {g.rows.map((row) => (
                  <CodexItem key={row.id} row={row} chosen={chosen?.id === row.id} onSelect={onSelect} />
                ))}
              </ul>
            </section>
          ))}
          detail={chosen === null ? null : <EntryDetail row={chosen} onSelect={onSelect} />}
        />
      )}
    </div>
  );
}

export function CodexPanel(): ReactNode {
  const content = useContent();
  const profile = useProfile((p) => p);
  const readStore = sharedCodexReadStore();
  const read = useSyncExternalStore(
    readStore.subscribe,
    () => readStore.read(profile.profileId),
    () => readStore.read(profile.profileId),
  );
  const [filter, setFilter] = useState<CodexFilter>(NO_FILTER);
  const [selected, setSelected] = useState<string | null>(() => takeCodexRequest());
  const [view, setView] = useState<LoreView>(() => (selected === null ? 'list' : 'detail'));
  const narrow = useMediaQuery(NARROW_QUERY);
  const rootRef = useRef<HTMLDivElement>(null);
  // U62a: the bodies live in the codex text chunk, loaded when the panel opens; its arrival re-runs the model
  const prose = useProse([], [CODEX_CHUNK]);
  const model = useMemo(() => codexModel(content, profile, read, filter), [content, profile, read, filter, prose]);
  const chosen = model.shown.find((r) => r.id === selected) ?? model.shown[0] ?? null;
  useListNav(rootRef, '[data-list-item]', 'Codex');
  useLoreFocus(rootRef, view, narrow);

  // Opening an entry marks it read (a locked silhouette has nothing to read).
  const openedId = chosen !== null && chosen.unlocked && (view === 'detail' || !narrow) ? chosen.id : null;
  useEffect(() => {
    if (openedId !== null) readStore.mark(profile.profileId, openedId);
  }, [openedId, profile.profileId, readStore]);

  return (
    <div ref={rootRef}>
      <CodexView
        model={model}
        filter={filter}
        selectedId={selected}
        view={view}
        onFilter={(next) => {
          setFilter(next);
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
