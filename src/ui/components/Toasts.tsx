// Toasts (PLAN §6.1, DESIGN §16.7): two sources in one polite live region that is always present, so a new toast is read
// out. The store's notices ("Saved to the autosave slot.", "The Breach stuttered …") and, from U70, the toasts the engine's
// events call for (rep deltas and tier changes, Resonance "+n ◇", an Echo gained, a level-up, a quest advancing, an item
// gained, an achievement; toastModel.ts). The latter live in the queue of toastQueue.ts, where a repeat merges into the toast
// already showing. Each toast has its own Dismiss button and the Shell clears it after a while. Pure.
import type { ReactNode } from 'react';
import type { Notice } from '../store/gameStore';
import { Button } from './Button';
import { toastText, type ToastItem } from './toastQueue';

/** How long a store notice stays (ms): errors longer, so they can be read. */
export function noticeLifetime(notice: Notice): number {
  return notice.tone === 'error' ? 12_000 : 5_000;
}

export interface ToastsProps {
  notices: readonly Notice[];
  onDismiss: (id: number) => void;
  /** The event toasts (toastQueue.ts). */
  items?: readonly ToastItem[];
  onDismissItem?: (id: number) => void;
  /** No entry animation (the stylesheet also stills it under the root's reduced-motion attribute). */
  reducedMotion?: boolean;
}

export function Toasts({ notices, onDismiss, items = [], onDismissItem, reducedMotion = false }: ToastsProps): ReactNode {
  return (
    <div className="toasts" aria-live="polite" aria-relevant="additions text" data-motion={reducedMotion ? 'reduced' : undefined}>
      {notices.map((notice) => (
        <div key={`n${notice.id}`} className={`toast toast--${notice.tone}`} data-tone={notice.tone}>
          <p className="toast__text">{notice.text}</p>
          <Button variant="quiet" className="toast__dismiss" onClick={() => onDismiss(notice.id)} aria-label={`Dismiss: ${notice.text}`}>
            Dismiss
          </Button>
        </div>
      ))}
      {items.map((item) => {
        const text = toastText(item);
        return (
          <div key={`e${item.id}`} className={`toast toast--${item.tone}`} data-tone={item.tone} data-toast={item.key}>
            <p className="toast__text">{text}</p>
            <Button variant="quiet" className="toast__dismiss" onClick={() => onDismissItem?.(item.id)} aria-label={`Dismiss: ${text}`}>
              Dismiss
            </Button>
          </div>
        );
      })}
    </div>
  );
}
