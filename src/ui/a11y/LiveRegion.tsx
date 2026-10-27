// The polite live region (PLAN §6.7, D-035). It is always in the page (a region added at the moment it speaks is
// often not read), visually hidden, and receives one message per step; `nonce` makes a repeated sentence re-announce.
import type { ReactNode } from 'react';

export interface Announcement {
  text: string;
  nonce: number;
}

export function LiveRegion({ announcement }: { announcement: Announcement | null }): ReactNode {
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-region">
      {announcement === null ? '' : <span key={announcement.nonce}>{announcement.text}</span>}
    </div>
  );
}
