// Saves (DESIGN §16.3 `screen_saves`, §14): the three slots and the autosave with their summaries; Save, Load, Export,
// Delete (asks first), Restore backup and Export raw text for a damaged slot, and importing a save file into a slot
// through a preview card. Nothing here uses a browser dialog: every question is the Shell's `confirm`.
// Pattern: container (store, files, confirms) → pure `SlotList` / `ImportSection` over `savesModel`.
import { useState, useSyncExternalStore, type ChangeEvent, type ReactNode } from 'react';
import type { SaveSlot } from '@engine/index';
import { Button } from '../components/Button';
import { useHotkeys } from '../hooks/useHotkeys';
import { useShell } from '../shellContext';
import type { Result, SlotInfo } from '../store/gameStore';
import { useContent, useGame, useStore } from '../store/useGame';
import { downloadText, readFileText } from '../util/files';
import { IMPORT_SLOTS, loadQuestion, overwriteQuestion, previewCard, slotCards, slotName, type ImportDraft, type SlotCard } from './savesModel';

export { savedAtText, slotName } from './savesModel';

export interface SlotListProps {
  cards: readonly SlotCard[];
  onLoad: (slot: SaveSlot) => void;
  onSave: (slot: SaveSlot) => void;
  onRestore: (slot: SaveSlot) => void;
  onExport: (slot: SaveSlot) => void;
  onDelete: (slot: SaveSlot) => void;
}

