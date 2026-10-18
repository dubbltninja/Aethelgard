// Toasts (PLAN §6.1): the store's notices (saved, storage full, "The Breach stuttered"). The list is a polite live
// region that is always present, so a new toast is read out; each toast has its own Dismiss button and the Shell
// clears it after a while. U70 adds the onboarding callouts beside it.
import type { ReactNode } from 'react';
import type { Notice } from '../store/gameStore';
import { Button } from './Button';

/** How long a toast stays (ms): errors longer, so they can be read. */
export function noticeLifetime(notice: Notice): number {
  return notice.tone === 'error' ? 12_000 : 5_000;
}

export function Toasts({ notices, onDismiss }: { notices: readonly Notice[]; onDismiss: (id: number) => void }): ReactNode {
  return (
    <div className="toasts" aria-live="polite" aria-relevant="additions">
      {notices.map((notice) => (
        <div key={notice.id} className={`toast toast--${notice.tone}`} data-tone={notice.tone}>
          <p className="toast__text">{notice.text}</p>
          <Button variant="quiet" className="toast__dismiss" onClick={() => onDismiss(notice.id)} aria-label={`Dismiss: ${notice.text}`}>
            Dismiss
          </Button>
        </div>
      ))}
    </div>
  );
}
