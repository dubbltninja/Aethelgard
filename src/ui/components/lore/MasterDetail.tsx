// <MasterDetail> (DESIGN §16.1, §16.3: "list left, detail right; mobile: list → detail"), the layout the Journal, the Codex
// and the Bestiary share. Wide: both columns show at once. Narrow (< 760 px): one at a time — the list, and after a pick
// the detail with a "Back to list" button (lore.css; the button is not in the page on wide screens). Pure; the caller holds
// which view is showing.
import type { ReactNode } from 'react';
import { Button } from '../Button';

export type LoreView = 'list' | 'detail';

export interface MasterDetailProps {
  list: ReactNode;
  detail: ReactNode;
  view: LoreView;
  /** Names the list column ("Quests"). */
  listLabel: string;
  /** Names the back button's target ("Back to quests"). */
  backLabel: string;
  onBack: () => void;
  /** The `role="tabpanel"` wiring, when a Tabs component controls this panel. */
  panel?: { id: string; labelledBy: string };
}

export function MasterDetail({ list, detail, view, listLabel, backLabel, onBack, panel }: MasterDetailProps): ReactNode {
  return (
    <div className="lore" data-view={view} role={panel === undefined ? undefined : 'tabpanel'} id={panel?.id} aria-labelledby={panel?.labelledBy}>
      <nav className="lore__list" aria-label={listLabel}>
        {list}
      </nav>
      <article className="lore__detail">
        <Button variant="quiet" className="lore__back" onClick={onBack}>
          {backLabel}
        </Button>
        {detail}
      </article>
    </div>
  );
}
