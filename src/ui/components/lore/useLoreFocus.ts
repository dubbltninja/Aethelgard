// Focus for the reading panels' two-step layout on a phone (DESIGN §16.1: list → detail). When the detail replaces the list
// the detail's heading takes focus (so a screen reader announces what opened); when Back returns to the list, focus goes to
// the item that was open. On wide screens both columns are visible and focus stays where the player put it.
import { useEffect, useRef, type RefObject } from 'react';
import type { LoreView } from './MasterDetail';

export function useLoreFocus(root: RefObject<HTMLElement | null>, view: LoreView, narrow: boolean): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!narrow) return;
    const el = root.current;
    if (el === null) return;
    const target = view === 'detail' ? el.querySelector<HTMLElement>('.lore__detail [tabindex="-1"]') : el.querySelector<HTMLElement>('.lore__list [aria-current="true"], .lore__list [data-list-item]');
    target?.focus();
  }, [root, view, narrow]);
}

/** The width under which the panels show one column at a time (lore.css). */
export const NARROW_QUERY = '(max-width: 759.98px)';
