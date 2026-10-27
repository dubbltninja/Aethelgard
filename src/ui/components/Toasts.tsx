// Toasts (PLAN §6.1, DESIGN §16.7): two sources in one polite live region that is always present, so a new toast is read
// out. The store's notices ("Saved to the autosave slot.", "The Breach stuttered …") and, from U70, the toasts the engine's
// events call for (rep deltas and tier changes, Resonance "+n ◇", an Echo gained, a level-up, a quest advancing, an item
// gained, an achievement; toastModel.ts). The latter live in the queue of toastQueue.ts, where a repeat merges into the toast
// already showing. Each toast has its own Dismiss button and the Shell clears it after a while.
//
// U84a (D-147; REPORT U79 #1, D-139): one compact stack. The newest toast shows (and any error); the rest fold into a count
// ("+2"), which unfolds them. The Shell places the stack in a reserved corner — the top of the place's scene or the fight's
// stage (`data-toast-anchor`) — so it never covers the HUD, the map, the narration or the pad. Pure.
import type { CSSProperties, ReactNode } from 'react';
import type { Notice } from '../store/gameStore';
import { Button } from './Button';
import { toastText, type ToastItem } from './toastQueue';

/** How long a store notice stays (ms): errors longer, so they can be read; `scale` shortens it on a phone. */
export function noticeLifetime(notice: Notice, scale = 1): number {
  return Math.round((notice.tone === 'error' ? 12_000 : 5_000) * scale);
}

export interface ToastsProps {
  notices: readonly Notice[];
  onDismiss: (id: number) => void;
  /** The event toasts (toastQueue.ts). */
  items?: readonly ToastItem[];
  onDismissItem?: (id: number) => void;
  /** No entry animation (the stylesheet also stills it under the root's reduced-motion attribute). */
  reducedMotion?: boolean;
  /** The older toasts are shown too (the count was pressed). */
  expanded?: boolean;
  onToggleExpanded?: () => void;
  /** Where the stack sits (the Shell's anchor); the stylesheet's corner when absent. */
  placement?: CSSProperties;
}

interface Entry {
  key: string;
  tone: string;
  text: string;
  toast?: string;
  dismiss: () => void;
}

export function Toasts({ notices, onDismiss, items = [], onDismissItem, reducedMotion = false, expanded = false, onToggleExpanded, placement }: ToastsProps): ReactNode {
  const entries: Entry[] = [
    ...notices.map((notice) => ({ key: `n${notice.id}`, tone: notice.tone, text: notice.text, dismiss: () => onDismiss(notice.id) })),
    ...items.map((item) => ({ key: `e${item.id}`, tone: item.tone, text: toastText(item), toast: item.key, dismiss: () => onDismissItem?.(item.id) })),
  ];
  // the newest shows, and an error always does (it says what went wrong and must be read); the rest fold into the count
  // (a repeat of the same words shows once: the first of them stays where it is)
  const repeated = (entry: Entry, i: number): boolean => entries.some((other, j) => j < i && other.text === entry.text);
  const newest = entries[entries.length - 1]?.text;
  const shown = (entry: Entry, i: number): boolean => expanded || (!repeated(entry, i) && (entry.tone === 'error' || entry.text === newest));
  const folded = entries.filter((entry, i) => !shown(entry, i)).length;
  return (
    <div
      className="toasts"
      aria-live="polite"
      aria-relevant="additions text"
      data-motion={reducedMotion ? 'reduced' : undefined}
      data-anchored={placement === undefined ? undefined : 'true'}
      style={placement}
    >
      {entries.map((entry, i) => (
        <div key={entry.key} className={shown(entry, i) ? `toast toast--${entry.tone}` : `toast toast--${entry.tone} toast--folded`} data-tone={entry.tone} data-toast={entry.toast}>
          <p className="toast__text">{entry.text}</p>
          <Button variant="quiet" className="toast__dismiss" onClick={entry.dismiss} aria-label={`Dismiss: ${entry.text}`}>
            Dismiss
          </Button>
        </div>
      ))}
      {folded > 0 || (expanded && entries.length > 1) ? (
        <button type="button" className="toast-count" aria-expanded={expanded} onClick={() => onToggleExpanded?.()} aria-label={expanded ? 'Fold the older notices' : `${folded} more notice${folded === 1 ? '' : 's'}`}>
          {expanded ? 'Fewer' : `+${folded}`}
        </button>
      ) : null}
    </div>
  );
}
