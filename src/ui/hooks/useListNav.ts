// `useListNav` (DESIGN §16.4: "arrows navigate the map and every list"): ↑/↓ move focus between the list items inside a
// panel's list column. The keys live on the `inPanel` level, so they are reached above the panel's own Esc layer, and
// answer only while focus is inside the list. Items are the elements matching `itemSelector`; the arrow keys do not
// select — Enter or a tap does.
import { useCallback, type RefObject } from 'react';
import type { HotkeyMap } from './hotkeys';
import { useHotkeys } from './useHotkeys';

/** The element after (`by` = 1) or before (-1) the focused one, wrapping; from outside the list the first or last. */
export function neighbour<T>(items: readonly T[], current: T | null, by: 1 | -1): T | null {
  if (items.length === 0) return null;
  const at = current === null ? -1 : items.indexOf(current);
  if (at < 0) return (by > 0 ? items[0] : items[items.length - 1]) ?? null;
  return items[(at + by + items.length) % items.length] ?? null;
}

export function useListNav(root: RefObject<HTMLElement | null>, itemSelector: string, scope: string): void {
  const inList = useCallback((): boolean => root.current?.querySelector('.lore__list')?.contains(document.activeElement) ?? false, [root]);
  const move = useCallback(
    (by: 1 | -1): void => {
      const list = root.current?.querySelector('.lore__list');
      const items = [...(list?.querySelectorAll<HTMLElement>(itemSelector) ?? [])];
      neighbour(items, document.activeElement as HTMLElement | null, by)?.focus();
    },
    [root, itemSelector],
  );
  const map: HotkeyMap = {
    arrowup: { run: () => move(-1), label: 'Previous in the list', group: 'list', when: inList },
    arrowdown: { run: () => move(1), label: 'Next in the list', group: 'list', when: inList },
  };
  useHotkeys(map, { scope, level: 'inPanel' });
}