/** Pure list (no hooks). */
export function SlotList({ cards, onLoad, onSave, onRestore, onExport, onDelete }: SlotListProps): ReactNode {
  return (
    <ul className="slot-list" aria-label="Save slots">
      {cards.map((card) => {
        const name = card.name.toLowerCase();
        return (
          <li key={String(card.slot)} className="slot" data-status={card.status} data-slot={String(card.slot)}>
            <div className="slot__text">
              <h3 className="slot__name">{card.name}</h3>
              <p className={`slot__summary${card.status === 'empty' ? ' slot__summary--empty' : ''}${card.status === 'corrupted' ? ' slot__summary--bad' : ''}`}>{card.headline}</p>
              {card.facts.map((fact) => (
                <p key={fact} className="slot__time">
                  {fact}
                </p>
              ))}
            </div>
            <div className="slot__actions">
              {card.load ? (
                <Button variant="primary" onClick={() => onLoad(card.slot)} aria-label={`Load ${name}`}>
                  Load
                </Button>
              ) : null}
              {card.save ? (
                <Button onClick={() => onSave(card.slot)} aria-label={`Save to ${name}`}>
                  Save
                </Button>
              ) : null}
              {card.restore ? (
                <Button onClick={() => onRestore(card.slot)} aria-label={`Restore the backup of ${name}`}>
                  Restore backup
                </Button>
              ) : null}
              {card.exportFile ? (
                <Button onClick={() => onExport(card.slot)} aria-label={`${card.exportLabel} of ${name}`}>
                  {card.exportLabel}
                </Button>
              ) : null}
              {card.remove ? (
                <Button variant="quiet" onClick={() => onDelete(card.slot)} aria-label={`Delete ${name}`}>
                  Delete
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface ImportSectionProps {
  draft: ImportDraft;
  /** The slot chosen for the file. */
  target: SaveSlot;
  className: (classId: string) => string;
  onPick: (event: ChangeEvent<HTMLInputElement>) => void;
  onTarget: (slot: SaveSlot) => void;
  onImport: () => void;
  onCancel: () => void;
}

/** Pure import block: a file picker, then the preview card with the slot choice, or the reason a file was refused. */
export function ImportSection({ draft, target, className, onPick, onTarget, onImport, onCancel }: ImportSectionProps): ReactNode {
  const card = draft.status === 'ready' ? previewCard(draft.preview, className) : null;
  return (
    <section className="import" aria-labelledby="import-heading">
      <h3 id="import-heading" className="import__heading">
        Import a save file
      </h3>
      <p className="panel-intro">Choose a file you exported before. It is checked first, and nothing changes until you confirm.</p>
      <label className="btn btn--secondary file-pick">
        <input className="file-pick__input" type="file" accept=".json,application/json" onChange={onPick} aria-label="Choose a save file" />
        <span aria-hidden="true">Choose a save file</span>
      </label>
      {draft.status === 'refused' ? (
        <p className="import__refused" role="alert">
          {draft.fileName} was not imported. {draft.error}
        </p>
      ) : null}
      {draft.status === 'ready' && card !== null ? (
        <div className="import__preview" role="group" aria-label={`Preview of ${draft.fileName}`}>
          <p className="import__file">{draft.fileName}</p>
          <p className="slot__summary">{card.headline}</p>
          {card.facts.map((fact) => (
            <p key={fact} className="slot__time">
              {fact}
            </p>
          ))}
          {card.notes.map((note) => (
            <p key={note} className="import__note">
              {note}
            </p>
          ))}
          <fieldset className="field-group">
            <legend>Import into</legend>
            <div className="choice-row">
              {IMPORT_SLOTS.map((slot) => (
                <label key={String(slot)} className="choice">
                  <input type="radio" name="import-slot" value={String(slot)} checked={target === slot} onChange={() => onTarget(slot)} />
                  <span>{slotName(slot)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="button-row">
            <Button variant="primary" onClick={onImport}>
              {`Import into ${slotName(target).toLowerCase()}`}
            </Button>
            <Button variant="quiet" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** The first empty manual slot, else slot 1: where an imported file is offered to go. */
export function defaultImportSlot(slots: readonly SlotInfo[]): SaveSlot {
  return IMPORT_SLOTS.find((slot) => slots.find((s) => s.slot === slot)?.status === 'empty') ?? 1;
}

export function SavesPanel(): ReactNode {
  const store = useStore();
  const shell = useShell();
  const content = useContent();
  const mode = useGame((s) => s.mode);
  const slots = useSyncExternalStore(store.subscribe, store.shell.listSlots, store.shell.listSlots);
  const [draft, setDraft] = useState<ImportDraft>({ status: 'none' });
  // until the player picks one, the file is offered the first empty manual slot as the slots stand now
  const [chosen, setTarget] = useState<SaveSlot | null>(null);
  const target = chosen ?? defaultImportSlot(slots);
  const className = (classId: string): string => content.classes[classId]?.name ?? classId;
  const report = (result: Result): boolean => {
    if (!result.ok) store.notify(result.error, 'error');
    return result.ok;
  };
  const infoOf = (slot: SaveSlot): SlotInfo | undefined => slots.find((s) => s.slot === slot);
  const cards = slotCards(slots, {
    canLoad: mode === 'title' || store.isLegal({ type: 'returnToTitle' }),
    canSave: (slot) => slot !== 'auto' && mode !== 'title' && store.isLegal({ type: 'save', slot }),
    className,
  });

  // DESIGN §16.3: 1–4 jump to a slot's first action
  const keys: Record<string, { run: () => void; label: string; group: 'list' }> = {};
  cards.forEach((card, i) => {
    keys[String(i + 1)] = {
      run: () => document.querySelector<HTMLElement>(`.slot[data-slot="${String(card.slot)}"] button`)?.focus(),
      label: `Go to ${card.name.toLowerCase()}`,
      group: 'list',
    };
  });
  useHotkeys(keys, { scope: 'Saves', level: 'inPanel' });

  const ask = (question: string | null, yes: string): Promise<boolean> => (question === null ? Promise.resolve(true) : shell.confirm(question, { yes }));

  if (!store.shell.canPersist()) {
    return <p className="panel-intro">This browser gives the game no storage, so nothing can be saved or loaded here. Your run still plays; use Settings to export your profile.</p>;
  }

  const save = (slot: SaveSlot): void => {
    void ask(overwriteQuestion(slot, infoOf(slot), 'save'), 'Save over it').then((yes) => {
      if (yes) report(store.shell.save(slot));
    });
  };
  const exportSlot = (slot: SaveSlot): void => {
    const file = store.shell.exportSlot(slot);
    if (file === null) return;
    if (!downloadText(file.fileName, file.text)) store.notify('This browser would not start the download.', 'error');
  };
  const pick = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file === undefined) return;
    void readFileText(file).then((text) => {
      input.value = ''; // the same file can be chosen again
      if (text === null) {
        setDraft({ status: 'refused', fileName: file.name, error: 'The file could not be read.' });
        return;
      }
      const checked = store.shell.previewImport(text);
      setDraft(checked.ok ? { status: 'ready', fileName: file.name, preview: checked.preview, text } : { status: 'refused', fileName: file.name, error: checked.error });
    });
  };
  const importNow = (): void => {
    if (draft.status !== 'ready') return;
    void ask(overwriteQuestion(target, infoOf(target), 'import'), 'Replace it').then((yes) => {
      if (!yes) return;
      if (report(store.shell.importToSlot(draft.text, target))) {
        store.notify(`Imported ${draft.fileName} into ${slotName(target).toLowerCase()}.`, 'success');
        setDraft({ status: 'none' });
      }
    });
  };

  return (
    <div className="saves">
      <SlotList
        cards={cards}
        onLoad={(slot) => {
          // U84 (REPORT U79 #12): mid-run, loading asks first
          void ask(loadQuestion(slot, slots, mode !== 'title'), 'Load').then((yes) => {
            if (yes && report(store.shell.load(slot))) shell.closePanel();
          });
        }}
        onSave={save}
        onRestore={(slot) => {
          if (report(store.shell.restoreSlot(slot))) store.notify(`Restored ${slotName(slot).toLowerCase()} from its backup.`, 'success');
        }}
        onExport={exportSlot}
        onDelete={(slot) => {
          void shell.confirm(`Delete ${slotName(slot).toLowerCase()}? This cannot be undone.`, { yes: 'Delete' }).then((yes) => {
            if (yes) store.shell.deleteSlot(slot);
          });
        }}
      />
      <ImportSection
        draft={draft}
        target={target}
        className={className}
        onPick={pick}
        onTarget={setTarget}
        onImport={importNow}
        onCancel={() => setDraft({ status: 'none' })}
      />
    </div>
  );
}
