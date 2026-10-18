// Sub-view focus (PLAN §6.7): when a screen swaps one view for another without a mode change (Title menu → Class
// Select → Credits), focus moves into the new view, as the Shell does on a mode change. The first render is the
// Shell's to focus.
import { useEffect, useRef, type RefObject } from 'react';
import { focusView } from '../a11y/focus';

export function useViewFocus(ref: RefObject<HTMLElement | null>, key: string): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    focusView(ref.current);
  }, [ref, key]);
}
