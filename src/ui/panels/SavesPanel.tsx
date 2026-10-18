// Saves (DESIGN §16.3 `screen_saves`, §14) — U63's first cut, enough for the Title's Load: the three slots and the
// autosave with their summaries; Load, Save (where the engine allows it), Restore backup and Delete. U69 adds export,
// import, the corrupted slot's raw export and the profile file.
import { useSyncExternalStore, type ReactNode } from 'react';
import type { SaveSlot } from '@engine/index';
import { Button } from '../components/Button';
import type { Result, SlotInfo } from '../store/gameStore';
import { useGame, useStore } from '../store/useGame';
import { useShell } from '../shellContext';

export function slotName(slot: SaveSlot): string {
  return slot === 'auto' ? 'Autosave' : `Slot ${slot}`;
}

/** `2026-10-17T09:05:00.000Z` → "17 Oct 2026, 09:05" (UTC; the stamp is what the save recorded). */
export function savedAtText(savedAt: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(savedAt);
  if (!m) return savedAt;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${month} ${m[1]}, ${m[4]}:${m[5]}`;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface SlotListProps {
  slots: readonly SlotInfo[];
  canLoad: boolean;
  canSave: (slot: SaveSlot) => boolean;
  onLoad: (slot: SaveSlot) => void;
  onSave: (slot: SaveSlot) => void;
  onRestore: (slot: SaveSlot) => void;
  onDelete: (slot: SaveSlot) => void;
}

/** Pure list (no hooks). */
export function SlotList({ slots, canLoad, canSave, onLoad, onSave, onRestore, onDelete }: SlotListProps): ReactNode {
  return (
    <ul className="slot-list">
      {slots.map((info) => {
        const name = slotName(info.slot);
        return (
          <li key={String(info.slot)} className="slot" data-status={info.status}>
            <div className="slot__text">
              <h3 className="slot__name">{name}</h3>
              {info.status === 'ok' ? (
                <p className="slot__summary">
                  {info.summary.title}
                  <span className="slot__time"> Saved {savedAtText(info.savedAt)}</span>
                </p>
              ) : info.status === 'empty' ? (
                <p className="slot__summary slot__summary--empty">Empty</p>
              ) : (
                <p className="slot__summary slot__summary--bad">This save is damaged and cannot be loaded.</p>
              )}
            </div>
            <div className="slot__actions">
              {info.status === 'ok' && canLoad ? (
                <Button variant="primary" onClick={() => onLoad(info.slot)} aria-label={`Load ${name.toLowerCase()}`}>
                  Load
                </Button>
              ) : null}
              {canSave(info.slot) ? (
                <Button onClick={() => onSave(info.slot)} aria-label={`Save to ${name.toLowerCase()}`}>
                  Save
                </Button>
              ) : null}
              {info.status === 'corrupted' && info.hasBackup ? (
                <Button onClick={() => onRestore(info.slot)} aria-label={`Restore the backup of ${name.toLowerCase()}`}>
                  Restore backup
                </Button>
              ) : null}
              {info.status !== 'empty' ? (
                <Button variant="quiet" onClick={() => onDelete(info.slot)} aria-label={`Delete ${name.toLowerCase()}`}>
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

export function SavesPanel(): ReactNode {
  const store = useStore();
  const shell = useShell();
  const mode = useGame((s) => s.mode);
  const slots = useSyncExternalStore(store.subscribe, store.shell.listSlots, store.shell.listSlots);
  const report = (result: Result): void => {
    if (!result.ok) store.notify(result.error, 'error');
  };
  const canLoad = mode === 'title' || store.isLegal({ type: 'returnToTitle' });
  if (!store.shell.canPersist()) {
    return <p className="panel-intro">This browser gives the game no storage, so nothing can be saved or loaded here.</p>;
  }
  return (
    <SlotList
      slots={slots}
      canLoad={canLoad}
      canSave={(slot) => slot !== 'auto' && mode !== 'title' && store.isLegal({ type: 'save', slot })}
      onLoad={(slot) => {
        const result = store.shell.load(slot);
        report(result);
        if (result.ok) shell.closePanel();
      }}
      onSave={(slot) => report(store.shell.save(slot))}
      onRestore={(slot) => report(store.shell.restoreSlot(slot))}
      onDelete={(slot) => {
        void shell.confirm(`Delete ${slotName(slot).toLowerCase()}? This cannot be undone.`, { yes: 'Delete' }).then((yes) => {
          if (yes) store.shell.deleteSlot(slot);
        });
      }}
    />
  );
}
