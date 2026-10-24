// The Saves panel's model (DESIGN §14.2–14.4, §16.3 `screen_saves`): what each slot card says and offers, and the
// import draft's preview card. Pure: the container reads the store, this turns it into words and booleans.
import type { SaveSlot } from '@engine/index';
import type { SlotInfo } from '../store/gameStore';
import type { RunPreview } from '../store/persistence';

export function slotName(slot: SaveSlot): string {
  return slot === 'auto' ? 'Autosave' : `Slot ${slot}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-10-17T09:05:00.000Z` → "17 Oct 2026, 09:05" (UTC; the stamp is what the save recorded). */
export function savedAtText(savedAt: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(savedAt);
  if (!m) return savedAt;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${month} ${m[1]}, ${m[4]}:${m[5]}`;
}

export interface SlotsContext {
  /** Title, or anywhere the game may go back to the title (the store does that first). */
  canLoad: boolean;
  /** The engine accepts a save into this slot now (never the autosave, never at the title or in a fight). */
  canSave: (slot: SaveSlot) => boolean;
  className: (classId: string) => string;
}

export interface SlotCard {
  slot: SaveSlot;
  name: string;
  status: SlotInfo['status'];
  /** `Loop 2 · Day 11 · Ironclad Camp`, or "Empty", or why the slot cannot be read. */
  headline: string;
  /** Class and level, then when it was saved. Empty for an empty or damaged slot. */
  facts: string[];
  load: boolean;
  save: boolean;
  /** Overwriting needs a confirmation: the slot holds something readable or not. */
  overwrites: boolean;
  /** Restore `.bak` (DESIGN §14.4: only if the backup validates). */
  restore: boolean;
  /** Download the slot's file; for a damaged slot that is its raw text. */
  exportFile: boolean;
  exportLabel: string;
  remove: boolean;
}

export function slotCards(slots: readonly SlotInfo[], ctx: SlotsContext): SlotCard[] {
  return slots.map((info): SlotCard => {
    const base = {
      slot: info.slot,
      name: slotName(info.slot),
      status: info.status,
      save: ctx.canSave(info.slot),
      overwrites: info.status !== 'empty',
    };
    if (info.status === 'ok') {
      return {
        ...base,
        headline: info.summary.title,
        facts: [`${ctx.className(info.summary.classId)} · level ${info.summary.level}`, `Saved ${savedAtText(info.savedAt)}`],
        load: ctx.canLoad,
        restore: false,
        exportFile: true,
        exportLabel: 'Export',
        remove: true,
      };
    }
    if (info.status === 'corrupted') {
      return {
        ...base,
        headline: 'Damaged: this save cannot be read.',
        facts: [info.error],
        load: false,
        restore: info.hasBackup,
        exportFile: true,
        exportLabel: 'Export raw text',
        remove: true,
      };
    }
    return { ...base, headline: 'Empty', facts: [], load: false, restore: false, exportFile: false, exportLabel: 'Export', remove: false };
  });
}

/** The slots a file may be imported into: the three manual ones (the autosave is the game's own). */
export const IMPORT_SLOTS: readonly SaveSlot[] = [1, 2, 3];

export type ImportDraft =
  | { status: 'none' }
  | { status: 'refused'; fileName: string; error: string }
  | { status: 'ready'; fileName: string; preview: RunPreview; text: string };

export interface PreviewCard {
  headline: string;
  facts: string[];
  /** Upgraded or trimmed on the way in, in plain words. */
  notes: string[];
}

export function previewCard(preview: RunPreview, className: (classId: string) => string): PreviewCard {
  const notes: string[] = [];
  if (preview.migratedFrom !== null) notes.push(`Written by an older version of the game (v${preview.migratedFrom}); it will be upgraded.`);
  for (const warning of preview.warnings) notes.push(`Dropped: ${warning}.`);
  return {
    headline: preview.summary.title,
    facts: [`${className(preview.summary.classId)} · level ${preview.summary.level}`, `Saved ${savedAtText(preview.savedAt)}`],
    notes,
  };
}

/** The confirmation question before a slot is overwritten, or null when the slot is empty. */
export function overwriteQuestion(slot: SaveSlot, current: SlotInfo | undefined, what: 'save' | 'import'): string | null {
  if (current === undefined || current.status === 'empty') return null;
  const held = current.status === 'ok' ? current.summary.title : 'a damaged save';
  return `${slotName(slot)} holds ${held}. ${what === 'save' ? 'Save over it' : 'Replace it with the imported file'}?`;
}
