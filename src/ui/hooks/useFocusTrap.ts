// `useFocusTrap` (PLAN §6.7): while a panel or dialog is open, Tab and Shift+Tab cycle inside it; on open focus moves
// into it (its `[data-autofocus]`, else its heading, else its first control); on close focus returns to the element
// that opened it. The backdrop takes pointer input and `aria-modal` tells assistive tech the page behind is out of
// reach; the page is not made `inert`, because an inert opener would lose focus before it could be restored.
import { useLayoutEffect, type RefObject } from 'react';
import { focusView, focusablesIn } from '../a11y/focus';

/** Open traps, innermost last: only the innermost one handles Tab (a confirm over a panel). */
const openTraps: HTMLElement[] = [];

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true): void {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!active || root === null) return undefined;
    const opener = document.activeElement instanceof HTMLElement && !root.contains(document.activeElement) ? document.activeElement : null;
    openTraps.push(root);
    focusView(root);
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab' || openTraps[openTraps.length - 1] !== root) return;
      const items = focusablesIn(root);
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !root.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !root.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const at = openTraps.indexOf(root);
      if (at >= 0) openTraps.splice(at, 1);
      if (opener !== null && opener.isConnected) opener.focus();
    };
  }, [ref, active]);
}
